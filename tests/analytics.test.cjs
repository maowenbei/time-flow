const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const plist = require('@expo/plist').default;

const root = path.resolve(__dirname, '..');
function loadTypeScript(file, imports, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, ...globals,
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return exports;
}

function service({ platform = 'ios', expoGo = false, enabled = true, dev = true, initFails = false, sendFails = false } = {}) {
  const logs = [], sent = [];
  let loads = 0;
  const imports = {
    'expo-constants': {
      __esModule: true,
      default: { executionEnvironment: expoGo ? 'storeClient' : 'standalone', expoConfig: { version: '1.1.0', extra: { analytics: { firebaseEnabled: enabled } } } },
      ExecutionEnvironment: { StoreClient: 'storeClient' },
    },
    'react-native': { Platform: { OS: platform } },
    '@react-native-firebase/analytics': {
      getAnalytics() {
        loads++;
        if (initFails) throw new Error('sensitive initialization detail');
        return { async logEvent(name, params) { if (sendFails) throw new Error('sensitive send detail'); sent.push({ name, params }); } };
      },
      logEvent() { throw new Error('Do not discard the native Promise using the modular logEvent helper'); },
    },
  };
  const api = loadTypeScript('src/services/analytics.ts', imports, { __DEV__: dev, console: { info: (...args) => logs.push(args) } });
  return { ...api, logs, sent, get loads() { return loads; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('Expo Go, web, Android and missing configuration never initialize native Firebase', async () => {
  for (const options of [{ expoGo: true }, { platform: 'web' }, { platform: 'android' }, { enabled: false }]) {
    const api = service(options);
    api.track('timer_started');
    await flush();
    assert.equal(api.loads, 0);
    assert.equal(api.sent.length, 0);
    assert.match(JSON.stringify(api.logs), /console-only/);
  }
});

test('whitelist drops user content, invalid counts, arbitrary strings and common-parameter overrides', async () => {
  const api = service();
  api.setAnalyticsLocale('zh-CN');
  api.setAnalyticsLocale('private@example.com');
  api.track('task_created', { title: 'private@example.com', task_id: 'secret', task_count: 2, entry_source: 'manual', locale: 'secret', app_version: 'secret' });
  api.track('timer_started', { active_task_count: -1, entry_source: 'secret' });
  api.track('timer_paused', { timer_duration_bucket: 'secret', active_task_count: NaN });
  api.track('settings_viewed', { title: 'secret' });
  api.track('arbitrary_secret_event', {});
  await flush();
  assert.equal(api.sent.length, 4);
  assert.equal(api.loads, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(api.sent[0].params)), { app_version: '1.1.0', locale: 'zh-CN', task_count: 2, entry_source: 'manual' });
  assert.equal(Object.keys(api.sent[1].params).length, 2);
  assert.equal(Object.keys(api.sent[2].params).length, 2);
  assert.doesNotMatch(JSON.stringify([api.logs, api.sent]), /secret|private@example/);
});

test('initialization errors are cached, sending failures never reject into business code', async () => {
  for (const options of [{ initFails: true }, { sendFails: true }]) {
    const api = service(options);
    assert.doesNotThrow(() => { api.track('timer_started'); api.track('timer_completed'); });
    await flush();
    assert.equal(api.loads, 1);
    assert.equal(api.sent.length, 0);
    assert.doesNotMatch(JSON.stringify(api.logs), /sensitive/);
  }
});

test('production sends valid events without console output', async () => {
  const api = service({ dev: false });
  api.track('stats_viewed');
  await flush();
  assert.equal(api.sent.length, 1);
  assert.equal(api.logs.length, 0);
});

test('extended events accept only documented enums, booleans and counts and never user content', async () => {
  const api = service();
  const cases = [
    ['time_editor_opened', { day_age_bucket: 'today' }],
    ['task_time_updated', { change_direction: 'decrease', change_bucket: '5_15m', day_age_bucket: 'older' }],
    ['task_updated', { entry_source: 'history', name_changed: true, category_changed: false }],
    ['task_deleted', { entry_source: 'today', task_status: 'completed' }],
    ['task_duplicate_blocked', { entry_source: 'today_edit' }],
    ['break_started', { active_task_count: 2 }], ['break_ended', { timer_duration_bucket: '1_5m' }],
    ['reminder_setting_changed', { setting: 'time', time_of_day: 'morning' }],
    ['notification_permission_result', { granted: false, can_ask_again: true }],
    ['category_created', { icon_source: 'photo' }], ['category_updated', { icon_source: 'built_in' }],
    ['category_deleted', { category_kind: 'custom', has_tasks: true }],
    ['language_changed', { language_mode: 'auto' }], ['stats_period_changed', { period: 'month' }],
    ['stats_period_navigated', { period: 'week', direction: 'reset', is_current_period: true }],
    ['stats_day_selected', { period: 'month', day_age_bucket: 'last_7_days', has_data: true }],
    ['stats_overview_selected', { period: 'week' }],
    ['stats_category_expanded', { period: 'week', scope: 'selected_day', category_kind: 'built_in', task_count: 3 }],
    ['history_day_expanded', { day_age_bucket: 'last_30_days', task_count: 4 }],
  ];
  for (const [event, params] of cases) api.track(event, { ...params, title: 'secret task', category_name: 'secret category', day: '2026-10-26', icon_uri: 'secret photo' });
  api.track('stats_day_selected', { period: 'secret', day_age_bucket: '2026-10-26', has_data: 'true' });
  api.track('task_updated', { entry_source: 'secret', name_changed: 'secret', category_changed: 1 });
  await flush();
  for (let i = 0; i < cases.length; i++) {
    const expected = Object.fromEntries(Object.entries(cases[i][1]).map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value]));
    assert.deepEqual(JSON.parse(JSON.stringify(api.sent[i].params)), { app_version: '1.1.0', locale: 'en', ...expected });
  }
  assert.equal(Object.keys(api.sent.at(-1).params).length, 2);
  assert.equal(Object.keys(api.sent.at(-2).params).length, 2);
  assert.doesNotMatch(JSON.stringify([api.sent, api.logs]), /secret|2026-10-26/);
});

