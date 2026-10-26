const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, require) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require, __DEV__: true, requestAnimationFrame: fn => fn() });
  return exports;
}
const time = load('src/utils/time.ts');
const analytics = load('src/services/analytics.ts', name => {
  if (name === 'expo-constants') return {};
  if (name === 'react-native') return {};
  throw Error(name);
});
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== 'object') return [];
  return [node, ...flatten(node.props?.children)];
}
function harness(file) {
  const events = [], slots = [];
  let cursor = 0, permission = { granted: true, canAskAgain: true };
  const today = time.todayKey();
  const task = { id: 'one', title: 'Private task', day: today, tagId: 'custom-one', status: 'completed', allocatedDuration: 120000, elapsedDuration: 120000 };
  const timer = {
    ready: true, now: Date.now(), tasks: [task], categories: [{ id: 'custom-one', label: 'Private cat' }], dismissedHints: [],
    reminders: { startEnabled: false, longEnabled: false, startFrequency: 'weekdays', startHour: 9, startMinute: 0 },
    setReminders(next) { timer.reminders = next; },
    updateAllocatedDuration(id, value) { timer.tasks = timer.tasks.map(task => ({ ...task, allocatedDuration: value })); },
    addCategory() {}, updateCategory() {},
  };
  const i18n = { locale: 'en', languageMode: 'auto', t: key => key, setLanguageMode(mode) { i18n.languageMode = mode; } };
  const jsx = (type, props) => ({ type, props });
  const native = Object.fromEntries(['View', 'Text', 'TextInput', 'ScrollView', 'Pressable', 'Switch', 'Modal', 'Image'].map(name => [name, name]));
  Object.assign(native, {
    StyleSheet: { create: value => value }, Keyboard: { dismiss() {} },
    Animated: { Value: class { interpolate() { return 0; } setValue() {} }, timing: () => ({ start: fn => fn?.({ finished: true }) }) }, Easing: { out() {}, in() {} },
  });
  const page = load(file, name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
      useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
      useCallback: fn => fn, useMemo: fn => fn(), useEffect() {},
    };
    if (name === 'react-native') return native;
    if (name === '@expo/vector-icons') return { Ionicons: 'Icon' };
    if (name === 'expo-router') return { useFocusEffect() {}, useRouter: () => ({}) };
    if (name.startsWith('expo-image-')) return {};
    if (name.endsWith('/services/analytics')) return { ...analytics, track: (name, params) => events.push({ name, params }) };
    if (name.endsWith('/services/reminders')) return { requestNotificationPermission: async () => permission };
    if (name.endsWith('/state/TimerContext')) return { useTimer: () => timer, liveTask: task => task, hasDuplicateTask: () => false };
    if (name.endsWith('/utils/time')) return time;
    if (name.endsWith('/i18n')) return { useI18n: () => i18n, formatShortTime: () => '', formatHistoryDay: () => '', languageSettingsCopy: () => ({}), languageModeLabel: mode => mode };
    if (name.endsWith('/constants/taskTags')) return { getTaskTagLabel: tag => tag.label, getSystemIconImage() {}, systemIconChoices: [] };
    if (name.endsWith('/constants/design')) return { border: {}, radius: {}, space: {}, typography: {} };
    if (name.endsWith('/constants/colors')) return { colors: {} };
    if (name.includes('/components/')) return {};
    throw Error(name);
  });
  let nodes;
  const render = () => { cursor = 0; nodes = flatten(page.default()); };
  const button = label => nodes.find(node => node.props?.onPress && (node.props.accessibilityLabel === label || node.props.label === label || flatten(node.props.children).some(child => child.props?.children === label)));
  render();
  return { timer, events, render, button, nodes: () => nodes, setPermission(value) { permission = value; } };
}

test('stats tracks deliberate view changes and drilldowns without render or collapse duplicates', () => {
  const h = harness('app/(tabs)/stats.tsx');
  h.render(); assert.equal(h.events.length, 0);
  h.button('stats.last7Days').props.onPress(); h.render();
  assert.equal(h.events.length, 0);
  h.button('stats.month').props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'stats_period_changed');
  h.button('stats.previous').props.onPress(); h.render();
  assert.equal(h.events.at(-1).params.direction, 'previous');
  h.button('stats.next').props.onPress(); h.render();
  assert.equal(h.events.at(-1).params.is_current_period, true);
  h.nodes().find(node => node.props?.onSelect).props.onSelect(time.todayKey()); h.render();
  assert.equal(h.events.at(-1).name, 'stats_day_selected');
  assert.equal(h.events.at(-1).params.has_data, true);
  const count = h.events.length;
  h.nodes().find(node => node.props?.onSelect).props.onSelect(time.todayKey()); h.render();
  assert.equal(h.events.length, count);
  h.nodes().find(node => node.props?.accessibilityState?.expanded === false).props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'stats_category_expanded');
  assert.equal(h.events.at(-1).params.scope, 'selected_day');
  h.nodes().find(node => node.props?.accessibilityState?.expanded === true).props.onPress(); h.render();
  assert.equal(h.events.length, count + 1);
  h.button('stats.total').props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'stats_overview_selected');
  assert.doesNotMatch(JSON.stringify(h.events), /Private|custom-one/);
});

