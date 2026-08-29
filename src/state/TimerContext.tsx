import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { createStarterTaskTags, isBuiltInTagId, isLegacyBuiltInLabel, tagColors, TaskTag, TaskTagId, uncategorizedTagId } from '../constants/taskTags';
import { todayKey, yesterdayKey } from '../utils/time';

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed';
export type Task = { id: string; title: string; createdAt: number; status: TaskStatus; elapsedDuration: number; allocatedDuration: number; completedAt?: number; day: string; tagId: TaskTagId; sortOrder: number };
type TimerState = { tasks: Task[]; categories: TaskTag[]; lastTimestamp: number };
type TimerApi = TimerState & { ready: boolean; now: number; addTask: (title: string, tagId: TaskTagId) => void; start: (id: string) => void; pause: (id: string) => void; complete: (id: string) => void; restart: (id: string) => void; copyYesterday: () => void; updateTask: (id: string, title: string, tagId: TaskTagId) => void; updateAllocatedDuration: (id: string, allocatedDuration: number) => void; reorderTasks: (taskIds: string[]) => void; addCategory: (label: string, iconUri?: string, systemIconId?: string) => void; updateCategory: (id: string, label: string, iconUri?: string, systemIconId?: string) => void; deleteCategory: (id: string) => void; remove: (id: string) => void };
const KEY = 'timeflow-v1'; const TimerContext = createContext<TimerApi | null>(null);
const initial: TimerState = { tasks: [], categories: createStarterTaskTags(), lastTimestamp: Date.now() };

function normalizeState(stored: Partial<TimerState>): TimerState {
  const sourceCategories = Array.isArray(stored.categories) && stored.categories.length ? stored.categories.map(category => {
    if (!isBuiltInTagId(category.id) || category.isCustomLabel) return category;
    if (isLegacyBuiltInLabel(category.id, category.label)) return { ...category, label: undefined, isCustomLabel: false };
    return category.label ? { ...category, isCustomLabel: true } : category;
  }) : createStarterTaskTags();
  const categories = sourceCategories.some(tag => tag.id === uncategorizedTagId) ? sourceCategories : [...sourceCategories, createStarterTaskTags().find(tag => tag.id === uncategorizedTagId)!];
  const categoryIds = new Set(categories.map(tag => tag.id));
  return { lastTimestamp: typeof stored.lastTimestamp === 'number' ? stored.lastTimestamp : Date.now(), categories, tasks: Array.isArray(stored.tasks) ? stored.tasks.map((task, index) => ({ ...task, sortOrder: typeof task.sortOrder === 'number' ? task.sortOrder : index, tagId: categoryIds.has(task.tagId) ? task.tagId : uncategorizedTagId })) : [] };
}

