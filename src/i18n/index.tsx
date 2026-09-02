import { I18n } from 'i18n-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocales } from 'expo-localization';

export type AppLocale = 'zh-CN' | 'en';
export type LanguageMode = 'auto' | AppLocale;
const LANGUAGE_MODE_KEY = 'timeflow-language-mode';

const translations = {
  en: {
    app: { name: 'ThreadFlow' },
    tabs: { today: 'Today', history: 'History', stats: 'Stats' },
    common: { cancel: 'Cancel', save: 'Save', delete: 'Delete', settings: 'Settings', task: 'task', tasks: 'tasks' },
    hints: { dismiss: 'Dismiss hint', todayActions: 'Tap a task name to edit it. Swipe left to delete.', historyActions: 'Tap a task name to edit it. Long press to adjust actual time. Swipe left to delete.' },
    today: {
      actualTime: 'Actual time today', completed: 'Completed %{count} %{taskWord}', addPlaceholder: 'Add something to do today',
      chooseCategory: 'Choose a category', createNow: 'Choose one to create it now', copyLatestTasks: 'Copy %{count} task(s) from the latest day',
      running: 'In progress · %{count}', allocation: 'Each gets %{share}% of actual time', next: 'Up next', pending: 'To start',
      completedSection: 'Completed today · %{count}', emptyTitle: 'Start with one small thing', emptyText: 'Write it down, tap start, and let time leave a trace.',
      editTask: 'Edit task', taskName: 'Task name', taskCategory: 'Task category', createTask: 'Create %{label} task', chooseTaskCategory: 'Choose %{label} category',
    },
    task: { edit: 'Edit %{title}', start: 'Start', resume: 'Resume', pause: 'Pause', complete: 'Complete', restart: 'Restart', delete: 'Delete', runningTime: 'Running time', actualTime: 'Actual time' },
    history: {
      title: 'History', subtitle: 'Look back at what you did each day', completed: 'Completed', invested: 'Actual time', editHint: 'Long press to edit the recorded time',
      emptyTitle: 'Your history will appear here', emptyText: 'Finish a task to leave a memory of the day.', editTime: 'Edit recorded time', actualMinutes: 'Actual time (minutes)', invalidMinutes: 'Enter a whole number of 0 or more.',
      statuses: { completed: 'Completed', running: 'In progress', paused: 'Ran', pending: 'Not started' },
    },
    stats: {
      title: 'Stats', subtitle: 'See where your time goes', today: 'Today', last7Days: 'Last 7 days', categoryBreakdown: 'Category breakdown', actualTime: 'Actual time',
      noChartData: 'Start recording and your time trail will grow here.', noCategoryData: 'No categorized time to show yet.', noDoubleCountTitle: 'Time is never double-counted',
      noDoubleCountText: 'When several tasks run together, each period of real time is split evenly between the active tasks.',
    },
    settings: {
      title: 'Settings', categoryManagement: 'Category management', categoryNote: 'Categories are used in task lists and time statistics.', systemCategory: 'Default system category. It cannot be edited or deleted.', taskCount: '%{count} %{taskWord}',
      addCategory: 'Add category', editCategory: 'Edit category', categoryName: 'Category name', categoryNamePlaceholder: 'For example: Reading', categoryIcon: 'Category icon',
      chooseFromPhotos: 'Choose from photos', compressing: 'Compressing…', removeIcon: 'Remove icon', systemIcon: 'System icon', iconHelp: 'Photos are cropped square and compressed to a 128px image stored only on this device.',
      deleteTitle: 'Delete “%{label}”?', deleteWithTasks: '%{count} task(s) will move to Uncategorized. Tasks and timers will not be deleted.', deleteWithoutTasks: 'This will not affect any tasks.', photoPermissionTitle: 'Photo library access needed', photoPermissionText: 'Allow photo library access to choose a category icon.', iconProcessFailedTitle: 'Could not process icon', iconProcessFailedText: 'Try another image.',
    },
    tags: { work: 'Work', study: 'Study', exercise: 'Exercise', life: 'Life', uncategorized: 'Uncategorized' },
  },
  'zh-CN': {
    hints: { dismiss: '\u5173\u95ed\u63d0\u793a', todayActions: '\u70b9\u51fb\u4efb\u52a1\u540d\u79f0\u53ef\u7f16\u8f91\uff1b\u5de6\u6ed1\u53ef\u5220\u9664\u3002', historyActions: '\u70b9\u51fb\u4efb\u52a1\u540d\u79f0\u53ef\u7f16\u8f91\uff1b\u957f\u6309\u53ef\u8c03\u6574\u5b9e\u9645\u6295\u5165\u65f6\u957f\uff1b\u5de6\u6ed1\u53ef\u5220\u9664\u3002' },
    app: { name: '时流' },
    tabs: { today: '今天', history: '记录', stats: '统计' },
    common: { cancel: '取消', save: '保存', delete: '删除', settings: '设置', task: '件任务', tasks: '件任务' },
    today: {
      actualTime: '今日实际投入', completed: '已完成 %{count} 件', addPlaceholder: '添加一件今天要做的事',
      chooseCategory: '选择任务分类', createNow: '选择后立即创建', copyLatestTasks: '复制最近有任务日的 %{count} 件任务',
      running: '正在进行 · %{count}', allocation: '各获得 %{share}% 实际时间', next: '接下来', pending: '待开始',
      completedSection: '今天完成 · %{count}', emptyTitle: '从一件小事开始', emptyText: '写下它，轻点开始，让时间留下痕迹。',
      editTask: '编辑任务', taskName: '任务名称', taskCategory: '任务分类', createTask: '创建 %{label} 任务', chooseTaskCategory: '选择 %{label} 分类',
    },
    task: { edit: '编辑 %{title}', start: '开始', resume: '继续', pause: '暂停', complete: '完成', restart: '重启', delete: '删除', runningTime: '运行时间', actualTime: '实际投入' },
    history: {
      title: '记录', subtitle: '回看每天做过的事', completed: '完成', invested: '投入', editHint: '长按可修改记录时间',
      emptyTitle: '记录会在这里慢慢出现', emptyText: '完成一件事，留下一天的回忆。', editTime: '修改记录时间', actualMinutes: '实际投入（分钟）', invalidMinutes: '请输入不小于 0 的整数分钟。',
      statuses: { completed: '已完成', running: '进行中', paused: '已运行', pending: '未开始' },
    },
    stats: {
      title: '统计', subtitle: '看看时间都花在了哪里', today: '今天', last7Days: '最近 7 天', categoryBreakdown: '分类分布', actualTime: '实际投入',
      noChartData: '开始记录后，这里会长出你的时间轨迹。', noCategoryData: '还没有可按分类统计的投入时间。', noDoubleCountTitle: '时间不会被重复计算',
      noDoubleCountText: '多件事同时进行时，每一段真实经过的时间会自动平分给正在运行的任务。',
    },
    settings: {
      title: '设置', categoryManagement: '分类管理', categoryNote: '分类会用于任务列表和时间统计。', systemCategory: '系统默认分类，不可修改或删除', taskCount: '%{count} 件任务',
      addCategory: '添加分类', editCategory: '编辑分类', categoryName: '分类名称', categoryNamePlaceholder: '例如：阅读', categoryIcon: '分类图标',
      chooseFromPhotos: '从相册选择', compressing: '正在压缩…', removeIcon: '移除图标', systemIcon: '系统图标', iconHelp: '相册图片会裁切为正方形，并压缩为 128px 小图后仅保存在本机。',
      deleteTitle: '删除“%{label}”？', deleteWithTasks: '%{count} 个任务将转为未分类，任务和计时不会删除。', deleteWithoutTasks: '此操作不会影响任何任务。', photoPermissionTitle: '需要相册权限', photoPermissionText: '允许访问相册后才能选择分类图标。', iconProcessFailedTitle: '图标处理失败', iconProcessFailedText: '请换一张图片后重试。',
    },
    tags: { work: '工作', study: '学习', exercise: '运动', life: '生活', uncategorized: '未分类' },
  },
} as const;

