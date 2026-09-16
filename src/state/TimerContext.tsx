import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveActivity } from 'expo-widgets';
import { Platform } from 'react-native';
import { createStarterTaskTags, isBuiltInTagId, isLegacyBuiltInLabel, tagColors, TaskTag, TaskTagId, uncategorizedTagId } from '../constants/taskTags';
import { todayKey } from '../utils/time';
import { getThreadFlowActivity, ThreadFlowActivityProps } from '../live/ThreadFlowActivity';
import { syncLongReminders, syncStartReminder } from '../services/reminders';
import { useI18n } from '../i18n';

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed';
export type Task = { id: string; title: string; createdAt: number; status: TaskStatus; elapsedDuration: number; allocatedDuration: number; completedAt?: number; day: string; tagId: TaskTagId; sortOrder: number };
export type BreakState = { startedAt: number; taskIds: string[] };
export type HintId = 'today-actions' | 'history-actions' | 'stats-allocation';
export type ReminderSettings = { startEnabled: boolean; startFrequency: 'weekdays' | 'daily'; startHour: number; startMinute: number; longEnabled: boolean };
type TimerState = { tasks: Task[]; categories: TaskTag[]; lastTimestamp: number; breakState?: BreakState; workSessionStartedAt?: number; lastTaskActivityAt?: number; breakReminderShown?: boolean; reminders: ReminderSettings; dismissedHints: HintId[] };
type TimerApi = TimerState & { ready: boolean; now: number; addTask: (title: string, tagId: TaskTagId) => void; start: (id: string) => void; pause: (id: string) => void; complete: (id: string) => void; restart: (id: string) => void; pauseAll: () => void; setReminders: (settings: ReminderSettings) => void; setReminderDebugActivity: (at?: number) => void; restoreHints: () => void; startBreak: () => void; endBreak: () => void; dismissBreakReminder: () => void; dismissHint: (hint: HintId) => void; copyLatestTasks: () => void; updateTask: (id: string, title: string, tagId: TaskTagId) => void; updateAllocatedDuration: (id: string, allocatedDuration: number) => void; addCategory: (label: string, iconUri?: string, systemIconId?: string) => void; updateCategory: (id: string, label: string, iconUri?: string, systemIconId?: string) => void; deleteCategory: (id: string) => void; remove: (id: string) => void };
const KEY = 'timeflow-v1'; const TimerContext = createContext<TimerApi | null>(null);
const defaultReminders: ReminderSettings = { startEnabled: false, startFrequency: 'weekdays', startHour: 9, startMinute: 0, longEnabled: false };
const initial: TimerState = { tasks: [], categories: createStarterTaskTags(), lastTimestamp: Date.now(), reminders: defaultReminders, dismissedHints: [] };

