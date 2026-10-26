import type { LanguageMode } from '../i18n';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type DurationBucket = 'under_1m' | '1_5m' | '5_15m' | '15_30m' | '30_60m' | '60m_plus';
type TimerParams = { active_task_count?: number; timer_duration_bucket?: DurationBucket };
type Period = 'week' | 'month';
type Scope = 'period' | 'selected_day';
type CategoryKind = 'built_in' | 'custom';
type DayAge = 'today' | 'last_7_days' | 'last_30_days' | 'older' | 'future';
// Extend this map and the runtime whitelist together for future Pro / Todo events.
export type AnalyticsEvents = {
  time_editor_opened: { day_age_bucket: DayAge };
  task_time_updated: { change_direction: 'increase' | 'decrease'; change_bucket: DurationBucket; day_age_bucket: DayAge };
  task_updated: { entry_source: 'today' | 'history'; name_changed: boolean; category_changed: boolean };
  task_deleted: { entry_source: 'today' | 'history'; task_status: 'pending' | 'running' | 'paused' | 'completed' };
  task_duplicate_blocked: { entry_source: 'create' | 'today_edit' | 'history_edit' };
  break_started: { active_task_count: number };
  break_ended: { timer_duration_bucket: DurationBucket };
  reminder_setting_changed: { setting: 'start_enabled' | 'long_enabled' | 'frequency' | 'time'; enabled?: boolean; frequency?: 'weekdays' | 'daily'; time_of_day?: 'night' | 'morning' | 'afternoon' | 'evening' };
  notification_permission_result: { granted: boolean; can_ask_again: boolean };
  category_created: { icon_source: 'photo' | 'built_in' | 'default' };
  category_updated: { icon_source: 'photo' | 'built_in' | 'default' };
  category_deleted: { category_kind: CategoryKind; has_tasks: boolean };
  language_changed: { language_mode: LanguageMode };
  stats_period_changed: { period: Period };
  stats_period_navigated: { period: Period; direction: 'previous' | 'next' | 'reset'; is_current_period: boolean };
  stats_day_selected: { period: Period; day_age_bucket: DayAge; has_data: boolean };
  stats_overview_selected: { period: Period };
  stats_category_expanded: { period: Period; scope: Scope; category_kind: CategoryKind; task_count: number };
  history_day_expanded: { day_age_bucket: DayAge; task_count: number };
  review_request_attempted: Record<string, never>;
  review_request_failed: Record<string, never>;
  app_open: { entry_source?: 'cold_start' | 'foreground' };
  task_created: { task_count?: number; entry_source?: 'manual' | 'copy_latest' };
  timer_started: { active_task_count?: number; entry_source?: 'start' | 'resume' | 'restart' };
  timer_paused: TimerParams;
  timer_completed: TimerParams;
  history_viewed: Record<string, never>;
  stats_viewed: Record<string, never>;
  settings_viewed: Record<string, never>;
};
type EventName = keyof AnalyticsEvents;
type SafeParams = Record<string, string | number>;

const allowed: Record<EventName, readonly string[]> = {
  time_editor_opened: ['day_age_bucket'],
  task_time_updated: ['change_direction', 'change_bucket', 'day_age_bucket'],
  task_updated: ['entry_source', 'name_changed', 'category_changed'],
  task_deleted: ['entry_source', 'task_status'],
  task_duplicate_blocked: ['entry_source'],
  break_started: ['active_task_count'], break_ended: ['timer_duration_bucket'],
  reminder_setting_changed: ['setting', 'enabled', 'frequency', 'time_of_day'],
  notification_permission_result: ['granted', 'can_ask_again'],
  category_created: ['icon_source'], category_updated: ['icon_source'],
  category_deleted: ['category_kind', 'has_tasks'], language_changed: ['language_mode'],
  stats_period_changed: ['period'],
  stats_period_navigated: ['period', 'direction', 'is_current_period'],
  stats_day_selected: ['period', 'day_age_bucket', 'has_data'],
  stats_overview_selected: ['period'],
  stats_category_expanded: ['period', 'scope', 'category_kind', 'task_count'],
  history_day_expanded: ['day_age_bucket', 'task_count'],
  review_request_attempted: [], review_request_failed: [],
  app_open: ['entry_source'],
  task_created: ['task_count', 'entry_source'],
  timer_started: ['active_task_count', 'entry_source'],
  timer_paused: ['active_task_count', 'timer_duration_bucket'],
  timer_completed: ['active_task_count', 'timer_duration_bucket'],
  history_viewed: [], stats_viewed: [], settings_viewed: [],
};
const sources: Partial<Record<EventName, readonly string[]>> = {
  app_open: ['cold_start', 'foreground'],
  task_created: ['manual', 'copy_latest'],
  timer_started: ['start', 'resume', 'restart'],
  task_updated: ['today', 'history'], task_deleted: ['today', 'history'],
  task_duplicate_blocked: ['create', 'today_edit', 'history_edit'],
};
const languages = ['zh-CN', 'zh-Hant', 'en', 'fr', 'es', 'pt-BR', 'it', 'ru', 'tr', 'id', 'ja', 'ko', 'de'];
const enums: Record<string, readonly string[]> = {
  period: ['week', 'month'], scope: ['period', 'selected_day'],
  category_kind: ['built_in', 'custom'], day_age_bucket: ['today', 'last_7_days', 'last_30_days', 'older', 'future'],
  change_direction: ['increase', 'decrease'], task_status: ['pending', 'running', 'paused', 'completed'],
  setting: ['start_enabled', 'long_enabled', 'frequency', 'time'], frequency: ['weekdays', 'daily'],
  time_of_day: ['night', 'morning', 'afternoon', 'evening'], icon_source: ['photo', 'built_in', 'default'],
  language_mode: ['auto', ...languages], direction: ['previous', 'next', 'reset'],
};
const booleanKeys = ['name_changed', 'category_changed', 'enabled', 'granted', 'can_ask_again', 'has_tasks', 'has_data', 'is_current_period'];
const buckets: readonly DurationBucket[] = ['under_1m', '1_5m', '5_15m', '15_30m', '30_60m', '60m_plus'];
let locale = 'en';
type Sender = (event: EventName, params: SafeParams) => Promise<void>;
let senderPromise: Promise<Sender | null> | undefined;

