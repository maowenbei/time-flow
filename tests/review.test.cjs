const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, setTimeout, clearTimeout, ...globals,
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}
const usage = load('src/services/reviewUsage.ts');
const days = Array.from({ length: 3 }, (_, i) => `2026-10-${String(i * 2 + 1).padStart(2, '0')}`);

test('usage counts distinct local dates, tolerates gaps and caps at three', () => {
  let recorded = [];
  for (const day of days.slice(0, 2)) recorded = usage.recordUsageDay(recorded, day);
  assert.equal(usage.isReviewEligible(recorded), false);
  recorded = usage.recordUsageDay(recorded, days[0]);
  assert.equal(recorded.length, 2);
  recorded = usage.recordUsageDay(recorded, days[2]);
  assert.equal(usage.isReviewEligible(recorded), true);
  assert.equal(usage.recordUsageDay(recorded, '2026-11-01').length, 3);
});

test('migration uses actual elapsed days once; deletion and manual time do not alter history', () => {
  const tasks = days.map(day => ({ day, elapsedDuration: 1 }));
  tasks.push({ day: '2026-11-01', elapsedDuration: 0, allocatedDuration: 60000 });
  const migrated = usage.migrateUsageDays(undefined, tasks);
  assert.deepEqual(Array.from(migrated), days);
  assert.deepEqual(Array.from(usage.migrateUsageDays(migrated, [])), days);
  assert.equal(usage.migrateUsageDays([], tasks).length, 0);
  assert.equal(usage.migrateUsageDays(undefined, [{ day: days[0], elapsedDuration: 0 }]).length, 0);
});

test('existing seven-day records remain eligible and migrate to the three-day cap', () => {
  const legacyDays = Array.from({ length: 7 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  assert.equal(usage.isReviewEligible(legacyDays), true);
  assert.deepEqual(Array.from(usage.migrateUsageDays(legacyDays, [])), legacyDays.slice(0, 3));
});

function service(options = {}, shared = { value: null }) {
  const events = [], calls = [];
  const api = load('src/services/storeReview.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      async getItem() { calls.push('read'); if (options.readFails) throw Error('read'); return shared.value; },
      async setItem(key, value) { calls.push('write'); if (options.writeFails) throw Error('write'); shared.value = value; options.onWrite?.(); },
      async removeItem() { calls.push('remove'); shared.value = null; },
    } },
    'react-native': { Platform: { OS: options.platform ?? 'ios' } },
    'expo-store-review': {
      async isAvailableAsync() { calls.push('available'); options.onAvailable?.(); return options.available !== false; },
      async requestReview() { calls.push('request'); if (options.requestFails) throw Error('native'); },
    },
    './analytics': { track: event => events.push(event) },
  }, { __DEV__: options.dev ?? false });
  return { ...api, calls, events, shared };
}

test('request persists before native API and deduplicates parallel calls, restarts and upgrades', async () => {
  const api = service();
  await Promise.all([api.requestReviewSafely(() => true), api.requestReviewSafely(() => true)]);
  assert.deepEqual(api.calls, ['read', 'available', 'write', 'request']);
  assert.deepEqual(api.events, ['review_request_attempted']);
  await api.requestReviewSafely(() => true);
  const restarted = service({}, api.shared);
  await restarted.requestReviewSafely(() => true);
  assert.deepEqual(restarted.calls, ['read']);
});

test('unsupported environments and unavailable API skip without consuming the invitation', async () => {
  for (const options of [{ platform: 'android' }, { platform: 'web' }, { dev: true }, { available: false }]) {
    const api = service(options);
    await api.requestReviewSafely(() => true);
    assert.equal(api.calls.includes('request'), false);
    assert.equal(api.shared.value, null);
  }
});