test('day age uses local calendar boundaries and reminder times use coarse buckets', () => {
  const { dayAgeBucket: age, reminderTimeOfDay: hour } = service();
  const now = new Date(2026, 9, 26, 0, 1).getTime();
  for (const [day, expected] of [['2026-10-27', 'future'], ['2026-10-26', 'today'], ['2026-10-20', 'last_7_days'], ['2026-10-19', 'last_30_days'], ['2026-09-26', 'older']]) assert.equal(age(day, now), expected);
  assert.deepEqual([0, 5, 6, 11, 12, 17, 18, 23].map(hour), ['night', 'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening']);
});

test('duration buckets include each lower bound and exclude each upper bound', () => {
  const { timerDurationBucket: bucket } = service();
  for (const [milliseconds, expected] of [
    [-1, 'under_1m'], [0, 'under_1m'], [59999, 'under_1m'], [60000, '1_5m'],
    [299999, '1_5m'], [300000, '5_15m'], [899999, '5_15m'], [900000, '15_30m'],
    [1799999, '15_30m'], [1800000, '30_60m'], [3599999, '30_60m'], [3600000, '60m_plus'],
  ]) assert.equal(bucket(milliseconds), expected);
});

test('app lifecycle records cold start and background return, ignores inactive and effect replay', () => {
  const events = [];
  let listener;
  const effects = [];
  const { AnalyticsLifecycle } = loadTypeScript('src/components/AnalyticsLifecycle.tsx', {
    react: { useEffect: fn => effects.push(fn) },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_name, fn) => { listener = fn; return { remove() {} }; } } },
    '../i18n': { useI18n: () => ({ locale: 'en' }) },
    '../services/analytics': { setAnalyticsLocale() {}, track: (...args) => events.push(args) },
  });
  AnalyticsLifecycle();
  const cleanups = effects.map(effect => effect());
  cleanups.forEach(cleanup => cleanup?.());
  effects.forEach(effect => effect()); // Strict Mode replay
  listener('inactive'); listener('active');
  listener('background'); listener('inactive'); listener('active'); listener('active');
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [
    ['app_open', { entry_source: 'cold_start' }],
    ['app_open', { entry_source: 'foreground' }],
  ]);
});