export function setAnalyticsLocale(value: string) {
  // Only app-supported language codes, never user-provided text.
  if (languages.includes(value)) locale = value;
}

/** Local calendar distance, without sending the date or being affected by DST. */
export function dayAgeBucket(day: string, now = Date.now()): DayAge {
  const date = new Date(now);
  const [year, month, dateOfMonth] = day.split('-').map(Number);
  const age = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(year, month - 1, dateOfMonth)) / 86400000;
  return age < 0 ? 'future' : age === 0 ? 'today' : age < 7 ? 'last_7_days' : age < 30 ? 'last_30_days' : 'older';
}

export function reminderTimeOfDay(hour: number): 'night' | 'morning' | 'afternoon' | 'evening' {
  return hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

export function timerDurationBucket(milliseconds: number): DurationBucket {
  const minutes = Math.max(0, milliseconds) / 60000;
  return buckets[[1, 5, 15, 30, 60].findIndex(limit => minutes < limit)] ?? '60m_plus';
}

function safeParams(event: EventName, params: object): SafeParams {
  const result: SafeParams = { app_version: Constants.expoConfig?.version ?? 'unknown', locale };
  for (const [key, value] of Object.entries(params)) {
    if (!allowed[event].includes(key)) continue;
    if ((key === 'task_count' || key === 'active_task_count') && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) result[key] = value;
    if (key === 'entry_source' && typeof value === 'string' && sources[event]?.includes(value)) result[key] = value;
    if (key === 'timer_duration_bucket' && buckets.includes(value as DurationBucket)) result[key] = value;
    if (key === 'change_bucket' && buckets.includes(value as DurationBucket)) result[key] = value;
    if (booleanKeys.includes(key) && typeof value === 'boolean') result[key] = Number(value);
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(enums, key) && enums[key].includes(value)) result[key] = value;
  }
  return result;
}

async function loadSender(): Promise<Sender | null> {
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !Constants.expoConfig?.extra?.analytics?.firebaseEnabled) return null;
  try {
    // Runtime import: Expo Go must never evaluate RN Firebase's native modules.
    const { getAnalytics } = await import('@react-native-firebase/analytics');
    // RNFB 26's modular logEvent helper discards the native Promise. Use the
    // instance method inside this adapter so native rejections remain catchable.
    const analytics = getAnalytics() as unknown as { logEvent: Sender };
    return (event, params) => analytics.logEvent(event, params);
  } catch {
    if (__DEV__) console.info('[analytics] Firebase unavailable; using console mode.');
    return null;
  }
}

/** Fire-and-forget, never rejects into app code. Logs contain only sanitized values. */
export function track<E extends EventName>(event: E, params?: AnalyticsEvents[E]): void {
  try {
    if (!Object.prototype.hasOwnProperty.call(allowed, event)) return;
    const payload = safeParams(event, params ?? {});
    if (__DEV__) console.info('[analytics] track', event, payload);
    senderPromise ??= loadSender();
    void senderPromise.then(async sender => {
      if (!sender) {
        if (__DEV__) console.info('[analytics] console-only', event);
        return;
      }
      await sender(event, payload);
      if (__DEV__) console.info('[analytics] SDK accepted', event);
    }).catch(() => {
      if (__DEV__) console.info('[analytics] send failed', event);
    });
  } catch {
    // Analytics must not interrupt any app action, including in unsupported runtimes.
  }
}