test('storage failures are contained; native failure consumes the single request', async () => {
  for (const options of [{ readFails: true }, { writeFails: true }, { requestFails: true }]) {
    const api = service(options);
    await assert.doesNotReject(api.requestReviewSafely(() => true));
    assert.equal(api.calls.includes('request'), Boolean(options.requestFails));
    assert.equal(api.events.includes('review_request_failed'), true);
    if (options.requestFails) {
      await api.requestReviewSafely(() => true);
      assert.equal(api.calls.filter(call => call === 'request').length, 1);
    }
  }
});

test('cancellation during availability check or storage never invokes native API', async () => {
  for (const step of ['onAvailable', 'onWrite']) {
    let safe = true;
    const api = service({ [step]: () => { safe = false; } });
    await api.requestReviewSafely(() => safe);
    assert.equal(api.calls.includes('request'), false);
    assert.equal(api.shared.value, null);
    safe = true;
    // The test callback cancels again, so this still must not request.
    await api.requestReviewSafely(() => safe);
    assert.equal(api.calls.includes('request'), false);
  }
});

function fakeClock() {
  let nextId = 0;
  const pending = new Map();
  return {
    setTimeout(fn, delay) { assert.equal(delay, 2000); pending.set(++nextId, fn); return nextId; },
    clearTimeout(id) { pending.delete(id); },
    fire() { const jobs = [...pending.values()]; pending.clear(); jobs.forEach(fn => fn()); },
    get size() { return pending.size; },
  };
}

test('two-second opportunity cancels permanently, checks safety and permits a later completion', () => {
  const clock = fakeClock();
  const api = load('src/services/storeReview.ts', {
    '@react-native-async-storage/async-storage': {}, 'react-native': {}, 'expo-store-review': {}, './analytics': {},
  }, clock);
  let safe = true, requests = 0, liveGate;
  const opportunity = api.createReviewOpportunity(() => safe, gate => { requests++; liveGate = gate; });
  opportunity.arm();
  assert.equal(requests, 0);
  opportunity.cancel();
  clock.fire();
  assert.equal(requests, 0);
  opportunity.arm();
  safe = false;
  clock.fire();
  safe = true;
  assert.equal(requests, 0);
  opportunity.arm();
  clock.fire();
  assert.equal(requests, 1);
  opportunity.cancel();
  assert.equal(liveGate(), false);
});

function invitationHarness(debug = false) {
  const clock = fakeClock();
  let state = { ready: false, tasks: [], usageDays: days }, modal = false, cursor = 0, requests = 0, focusCleanup;
  let keyboardVisible = false;
  const refs = [], effects = [], jobs = [], listeners = {};
  const native = {
    AppState: { currentState: 'active', addEventListener: (_, fn) => { listeners.app = fn; return { remove() {} }; } },
    Keyboard: { isVisible: () => keyboardVisible, addListener: (name, fn) => { listeners[name] = fn; return { remove() {} }; } },
  };
  const { createReviewOpportunity } = load('src/services/storeReview.ts', {
    '@react-native-async-storage/async-storage': {}, 'react-native': {}, 'expo-store-review': {}, './analytics': {},
  }, clock);
  const { useReviewInvitation } = load('src/components/useReviewInvitation.ts', {
    react: {
      useRef(value) { const i = cursor++; return refs[i] ??= { current: value }; },
      useCallback(fn) { return fn; },
      useEffect(fn, deps) {
        const i = cursor++, old = effects[i];
        if (!old || deps.some((value, j) => value !== old.deps[j])) jobs.push(() => {
          old?.cleanup?.(); effects[i] = { deps, cleanup: fn() };
        });
      },
    },
    'expo-router': { useFocusEffect(fn) { if (!focusCleanup) jobs.push(() => { focusCleanup = fn(); }); } },
    'react-native': native,
    '../state/TimerContext': { useTimer: () => state },
    '../services/reviewUsage': usage,
    '../services/storeReview': { isReviewDebugEnabled: () => debug, createReviewOpportunity: safe => createReviewOpportunity(safe, gate => { if (gate()) requests++; return Promise.resolve(); }) },
  });
  const render = (update = {}, visible = modal) => {
    state = { ...state, ...update }; modal = visible; cursor = 0;
    useReviewInvitation(modal); while (jobs.length) jobs.shift()();
  };
  const task = status => ({ id: 'one', status });
  return {
    render, clock,
    start() { render({ ready: true, tasks: [task('running')] }); },
    complete() { render({ tasks: [task('completed')] }); },
    blur() { focusCleanup(); },
    background() { native.AppState.currentState = 'background'; listeners.app('background'); native.AppState.currentState = 'active'; listeners.app('active'); },
    keyboard() { keyboardVisible = true; listeners.keyboardWillShow(); keyboardVisible = false; },
    get requests() { return requests; },
  };
}