type Translate = (key: string, options?: Record<string, string | number>) => string;
type I18nContextValue = { locale: AppLocale; languageMode: LanguageMode; setLanguageMode: (mode: LanguageMode) => void; t: Translate };
const I18nContext = createContext<I18nContextValue | null>(null);

export function resolveAppLocale(regionCode: string | null | undefined): AppLocale {
  return regionCode?.toUpperCase() === 'CN' ? 'zh-CN' : 'en';
}

export function languageModeLabel(mode: LanguageMode, locale: AppLocale) {
  if (mode === 'auto') return locale === 'zh-CN' ? '自动（跟随地区）' : 'Automatic (region)';
  return mode === 'zh-CN' ? '简体中文' : 'English';
}

export function languageSettingsCopy(locale: AppLocale) {
  return locale === 'zh-CN'
    ? { title: '语言', subtitle: '选择应用显示语言', automatic: '自动（跟随地区）', chinese: '简体中文', english: 'English' }
    : { title: 'Language', subtitle: 'Choose the app display language', automatic: 'Automatic (region)', chinese: '简体中文', english: 'English' };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locales = useLocales();
  const [languageMode, setStoredLanguageMode] = useState<LanguageMode>('auto');
  useEffect(() => { AsyncStorage.getItem(LANGUAGE_MODE_KEY).then(value => { if (value === 'zh-CN' || value === 'en' || value === 'auto') setStoredLanguageMode(value); }).catch(() => undefined); }, []);
  const automaticLocale = resolveAppLocale(locales[0]?.regionCode);
  const locale = languageMode === 'auto' ? automaticLocale : languageMode;
  const setLanguageMode = (mode: LanguageMode) => { setStoredLanguageMode(mode); AsyncStorage.setItem(LANGUAGE_MODE_KEY, mode).catch(() => undefined); };
  const value = useMemo<I18nContextValue>(() => {
    const i18n = new I18n(translations);
    i18n.locale = locale;
    i18n.defaultLocale = 'en';
    i18n.enableFallback = true;
    return { locale, languageMode, setLanguageMode, t: (key, options) => i18n.t(key, options) };
  }, [locale, languageMode]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18nProvider missing');
  return value;
}

export function formatShortTime(ms: number, locale: AppLocale) {
  const minutes = Math.round(ms / 60000);
  if (locale === 'zh-CN') {
    if (!minutes) return '0 分钟';
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}` : `${minutes} 分钟`;
  }
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`;
}

export function formatDayLabel(locale: AppLocale, date = new Date()) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

export function formatHistoryDay(locale: AppLocale, day: string) {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${day}T12:00:00`));
}

export function formatWeekday(locale: AppLocale, day: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(`${day}T12:00:00`));
}