function activityDuration(duration: number) {
  const minutes = Math.max(0, Math.floor(duration / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function normalizeState(stored: Partial<TimerState>): TimerState {
  const sourceCategories = Array.isArray(stored.categories) && stored.categories.length ? stored.categories.map(category => {
    if (!isBuiltInTagId(category.id) || category.isCustomLabel) return category;
    if (isLegacyBuiltInLabel(category.id, category.label)) return { ...category, label: undefined, isCustomLabel: false };
    return category.label ? { ...category, isCustomLabel: true } : category;
  }) : createStarterTaskTags();
  const categories = sourceCategories.some(tag => tag.id === uncategorizedTagId) ? sourceCategories : [...sourceCategories, createStarterTaskTags().find(tag => tag.id === uncategorizedTagId)!];
  const categoryIds = new Set(categories.map(tag => tag.id));
  const validHintIds: HintId[] = ['today-actions', 'history-actions', 'stats-allocation'];
  const dismissedHints = Array.isArray(stored.dismissedHints) ? stored.dismissedHints.filter((hint): hint is HintId => validHintIds.includes(hint as HintId)) : [];
  const reminders = { ...defaultReminders, ...(stored.reminders ?? {}) };
  return { lastTimestamp: typeof stored.lastTimestamp === 'number' ? stored.lastTimestamp : Date.now(), categories, tasks: Array.isArray(stored.tasks) ? stored.tasks.map((task, index) => ({ ...task, sortOrder: typeof task.sortOrder === 'number' ? task.sortOrder : index, tagId: categoryIds.has(task.tagId) ? task.tagId : uncategorizedTagId })) : [], breakState: stored.breakState, workSessionStartedAt: stored.workSessionStartedAt, lastTaskActivityAt: stored.lastTaskActivityAt, breakReminderShown: stored.breakReminderShown, reminders, dismissedHints };
}

function taskGroup(status: TaskStatus) { return status === 'running' ? 'running' : status === 'completed' ? 'completed' : 'planned'; }
function groupLastOrder(tasks: Task[], day: string, status: TaskStatus, excludingId?: string) { return tasks.reduce((last, task) => task.id !== excludingId && task.day === day && taskGroup(task.status) === taskGroup(status) ? Math.max(last, task.sortOrder) : last, -1); }
function groupFirstOrder(tasks: Task[], day: string, status: TaskStatus) { return tasks.reduce((first, task) => task.day === day && taskGroup(task.status) === taskGroup(status) ? Math.min(first, task.sortOrder) : first, 0); }
function latestTaskDay(tasks: Task[], today: string) { return tasks.reduce<string | undefined>((latest, task) => task.day < today && (!latest || task.day > latest) ? task.day : latest, undefined); }

function nextMidnight(time: number) {
  const date = new Date(time);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

function addElapsed(tasks: Task[], activeIds: Set<string>, duration: number) {
  if (!activeIds.size || !duration) return tasks;
  const active = tasks.filter(task => activeIds.has(task.id));
  const base = Math.floor(duration / active.length); const remainder = duration % active.length;
  return tasks.map(task => {
    const index = active.findIndex(item => item.id === task.id);
    return index < 0 ? task : { ...task, elapsedDuration: task.elapsedDuration + duration, allocatedDuration: task.allocatedDuration + base + (index < remainder ? 1 : 0) };
  });
}

/**
 * Settles time in local-day segments. A running task can only receive time on
 * the day it belongs to; once that day ends it is paused and never continued.
 */
function settleTimerState(source: TimerState, at: number): TimerState {
  let tasks = source.tasks; let cursor = Math.min(source.lastTimestamp, at);
  let breakState = source.breakState;
  const crossedDay = todayKey(source.lastTimestamp) !== todayKey(at);
  while (cursor < at) {
    const segmentEnd = Math.min(nextMidnight(cursor), at);
    const day = todayKey(cursor);
    if (!breakState) {
      const activeIds = new Set(tasks.filter(task => task.status === 'running' && task.day === day).map(task => task.id));
      tasks = addElapsed(tasks, activeIds, segmentEnd - cursor);
    }
    cursor = segmentEnd;
    if (cursor < at) {
      const currentDay = todayKey(cursor);
      tasks = tasks.map(task => task.status === 'running' && task.day < currentDay ? { ...task, status: 'paused' } : task);
      // A break and a continuous-work session never survive a day boundary.
      breakState = undefined;
    }
  }
  const currentDay = todayKey(at);
  tasks = tasks.map(task => task.status === 'running' && task.day < currentDay ? { ...task, status: 'paused' } : task);
  const hasRunningToday = tasks.some(task => task.status === 'running' && task.day === currentDay);
  const workSessionIsToday = source.workSessionStartedAt && todayKey(source.workSessionStartedAt) === currentDay;
  return {
    ...source,
    lastTimestamp: at,
    tasks,
    breakState: crossedDay ? undefined : breakState,
    workSessionStartedAt: hasRunningToday && workSessionIsToday && !crossedDay ? source.workSessionStartedAt : undefined,
    breakReminderShown: hasRunningToday && workSessionIsToday && !crossedDay ? source.breakReminderShown : false,
  };
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<TimerState>(initial); const [ready, setReady] = useState(false); const [now, setNow] = useState(Date.now());
  const liveActivity = useRef<LiveActivity<ThreadFlowActivityProps> | null>(null);
  useEffect(() => { AsyncStorage.getItem(KEY).then(value => { if (value) setState(settleTimerState(normalizeState(JSON.parse(value) as Partial<TimerState>), Date.now())); setReady(true); }).catch(() => setReady(true)); }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)); }, [state, ready]);
  useEffect(() => { const id = setInterval(() => { const at = Date.now(); setNow(at); setState(old => todayKey(old.lastTimestamp) !== todayKey(at) || old.tasks.some(task => task.status === 'running' && task.day < todayKey(at)) ? settleTimerState(old, at) : old); }, 1000); return () => clearInterval(id); }, []);
  const running = state.tasks.filter(task => task.status === 'running');
  const reminderCopy = useMemo(() => ({ startTitle: t('reminders.startTitle'), startBody: t('reminders.startBody'), twoHourTitle: t('reminders.twoHourTitle'), twoHourBody: t('reminders.twoHourBody'), threeHourTitle: t('reminders.threeHourTitle'), threeHourBody: t('reminders.threeHourBody') }), [locale, t]);
  useEffect(() => {
    if (!ready) return;
    syncStartReminder(state.reminders.startEnabled, state.reminders.startFrequency, state.reminders.startHour, state.reminders.startMinute, reminderCopy).catch(() => undefined);
  }, [ready, state.reminders.startEnabled, state.reminders.startFrequency, state.reminders.startHour, state.reminders.startMinute, reminderCopy]);
  useEffect(() => {
    if (!ready) return;
    syncLongReminders(state.reminders.longEnabled, running.length > 0, state.lastTaskActivityAt, reminderCopy).catch(() => undefined);
  }, [ready, state.reminders.longEnabled, state.lastTaskActivityAt, running.length, reminderCopy]);
  useEffect(() => {
    if (!ready) return;
    if (Platform.OS !== 'ios') return;
    const ThreadFlowActivity = getThreadFlowActivity();
    if (!ThreadFlowActivity) return;
    const liveElapsedShare = running.length && !state.breakState ? Math.max(0, now - state.lastTimestamp) / running.length : 0;
    const liveTasks = running.map(task => ({ id: task.id, title: task.title, actualDuration: activityDuration(task.allocatedDuration + liveElapsedShare) }));
    const firstTask = liveTasks[0];
    const props: ThreadFlowActivityProps = { taskLabel: firstTask?.title ?? '', tasksInProgressLabel: t('liveActivity.tasksInProgress', { count: running.length }), taskCount: running.length, startedAt: new Date(state.workSessionStartedAt ?? Date.now()).toISOString(), tasks: liveTasks };
    const instances = ThreadFlowActivity.getInstances();
    if (!running.length || state.breakState) {
      Promise.all(instances.map(instance => instance.end('immediate'))).catch(() => undefined);
      liveActivity.current = null;
      return;
    }
    const instance = liveActivity.current ?? instances[0] ?? ThreadFlowActivity.start(props, 'threadflow://today');
    liveActivity.current = instance;
    instance.update(props).catch(() => undefined);
  }, [ready, running.length, running[0]?.title, state.breakState, state.workSessionStartedAt, Math.floor(now / 60000), locale, t]);
  const mutate = (id: string, status: TaskStatus) => setState(old => { const at = Date.now(); if (old.breakState) return old; const next = settleTimerState(old, at); const today = todayKey(at); const target = next.tasks.find(task => task.id === id); if (!target || (status === 'running' && target.day !== today)) return next; const sortOrder = groupLastOrder(next.tasks, target.day, status, id) + 1; const tasks = next.tasks.map(t => t.id === id ? { ...t, status, sortOrder, completedAt: status === 'completed' ? at : t.completedAt } : t); const hasRunning = tasks.some(task => task.status === 'running'); return { ...next, tasks, lastTaskActivityAt: hasRunning ? at : undefined, workSessionStartedAt: hasRunning ? (next.workSessionStartedAt ?? at) : undefined, breakReminderShown: hasRunning ? next.breakReminderShown : false }; });
  const api = useMemo<TimerApi>(() => ({ ...state, ready, now,
    addTask: (title, tagId) => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); const day = todayKey(at); const validTagId = next.categories.some(tag => tag.id === tagId) ? tagId : uncategorizedTagId; return { ...next, tasks: [{ id: `${at}-${Math.random()}`, title: title.trim(), createdAt: at, status: 'pending', elapsedDuration: 0, allocatedDuration: 0, day, tagId: validTagId, sortOrder: groupFirstOrder(next.tasks, day, 'pending') - 1 }, ...next.tasks] }; }),
    start: id => mutate(id, 'running'), pause: id => mutate(id, 'paused'), complete: id => mutate(id, 'completed'),
    restart: id => setState(old => { const at = Date.now(); if (old.breakState) return old; const next = settleTimerState(old, at); const today = todayKey(at); const task = next.tasks.find(item => item.id === id); if (!task || task.day !== today) return next; const sortOrder = groupLastOrder(next.tasks, today, 'running', id) + 1; return { ...next, tasks: next.tasks.map(item => item.id === id ? { ...item, status: 'running', sortOrder, completedAt: undefined } : item), lastTaskActivityAt: at, workSessionStartedAt: next.workSessionStartedAt ?? at }; }),
    pauseAll: () => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); if (!next.tasks.some(task => task.status === 'running')) return next; return { ...next, tasks: next.tasks.map(task => task.status === 'running' ? { ...task, status: 'paused' as TaskStatus } : task), lastTaskActivityAt: undefined, workSessionStartedAt: undefined, breakReminderShown: false }; }),
    setReminders: reminders => setState(old => ({ ...old, reminders })),
    setReminderDebugActivity: at => setState(old => ({ ...old, lastTaskActivityAt: at })),
    restoreHints: () => setState(old => old.dismissedHints.length ? { ...old, dismissedHints: [] } : old),
    startBreak: () => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); if (next.breakState || !next.tasks.some(task => task.status === 'running')) return next; return { ...next, breakState: { startedAt: at, taskIds: next.tasks.filter(task => task.status === 'running').map(task => task.id) }, lastTaskActivityAt: at, breakReminderShown: true }; }),
    endBreak: () => setState(old => { if (!old.breakState) return old; const at = Date.now(); const next = settleTimerState(old, at); const today = todayKey(at); const tasks = next.tasks.map(task => task.status === 'running' && task.day < today ? { ...task, status: 'paused' as TaskStatus } : task); const hasRunning = tasks.some(task => task.status === 'running'); return { ...next, tasks, lastTimestamp: at, breakState: undefined, lastTaskActivityAt: hasRunning ? at : undefined, workSessionStartedAt: hasRunning ? at : undefined, breakReminderShown: false }; }),
    dismissBreakReminder: () => setState(old => ({ ...old, breakReminderShown: true })),
    dismissHint: hint => setState(old => old.dismissedHints.includes(hint) ? old : { ...old, dismissedHints: [...old.dismissedHints, hint] }),
    copyLatestTasks: () => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); const today = todayKey(at); if (next.tasks.some(task => task.day === today)) return next; const sourceDay = latestTaskDay(next.tasks, today); if (!sourceDay) return next; const copies = next.tasks.filter(task => task.day === sourceDay).map((task, index): Task => ({ id: `${at}-${index}-${Math.random()}`, title: task.title, createdAt: at, status: 'pending', elapsedDuration: 0, allocatedDuration: 0, day: today, tagId: next.categories.some(tag => tag.id === task.tagId) ? task.tagId : uncategorizedTagId, sortOrder: index })); return { ...next, tasks: [...copies, ...next.tasks] }; }),
    updateTask: (id, title, tagId) => setState(old => { const next = settleTimerState(old, Date.now()); const validTagId = next.categories.some(tag => tag.id === tagId) ? tagId : uncategorizedTagId; return { ...next, tasks: next.tasks.map(task => task.id === id ? { ...task, title: title.trim(), tagId: validTagId } : task) }; }),
    updateAllocatedDuration: (id, allocatedDuration) => setState(old => {
      const next = settleTimerState(old, Date.now());
      const target = next.tasks.find(task => task.id === id);
      if (!target) return next;
      // Manually recorded time means the task has been worked on, but it must
      // not silently become a live timer.
      const status: TaskStatus = target.status === 'pending' && target.allocatedDuration === 0 && allocatedDuration > 0 ? 'paused' : target.status;
      const sortOrder = status === target.status ? target.sortOrder : groupLastOrder(next.tasks, target.day, status, id) + 1;
      return { ...next, tasks: next.tasks.map(task => task.id === id ? { ...task, allocatedDuration, status, sortOrder } : task) };
    }),
    addCategory: (label, iconUri, systemIconId) => setState(old => { const trimmed = label.trim().slice(0, 12); if (!trimmed) return old; const next = settleTimerState(old, Date.now()); const color = tagColors[next.categories.filter(tag => tag.id !== uncategorizedTagId).length % tagColors.length]; return { ...next, categories: [...next.categories.filter(tag => tag.id !== uncategorizedTagId), { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: trimmed, isCustomLabel: true, color, iconUri, systemIconId }, next.categories.find(tag => tag.id === uncategorizedTagId)!] }; }),
    updateCategory: (id, label, iconUri, systemIconId) => setState(old => { if (id === uncategorizedTagId) return old; const next = settleTimerState(old, Date.now()); return { ...next, categories: next.categories.map(tag => tag.id === id ? { ...tag, label: label.trim().slice(0, 12) || tag.label, isCustomLabel: true, iconUri, systemIconId } : tag) }; }),
    deleteCategory: id => setState(old => { if (id === uncategorizedTagId || !old.categories.some(tag => tag.id === id)) return old; const next = settleTimerState(old, Date.now()); return { ...next, categories: next.categories.filter(tag => tag.id !== id), tasks: next.tasks.map(task => task.tagId === id ? { ...task, tagId: uncategorizedTagId } : task) }; }),
    remove: id => setState(old => { const next = settleTimerState(old, Date.now()); return { ...next, tasks: next.tasks.filter(t => t.id !== id) }; })
  }), [state, ready, now]);
  return <TimerContext.Provider value={api}>{children}</TimerContext.Provider>;
}
export function useTimer() { const value = useContext(TimerContext); if (!value) throw new Error('TimerProvider missing'); return value; }
export function liveTask(task: Task, state: TimerState, now: number) { return settleTimerState(state, now).tasks.find(item => item.id === task.id) ?? task; }