test('hydration does not invite; only a fresh completion after three usage days arms a request', () => {
  const h = invitationHarness();
  h.render();
  h.render({ ready: true, tasks: [{ id: 'one', status: 'completed' }] });
  h.clock.fire();
  assert.equal(h.requests, 0);
  h.start(); h.complete();
  assert.equal(h.requests, 0);
  h.clock.fire();
  assert.equal(h.requests, 1);
});

test('page blur, background, keyboard, modal, break and restarted timer cancel without delayed replay', () => {
  for (const interrupt of [h => h.blur(), h => h.background(), h => h.keyboard(),
    h => { h.render({}, true); h.render({}, false); },
    h => { h.render({ breakState: {} }); h.render({ breakState: undefined }); },
    h => { h.start(); h.render({ tasks: [{ id: 'one', status: 'paused' }] }); }]) {
    const h = invitationHarness();
    h.start(); h.complete();
    interrupt(h);
    h.clock.fire();
    assert.equal(h.requests, 0);
  }
});

test('two days and another active timer block the invitation', () => {
  const h = invitationHarness();
  h.render({ usageDays: days.slice(0, 2) }); h.start(); h.complete(); h.clock.fire();
  assert.equal(h.requests, 0);
  h.render({ usageDays: days }); h.start();
  h.render({ tasks: [{ id: 'one', status: 'completed' }, { id: 'two', status: 'running' }] });
  h.clock.fire();
  assert.equal(h.requests, 0);
});

test('debug simulation bypasses only usage days, still requires a fresh last completion and cancels on background', () => {
  const h = invitationHarness(true);
  h.render({ ready: true, usageDays: [], tasks: [{ id: 'one', status: 'completed' }] });
  h.clock.fire();
  assert.equal(h.requests, 0);
  h.start(); h.complete(); h.clock.fire();
  assert.equal(h.requests, 1);
  h.start(); h.complete(); h.background(); h.clock.fire();
  assert.equal(h.requests, 1);
  h.start();
  h.render({ tasks: [{ id: 'one', status: 'completed' }, { id: 'two', status: 'running' }] });
  h.clock.fire();
  assert.equal(h.requests, 1);
});

test('debug requests are repeatable and isolated from real invitation storage and analytics', async () => {
  const api = service({ dev: true }, { value: 'already requested in production' });
  await api.requestReviewSafely(() => true);
  assert.equal(api.calls.length, 0);
  api.setReviewDebugEnabled(true);
  assert.equal(api.isReviewDebugEnabled(), true);
  await api.requestReviewSafely(() => true);
  assert.equal(api.isReviewDebugEnabled(), false);
  await api.requestReviewSafely(() => true);
  assert.deepEqual(api.calls, ['available', 'request']);
  assert.equal(await api.requestReviewForDebug(), 'requested');
  api.setReviewDebugEnabled(true);
  await api.requestReviewSafely(() => true);
  assert.equal(api.calls.filter(call => call === 'request').length, 3);
  assert.equal(api.shared.value, 'already requested in production');
  assert.equal(api.events.length, 0);
  assert.equal(api.calls.some(call => ['read', 'write', 'remove'].includes(call)), false);
});

