const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const usage = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/reviewUsage.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: usage });

function timer(tasks = []) {
  const at = Date.now();
  const dayKey = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let state = { usageDays: [], tasks, categories: [{ id: 'work' }, { id: 'study' }, { id: 'uncategorized' }], lastTimestamp: at, reminders: {}, dismissedHints: [] };
  let hook = 0;
  const imports = {
    'react/jsx-runtime': { jsx: (type, props) => props },
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useState: initial => hook++ === 0 ? [state, update => { state = typeof update === 'function' ? update(state) : update; }] : [initial, () => {}],
      useRef: () => ({ current: null }), useEffect() {}, useMemo: fn => fn(),
    },
    '@react-native-async-storage/async-storage': {},
    'react-native': { Platform: { OS: 'web' } },
    '../constants/taskTags': { createStarterTaskTags: () => [], uncategorizedTagId: 'uncategorized' },
    '../utils/time': { todayKey: dayKey },
    '../live/ThreadFlowActivity': {}, '../services/reminders': {},
    '../i18n': { useI18n: () => ({ locale: 'en', t: key => key }) },
    '../services/reviewUsage': usage,
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/state/TimerContext.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return { api: exports.TimerProvider({ children: null }).value, helpers: exports, state: () => state, day: dayKey(at) };
}

const task = (id, day, title = 'Read', tagId = 'work', status = 'pending') => ({ id, day, title, tagId, status, createdAt: Date.now(), elapsedDuration: 0, allocatedDuration: 0, sortOrder: 0 });

test('creation prevents queued duplicates and trims names while allowing different categories', () => {
  const t = timer();
  t.api.addTask(' Read ', 'work');
  t.api.addTask('Read', 'work');
  t.api.addTask('Read', 'study');
  t.api.addTask('Read', 'missing');
  t.api.addTask('Read', 'uncategorized');
  assert.equal(t.state().tasks.length, 3);
  assert.ok(t.state().tasks.every(task => task.title === 'Read'));
});

test('all statuses block duplicates on the same day; other days remain independent', () => {
  const day = timer().day;
  for (const status of ['pending', 'running', 'paused', 'completed']) {
    const t = timer([task('existing', day, 'Read', 'work', status)]);
    t.api.addTask('Read', 'work');
    assert.equal(t.state().tasks.length, 1);
  }
  const t = timer([task('old', '2000-01-01')]);
  t.api.addTask('Read', 'work');
  assert.equal(t.state().tasks.length, 2);
});

test('editing validates the original day and excludes the task itself', () => {
  const t = timer([task('a', '2000-01-01'), task('b', '2000-01-01', 'Write'), task('c', '2000-01-02', 'Other')]);
  t.api.updateTask('b', ' Read ', 'work');
  assert.equal(t.state().tasks.find(task => task.id === 'b').title, 'Write');
  t.api.updateTask('a', 'Read', 'work');
  t.api.updateTask('c', 'Read', 'work');
  assert.equal(t.state().tasks.find(task => task.id === 'c').title, 'Read');
  t.api.updateTask('b', 'Read', 'study');
  assert.equal(t.state().tasks.find(task => task.id === 'b').tagId, 'study');
});

test('copying historical duplicates keeps a single new task per name and category', () => {
  const t = timer([task('a', '2000-01-01'), task('b', '2000-01-01', ' Read '), task('c', '2000-01-01', 'Read', 'study')]);
  t.api.copyLatestTasks();
  assert.equal(t.state().tasks.filter(task => task.day === t.day).length, 2);
  assert.equal(t.state().tasks.filter(task => task.day === '2000-01-01').length, 3);
  t.api.copyLatestTasks();
  assert.equal(t.state().tasks.length, 5);
});

test('Today copy count and analytics match the actual batch after category normalization and deduplication', () => {
  const t = timer([
    task('a', '2000-01-02'), task('b', '2000-01-02', ' Read '),
    task('c', '2000-01-02', 'Read', 'missing'), task('d', '2000-01-02', 'Read', 'uncategorized'),
    task('older', '2000-01-01', 'Older'),
  ]);
  const events = [];
  const jsx = (type, props) => ({ type, props });
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: value => [value, () => {}], useRef: value => ({ current: value }), useCallback: fn => fn },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { useRouter: () => ({}), useFocusEffect() {} },
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: value => value }, Keyboard: {} },
    '../../src/components/adaptive/AdaptiveTaskGroup': {},
    '../../src/hooks/useAdaptiveLayout': { useAdaptiveLayout: () => ({ enabled: false, isPad: false, wide: false }) },
    '../../src/components/adaptive/AdaptivePageFrame': {}, '../../src/components/adaptive/AdaptiveModalFrame': {}, '../../src/components/adaptive/TodayLayout': {},
    '../../src/components/TaskCard': {}, '../../src/components/DismissibleHint': {}, '../../src/components/TaskTagIcon': {},
    '../../src/constants/taskTags': { getTaskTagLabel: () => '' },
    '../../src/i18n': { useI18n: () => ({ locale: 'en', t: (key, params) => key === 'today.copyLatestTasks' ? `Copy ${params.count}` : key }), formatDayLabel: () => '' },
    '../../src/state/TimerContext': { ...t.helpers, useTimer: () => ({ ...t.api, ready: true, now: Date.now() }) },
    '../../src/utils/time': { todayKey: () => t.day, fullTime: () => '' },
    '../../src/constants/design': { border: {}, radius: {}, space: {}, typography: {} },
    '../../src/services/analytics': { track: (event, params) => events.push({ event, params }) },
    '../../src/components/useReviewInvitation': { useReviewInvitation() {} },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/(tabs)/today.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  function flatten(node) {
    if (Array.isArray(node)) return node.flatMap(flatten);
    if (!node || typeof node !== 'object') return [];
    return [node, ...flatten(node.props?.children)];
  }
  const nodes = flatten(exports.default());
  const button = nodes.find(node => node.type === 'Pressable' && flatten(node.props.children).some(child => child.props?.children === 'Copy 2'));
  assert.ok(button, 'copy button displays the deduplicated count');
  button.props.onPress();
  assert.equal(t.state().tasks.filter(task => task.day === t.day).length, 2);
  assert.equal(events.length, 2);
  for (const { event, params } of events) {
    assert.equal(event, 'task_created');
    assert.equal(params.task_count, 2);
    assert.equal(params.entry_source, 'copy_latest');
  }
  assert.equal(t.helpers.getCopyableLatestTasks(t.state().tasks, t.state().categories, t.day).length, 0);
});
