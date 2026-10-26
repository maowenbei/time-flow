const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTimer(dev = true, ready = true) {
  let state;
  let hook = 0;
  const dayKey = at => new Date(at).toLocaleDateString('en-CA');
  const categories = [{ id: 'work' }, { id: 'uncategorized' }];
  const imports = {
    'react/jsx-runtime': { jsx: (_, props) => props },
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useState: initial => {
        const index = hook++;
        if (index === 0) {
          state = { ...initial, categories, tasks: [] };
          return [state, update => { state = update(state); }];
        }
        return [index === 1 ? ready : initial, () => {}];
      },
      useRef: () => ({ current: null }), useEffect() {}, useMemo: fn => fn(),
    },
    '@react-native-async-storage/async-storage': {},
    'react-native': { Platform: { OS: 'web' } },
    '../constants/taskTags': { createStarterTaskTags: () => categories, uncategorizedTagId: 'uncategorized' },
    '../utils/time': { todayKey: dayKey },
    '../live/ThreadFlowActivity': {}, '../services/reminders': {},
    '../i18n': { useI18n: () => ({ locale: 'en', t: key => key }) },
    '../services/reviewUsage': {},
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/state/TimerContext.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, __DEV__: dev, require: name => {
    assert.ok(name in imports, name);
    return imports[name];
  } });
  return { api: exports.TimerProvider({ children: null }).value, state: () => state, valid: exports.isValidTaskDay };
}

test('debug task dates validate the calendar without rolling invalid dates forward', () => {
  const { valid } = loadTimer();
  for (const day of ['2024-02-29', '2000-01-01', '2099-12-31', '0099-01-01']) assert.equal(valid(day), true, day);
  for (const day of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-1-01', 'bad']) assert.equal(valid(day), false, day);
});

test('debug creation saves past and future tasks with day-scoped duplicate protection', () => {
  const t = loadTimer();
  t.api.addDebugTask(' Read ', 'work', '2000-01-01');
  t.api.addDebugTask('Read', 'work', '2000-01-01');
  t.api.addDebugTask('Read', 'work', '2099-12-31');
  t.api.addDebugTask('Read', 'missing', '2000-01-01');
  t.api.addDebugTask('Read', 'uncategorized', '2000-01-01');
  t.api.addDebugTask(' ', 'work', '2000-01-01');
  t.api.addDebugTask('Invalid', 'work', '2026-02-29');
  assert.equal(t.state().tasks.length, 3);
  assert.ok(t.state().tasks.some(task => task.day === '2099-12-31'));
  for (const task of t.state().tasks) {
    assert.equal(task.title, 'Read');
    assert.equal(task.status, 'pending');
    assert.equal(task.allocatedDuration, 0);
    assert.equal(task.elapsedDuration, 0);
  }
  assert.equal(t.state().usageDays.length, 0);
});

test('debug creation is disabled in production and before storage is loaded', () => {
  for (const [dev, ready] of [[false, true], [true, false]]) {
    const t = loadTimer(dev, ready);
    t.api.addDebugTask('Read', 'work', '2000-01-01');
    assert.equal(t.state().tasks.length, 0);
  }
});