test('production cannot enable debug; disabling simulation during an async check cancels it', async () => {
  const prod = service();
  prod.setReviewDebugEnabled(true);
  assert.equal(prod.isReviewDebugEnabled(), false);
  assert.equal(await prod.requestReviewForDebug(), 'unavailable');
  assert.equal(prod.calls.length, 0);
  const dev = service({ dev: true, onAvailable: () => dev.setReviewDebugEnabled(false) });
  dev.setReviewDebugEnabled(true);
  await dev.requestReviewSafely(() => true);
  assert.deepEqual(dev.calls, ['available']);
  assert.equal(dev.shared.value, null);
  assert.equal(dev.events.length, 0);
});

async function timerHarness(saved) {
  let cursor = 0, at = new Date(2026, 9, 19, 12).getTime(), stored = saved;
  const slots = [], effects = [];
  class ClockDate extends Date { static now() { return at; } }
  const jsx = (type, props) => ({ type, props });
  const time = load('src/utils/time.ts');
  const tags = { createStarterTaskTags: () => [{ id: 'uncategorized' }], uncategorizedTagId: 'uncategorized', isBuiltInTagId: () => false };
  const { TimerProvider } = load('src/state/TimerContext.tsx', {
    react: {
      createContext: () => ({ Provider: 'provider' }),
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
      },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
      useMemo: fn => fn(),
      useEffect(fn) { effects.push(fn); },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      async getItem() { return stored ? JSON.stringify(stored) : null; },
      async setItem(_, value) { stored = JSON.parse(value); },
    } },
    'react-native': { Platform: { OS: 'ios' } },
    '../constants/taskTags': tags, '../utils/time': time,
    '../live/ThreadFlowActivity': {}, '../services/reminders': {},
    '../i18n': { useI18n: () => ({ locale: 'en', t: () => '' }) },
    '../services/reviewUsage': usage,
  }, { Date: ClockDate });
  const render = () => { cursor = 0; effects.length = 0; return TimerProvider({ children: null }).props.value; };
  render(); effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  return { render, advanceDay() { at += 86400000; }, persist() { render(); effects[1](); return stored; } };
}

test('timer provider records starts, resumes and restarts, persists history and ignores creation and invalid starts', async () => {
  const h = await timerHarness();
  h.render().addTask('first', 'uncategorized');
  let api = h.render();
  assert.equal(api.usageDays.length, 0);
  api.start('missing');
  assert.equal(h.render().usageDays.length, 0);
  const first = api.tasks[0].id;
  api.start(first);
  assert.equal(h.render().usageDays.length, 1);
  h.render().pause(first); h.render().start(first);
  h.render().complete(first); h.render().restart(first);
  assert.equal(h.render().usageDays.length, 1);
  h.render().remove(first);
  assert.equal(h.render().usageDays.length, 1);
  for (let i = 1; i < 3; i++) {
    h.advanceDay();
    h.render().addTask(`day ${i}`, 'uncategorized');
    api = h.render();
    api.start(api.tasks[0].id);
  }
  assert.equal(h.render().usageDays.length, 3);
  const saved = h.persist();
  const restarted = await timerHarness(saved);
  assert.equal(restarted.render().usageDays.length, 3);
});

test('timer hydration migrates elapsed history and preserves it after every task is removed', async () => {
  const h = await timerHarness({
    tasks: days.map((day, index) => ({ id: `${index}`, day, status: 'completed', elapsedDuration: 10, allocatedDuration: 10 })),
  });
  assert.equal(h.render().usageDays.length, 3);
  h.render().tasks.forEach(task => h.render().remove(task.id));
  assert.equal(h.render().tasks.length, 0);
  const restarted = await timerHarness(h.persist());
  assert.equal(restarted.render().usageDays.length, 3);
});