function taskGroup(status: TaskStatus) { return status === 'running' ? 'running' : status === 'completed' ? 'completed' : 'planned'; }
function groupLastOrder(tasks: Task[], day: string, status: TaskStatus, excludingId?: string) { return tasks.reduce((last, task) => task.id !== excludingId && task.day === day && taskGroup(task.status) === taskGroup(status) ? Math.max(last, task.sortOrder) : last, -1); }
function groupFirstOrder(tasks: Task[], day: string, status: TaskStatus) { return tasks.reduce((first, task) => task.day === day && taskGroup(task.status) === taskGroup(status) ? Math.min(first, task.sortOrder) : first, 0); }

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
  while (cursor < at) {
    const segmentEnd = Math.min(nextMidnight(cursor), at);
    const day = todayKey(cursor);
    const activeIds = new Set(tasks.filter(task => task.status === 'running' && task.day === day).map(task => task.id));
    tasks = addElapsed(tasks, activeIds, segmentEnd - cursor);
    cursor = segmentEnd;
    if (cursor < at) {
      const currentDay = todayKey(cursor);
      tasks = tasks.map(task => task.status === 'running' && task.day < currentDay ? { ...task, status: 'paused' } : task);
    }
  }
  const currentDay = todayKey(at);
  tasks = tasks.map(task => task.status === 'running' && task.day < currentDay ? { ...task, status: 'paused' } : task);
  return { ...source, lastTimestamp: at, tasks };
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(initial); const [ready, setReady] = useState(false); const [now, setNow] = useState(Date.now());
  useEffect(() => { AsyncStorage.getItem(KEY).then(value => { if (value) setState(settleTimerState(normalizeState(JSON.parse(value) as Partial<TimerState>), Date.now())); setReady(true); }).catch(() => setReady(true)); }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)); }, [state, ready]);
  useEffect(() => { const id = setInterval(() => { const at = Date.now(); setNow(at); setState(old => todayKey(old.lastTimestamp) !== todayKey(at) || old.tasks.some(task => task.status === 'running' && task.day < todayKey(at)) ? settleTimerState(old, at) : old); }, 1000); return () => clearInterval(id); }, []);
  const mutate = (id: string, status: TaskStatus) => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); const today = todayKey(at); const target = next.tasks.find(task => task.id === id); if (!target || (status === 'running' && target.day !== today)) return next; const sortOrder = groupLastOrder(next.tasks, target.day, status, id) + 1; return { ...next, tasks: next.tasks.map(t => t.id === id ? { ...t, status, sortOrder, completedAt: status === 'completed' ? at : t.completedAt } : t) }; });
  const api = useMemo<TimerApi>(() => ({ ...state, ready, now,
    addTask: (title, tagId) => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); const day = todayKey(at); const validTagId = next.categories.some(tag => tag.id === tagId) ? tagId : uncategorizedTagId; return { ...next, tasks: [{ id: `${at}-${Math.random()}`, title: title.trim(), createdAt: at, status: 'pending', elapsedDuration: 0, allocatedDuration: 0, day, tagId: validTagId, sortOrder: groupFirstOrder(next.tasks, day, 'pending') - 1 }, ...next.tasks] }; }),
    start: id => mutate(id, 'running'), pause: id => mutate(id, 'paused'), complete: id => mutate(id, 'completed'),
    restart: id => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); const today = todayKey(at); const task = next.tasks.find(item => item.id === id); if (!task || task.day !== today) return next; const sortOrder = groupLastOrder(next.tasks, today, 'running', id) + 1; return { ...next, tasks: next.tasks.map(item => item.id === id ? { ...item, status: 'running', sortOrder, completedAt: undefined } : item) }; }),
    copyYesterday: () => setState(old => { const at = Date.now(); const next = settleTimerState(old, at); const today = todayKey(at); if (next.tasks.some(task => task.day === today)) return next; const copies = next.tasks.filter(task => task.day === yesterdayKey()).map((task, index): Task => ({ id: `${at}-${index}-${Math.random()}`, title: task.title, createdAt: at, status: 'pending', elapsedDuration: 0, allocatedDuration: 0, day: today, tagId: next.categories.some(tag => tag.id === task.tagId) ? task.tagId : uncategorizedTagId, sortOrder: index })); return { ...next, tasks: [...copies, ...next.tasks] }; }),
    updateTask: (id, title, tagId) => setState(old => { const next = settleTimerState(old, Date.now()); const validTagId = next.categories.some(tag => tag.id === tagId) ? tagId : uncategorizedTagId; return { ...next, tasks: next.tasks.map(task => task.id === id ? { ...task, title: title.trim(), tagId: validTagId } : task) }; }),
    updateAllocatedDuration: (id, allocatedDuration) => setState(old => { const next = settleTimerState(old, Date.now()); return { ...next, tasks: next.tasks.map(task => task.id === id ? { ...task, allocatedDuration } : task) }; }),
    reorderTasks: taskIds => setState(old => { const next = settleTimerState(old, Date.now()); const positions = new Map(taskIds.map((id, index) => [id, index])); return { ...next, tasks: next.tasks.map(task => { const sortOrder = positions.get(task.id); return sortOrder === undefined ? task : { ...task, sortOrder }; }) }; }),
    addCategory: (label, iconUri, systemIconId) => setState(old => { const trimmed = label.trim().slice(0, 12); if (!trimmed) return old; const next = settleTimerState(old, Date.now()); const color = tagColors[next.categories.filter(tag => tag.id !== uncategorizedTagId).length % tagColors.length]; return { ...next, categories: [...next.categories.filter(tag => tag.id !== uncategorizedTagId), { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: trimmed, isCustomLabel: true, color, iconUri, systemIconId }, next.categories.find(tag => tag.id === uncategorizedTagId)!] }; }),
    updateCategory: (id, label, iconUri, systemIconId) => setState(old => { if (id === uncategorizedTagId) return old; const next = settleTimerState(old, Date.now()); return { ...next, categories: next.categories.map(tag => tag.id === id ? { ...tag, label: label.trim().slice(0, 12) || tag.label, isCustomLabel: true, iconUri, systemIconId } : tag) }; }),
    deleteCategory: id => setState(old => { if (id === uncategorizedTagId || !old.categories.some(tag => tag.id === id)) return old; const next = settleTimerState(old, Date.now()); return { ...next, categories: next.categories.filter(tag => tag.id !== id), tasks: next.tasks.map(task => task.tagId === id ? { ...task, tagId: uncategorizedTagId } : task) }; }),
    remove: id => setState(old => { const next = settleTimerState(old, Date.now()); return { ...next, tasks: next.tasks.filter(t => t.id !== id) }; })
  }), [state, ready, now]);
  return <TimerContext.Provider value={api}>{children}</TimerContext.Provider>;
}
export function useTimer() { const value = useContext(TimerContext); if (!value) throw new Error('TimerProvider missing'); return value; }
export function liveTask(task: Task, state: TimerState, now: number) { return settleTimerState(state, now).tasks.find(item => item.id === task.id) ?? task; }