test('TaskCard actions use settled elapsed time, post-action counts and preserve business calls', () => {
  const jsx = (type, props) => ({ type, props });
  const jsxRuntime = { jsx, jsxs: jsx };
  const time = loadTypeScript('src/utils/time.ts', {});
  // Use production settlement code, without mounting the timer provider or changing it.
  const { liveTask } = loadTypeScript('src/state/TimerContext.tsx', {
    'react/jsx-runtime': jsxRuntime,
    react: { createContext: () => ({}) },
    '@react-native-async-storage/async-storage': {},
    'react-native': { Platform: { OS: 'ios' } },
    '../constants/taskTags': { createStarterTaskTags: () => [] },
    '../utils/time': time,
    '../services/reviewUsage': loadTypeScript('src/services/reviewUsage.ts', {}),
    '../live/ThreadFlowActivity': {}, '../services/reminders': {}, '../i18n': {},
  });
  const { timerDurationBucket } = service();
  const at = new Date(2026, 9, 12, 12).getTime();
  const day = time.todayKey(at);
  const makeTask = (id, status, taskDay = day) => ({ id, title: 'private user text', status, day: taskDay, createdAt: at, elapsedDuration: 59000, allocatedDuration: 30000, tagId: 'uncategorized', sortOrder: 0 });
  for (const scenario of [
    { status: 'pending', action: 'start', label: 'task.start', count: 2, source: 'start' },
    { status: 'paused', action: 'start', label: 'task.resume', count: 2, source: 'resume' },
    { status: 'completed', action: 'restart', label: 'task.restart', count: 2, source: 'restart' },
    { status: 'running', action: 'pause', label: 'task.pause', count: 1, bucket: '1_5m' },
    { status: 'running', action: 'complete', label: 'task.complete', count: 1, bucket: '1_5m' },
    { status: 'running', action: 'pause', label: 'task.pause', breakLocked: true },
    { status: 'pending', action: 'start', label: 'task.start', taskDay: '2026-10-11' },
  ]) {
    const events = [], calls = [];
    const task = makeTask('a', scenario.status, scenario.taskDay);
    const state = { tasks: [task, makeTask('b', 'running')], lastTimestamp: at - 2000, now: at - 1000, ready: true, breakState: scenario.breakLocked ? { startedAt: at - 1000, taskIds: ['a', 'b'] } : undefined };
    const timer = { ...state };
    for (const action of ['start', 'restart', 'pause', 'complete']) timer[action] = id => calls.push([action, id]);
    class FixedDate extends Date { static now() { return at; } }
    const { TaskCard } = loadTypeScript('src/components/TaskCard.tsx', {
      'react/jsx-runtime': jsxRuntime,
      '@expo/vector-icons': { Ionicons: 'Icon' },
      'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
      '../state/TimerContext': { useTimer: () => timer, liveTask },
      '../utils/time': time,
      './TaskTagIcon': { TaskTagIcon: 'Tag' },
      '../i18n': { useI18n: () => ({ locale: 'en', t: key => key }), formatShortTime: () => '' },
      './SwipeDelete': { SwipeDelete: 'Swipe' },
      '../constants/colors': { colors: {} },
      '../constants/design': { border: {}, radius: {}, typography: {} },
      '../services/analytics': { timerDurationBucket, track: (name, params) => events.push({ name, params }) },
    }, { Date: FixedDate });
    const tree = TaskCard({ task });
    function hasLabel(node) {
      if (!node || typeof node !== 'object') return false;
      return node.props?.children === scenario.label || (Array.isArray(node.props?.children) ? node.props.children.some(hasLabel) : hasLabel(node.props?.children));
    }
    function findButton(node) {
      if (!node || typeof node !== 'object') return undefined;
      if (node.type === 'Pressable' && node.props.onPress && hasLabel(node)) {
        const children = node.props.children;
        // Select the innermost actionable button, not the wrapping edit row.
        const nested = (Array.isArray(children) ? children : [children]).map(findButton).find(Boolean);
        return nested ?? node;
      }
      return (Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]).map(findButton).find(Boolean);
    }
    const button = findButton(tree);
    assert.ok(button, scenario.label);
    button.props.onPress({ stopPropagation() {} });
    assert.deepEqual(calls, [[scenario.action, 'a']]);
    if (scenario.breakLocked || scenario.taskDay) assert.equal(events.length, 0);
    else {
      assert.equal(events.length, 1);
      assert.equal(events[0].params.active_task_count, scenario.count);
      if (scenario.source) assert.equal(events[0].params.entry_source, scenario.source);
      if (scenario.bucket) assert.equal(events[0].params.timer_duration_bucket, scenario.bucket);
      assert.doesNotMatch(JSON.stringify(events), /private user text/);
    }
  }
});