test('time editing emits only on a valid changed save, not invalid input or cancel', () => {
  const h = harness('app/(tabs)/history.tsx');
  h.nodes().find(node => node.props?.accessibilityState?.expanded === false).props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'history_day_expanded');
  h.nodes().find(node => node.props?.onLongPress).props.onLongPress(); h.render();
  assert.equal(h.events.at(-1).name, 'time_editor_opened');
  const input = () => h.nodes().find(node => node.type === 'TextInput' && node.props.keyboardType === 'number-pad');
  const count = h.events.length;
  input().props.onChangeText('-1'); h.render(); h.button('common.save').props.onPress(); h.render();
  assert.equal(h.events.length, count);
  input().props.onChangeText('2'); h.render(); h.button('common.save').props.onPress(); h.render();
  assert.equal(h.events.length, count);
  h.nodes().find(node => node.props?.onLongPress).props.onLongPress(); h.render();
  input().props.onChangeText('12'); h.render(); h.button('common.save').props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'task_time_updated');
  assert.equal(h.events.at(-1).params.change_direction, 'increase');
  assert.equal(h.events.at(-1).params.change_bucket, '5_15m');
  h.nodes().find(node => node.props?.onLongPress).props.onLongPress(); h.render();
  input().props.onChangeText('30'); h.render(); h.button('common.cancel').props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'time_editor_opened');
});

test('settings records permission results and actual changes, skips denied changes and unchanged values', async () => {
  const h = harness('app/settings.tsx');
  const toggle = () => h.nodes().find(node => node.type === 'Switch');
  h.setPermission({ granted: false, canAskAgain: false });
  await toggle().props.onValueChange(true); h.render();
  assert.equal(h.events.at(-1).name, 'notification_permission_result');
  assert.equal(h.events.some(event => event.name === 'reminder_setting_changed'), false);
  h.setPermission({ granted: true, canAskAgain: true });
  await toggle().props.onValueChange(true); h.render();
  assert.equal(h.events.at(-1).params.setting, 'start_enabled');
  h.button('reminders.daily').props.onPress(); h.render();
  assert.equal(h.events.at(-1).params.frequency, 'daily');
  const count = h.events.length;
  h.button('reminders.daily').props.onPress(); h.render();
  assert.equal(h.events.length, count);
  h.button('en').props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'language_changed');
  h.button('en').props.onPress(); h.render();
  assert.equal(h.events.length, count + 1);
});

test('category saves track the action and icon type without uploading labels; cancel and unchanged save do not emit', () => {
  const h = harness('app/settings.tsx');
  h.button('settings.addCategory').props.onPress(); h.render();
  const input = () => h.nodes().find(node => node.type === 'TextInput' && node.props.placeholder === 'settings.categoryNamePlaceholder');
  input().props.onChangeText('Secret name'); h.render();
  h.nodes().find(node => node.type === 'Pressable' && !node.props.accessibilityLabel && flatten(node.props.children).some(child => child.props?.children === 'common.cancel')).props.onPress(); h.render();
  assert.equal(h.events.length, 0);
  h.button('settings.addCategory').props.onPress(); h.render();
  input().props.onChangeText('Secret name'); h.render();
  h.button('common.save').props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'category_created');
  assert.equal(h.events.at(-1).params.icon_source, 'default');
  h.button('Private cat').props.onPress(); h.render();
  const count = h.events.length;
  h.button('common.save').props.onPress(); h.render();
  assert.equal(h.events.length, count);
  h.button('Private cat').props.onPress(); h.render();
  input().props.onChangeText('Changed name'); h.render();
  h.button('common.save').props.onPress(); h.render();
  assert.equal(h.events.at(-1).name, 'category_updated');
  assert.doesNotMatch(JSON.stringify(h.events), /Secret name|Private cat|Changed name/);
});