test('Expo config validates plist and preserves product configuration', () => {
  const configure = require('../app.config.js');
  const original = process.env.GOOGLE_SERVICES_PLIST;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'threadflow-analytics-'));
  const file = path.join(directory, 'GoogleService-Info.plist');
  const config = require('../app.json').expo;
  try {
    delete process.env.GOOGLE_SERVICES_PLIST;
    const disabled = configure({ config });
    assert.equal(disabled.extra.analytics.firebaseEnabled, false);
    assert.equal(disabled.plugins, config.plugins);
    process.env.GOOGLE_SERVICES_PLIST = file;
    assert.throws(() => configure({ config }), /existing/);
    fs.writeFileSync(file, plist.build({ BUNDLE_ID: 'wrong.bundle' }));
    assert.throws(() => configure({ config }), /BUNDLE_ID/);
    fs.writeFileSync(file, plist.build({ BUNDLE_ID: config.ios.bundleIdentifier }));
    assert.throws(() => configure({ config }), /GOOGLE_APP_ID/);
    fs.writeFileSync(file, plist.build({ BUNDLE_ID: config.ios.bundleIdentifier, GOOGLE_APP_ID: 'test-id', API_KEY: 'test-key', PROJECT_ID: 'test-project' }));
    const enabled = configure({ config });
    assert.equal(enabled.extra.analytics.firebaseEnabled, true);
    assert.equal(enabled.ios.googleServicesFile, file);
    assert.equal(enabled.extra.eas.projectId, config.extra.eas.projectId);
    assert.deepEqual(enabled.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === '@react-native-firebase/analytics')[1], { ios: { withoutAdIdSupport: true } });
    assert.equal(config.ios.googleServicesFile, undefined);
  } finally {
    if (original === undefined) delete process.env.GOOGLE_SERVICES_PLIST;
    else process.env.GOOGLE_SERVICES_PLIST = original;
    fs.rmSync(directory, { recursive: true });
  }
});

test('native linking enables iOS Firebase only when a plist is configured', async () => {
  const { resolveReactNativeModule } = require('../node_modules/expo-modules-autolinking/build/reactNativeConfig/reactNativeConfig.js');
  for (const enabled of [false, true]) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'react-native.config.js'), 'utf8'), {
      module, process: { env: enabled ? { GOOGLE_SERVICES_PLIST: 'configured.plist' } : {} },
    });
    for (const name of ['@react-native-firebase/app', '@react-native-firebase/analytics']) {
      const resolution = { name, path: path.join(root, 'node_modules', name), version: '26.4.0' };
      const linked = await resolveReactNativeModule(resolution, module.exports, 'ios', new Set());
      assert.equal(Boolean(linked), enabled, name);
      assert.equal(module.exports.dependencies[name].platforms.android, null);
    }
  }
});
