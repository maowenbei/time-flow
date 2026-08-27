import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { createStarterTaskTags, isBuiltInTagId, isLegacyBuiltInLabel, tagColors, TaskTag, TaskTagId, uncategorizedTagId } from '../constants/taskTags';
import { todayKey, yesterdayKey } from '../utils/time';

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed';
export type Task = { id: string; title: string; createdAt: number; status: TaskStatus; elapsedDuration: number; allocatedDuration: number; completedAt?: number; day: string; tagId: TaskTagId };
type TimerState = { tasks: Task[]; categories: TaskTag[]; lastTimestamp: number };
type TimerApi = TimerState & { ready: boolean; now: number; addTask: (title: string, tagId: TaskTagId) => void; start: (id: string) => void; pause: (id: string) => void; complete: (id: string) => void; restart: (id: string) => void; copyYesterday: () => void; updateTask: (id: string, title: string, tagId: TaskTagId) => void; updateAllocatedDuration: (id: string, allocatedDuration: number) => void; addCategory: (label: string, iconUri?: string, systemIconId?: string) => void; updateCategory: (id: string, label: string, iconUri?: string, systemIconId?: string) => void; deleteCategory: (id: string) => void; remove: (id: string) => void };
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
  return { lastTimestamp: typeof stored.lastTimestamp === 'number' ? stored.lastTimestamp : Date.now(), categories, tasks: Array.isArray(stored.tasks) ? stored.tasks.map(task => ({ ...task, tagId: categoryIds.has(task.tagId) ? task.tagId : uncategorizedTagId })) : [] };
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(initial); const [ready, setReady] = useState(false); const [now, setNow] = useState(Date.now());
  useEffect(() => { AsyncStorage.getItem(KEY).then(value => { if (value) setState(normalizeState(JSON.parse(value) as Partial<TimerState>)); setReady(true); }).catch(() => setReady(true)); }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)); }, [state, ready]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const flush = (source: TimerState, at: number): TimerState => {
    const running = source.tasks.filter(t => t.status === 'running'); const delta = Math.max(0, at - source.lastTimestamp);
    if (!running.length || !delta) return { ...source, lastTimestamp: at };
    const base = Math.floor(delta / running.length); const remainder = delta % running.length;
    return { ...source, lastTimestamp: at, tasks: source.tasks.map(task => { const index = running.findIndex(item => item.id === task.id); return index < 0 ? task : { ...task, elapsedDuration: task.elapsedDuration + delta, allocatedDuration: task.allocatedDuration + base + (index < remainder ? 1 : 0) }; }) };
  };
  const mutate = (id: string, status: TaskStatus) => setState(old => { const at = Date.now(); const next = flush(old, at); return { ...next, tasks: next.tasks.map(t => t.id === id ? { ...t, status, completedAt: status === 'completed' ? at : t.completedAt } : t) }; });
  const api = useMemo<TimerApi>(() => ({ ...state, ready, now,
    addTask: (title, tagId) => setState(old => { const at = Date.now(); const next = flush(old, at); const validTagId = next.categories.some(tag => tag.id === tagId) ? tagId : uncategorizedTagId; return { ...next, tasks: [{ id: `${at}-${Math.random()}`, title: title.trim(), createdAt: at, status: 'pending', elapsedDuration: 0, allocatedDuration: 0, day: todayKey(at), tagId: validTagId }, ...next.tasks] }; }),
    start: id => mutate(id, 'running'), pause: id => mutate(id, 'paused'), complete: id => mutate(id, 'completed'),
    restart: id => setState(old => { const at = Date.now(); const next = flush(old, at); return { ...next, tasks: next.tasks.map(task => task.id === id ? { ...task, status: 'running', completedAt: undefined } : task) }; }),
    copyYesterday: () => setState(old => { const at = Date.now(); const next = flush(old, at); const today = todayKey(at); if (next.tasks.some(task => task.day === today)) return next; const copies = next.tasks.filter(task => task.day === yesterdayKey()).map((task, index): Task => ({ id: `${at}-${index}-${Math.random()}`, title: task.title, createdAt: at, status: 'pending', elapsedDuration: 0, allocatedDuration: 0, day: today, tagId: next.categories.some(tag => tag.id === task.tagId) ? task.tagId : uncategorizedTagId })); return { ...next, tasks: [...copies, ...next.tasks] }; }),
    updateTask: (id, title, tagId) => setState(old => { const next = flush(old, Date.now()); const validTagId = next.categories.some(tag => tag.id === tagId) ? tagId : uncategorizedTagId; return { ...next, tasks: next.tasks.map(task => task.id === id ? { ...task, title: title.trim(), tagId: validTagId } : task) }; }),
    updateAllocatedDuration: (id, allocatedDuration) => setState(old => { const next = flush(old, Date.now()); return { ...next, tasks: next.tasks.map(task => task.id === id ? { ...task, allocatedDuration } : task) }; }),
    addCategory: (label, iconUri, systemIconId) => setState(old => { const trimmed = label.trim().slice(0, 12); if (!trimmed) return old; const color = tagColors[old.categories.filter(tag => tag.id !== uncategorizedTagId).length % tagColors.length]; return { ...old, categories: [...old.categories.filter(tag => tag.id !== uncategorizedTagId), { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: trimmed, isCustomLabel: true, color, iconUri, systemIconId }, old.categories.find(tag => tag.id === uncategorizedTagId)!] }; }),
    updateCategory: (id, label, iconUri, systemIconId) => setState(old => id === uncategorizedTagId ? old : { ...old, categories: old.categories.map(tag => tag.id === id ? { ...tag, label: label.trim().slice(0, 12) || tag.label, isCustomLabel: true, iconUri, systemIconId } : tag) }),
    deleteCategory: id => setState(old => { if (id === uncategorizedTagId || !old.categories.some(tag => tag.id === id)) return old; const next = flush(old, Date.now()); return { ...next, categories: next.categories.filter(tag => tag.id !== id), tasks: next.tasks.map(task => task.tagId === id ? { ...task, tagId: uncategorizedTagId } : task) }; }),
    remove: id => setState(old => { const next = flush(old, Date.now()); return { ...next, tasks: next.tasks.filter(t => t.id !== id) }; })
  }), [state, ready, now]);
  return <TimerContext.Provider value={api}>{children}</TimerContext.Provider>;
}
export function useTimer() { const value = useContext(TimerContext); if (!value) throw new Error('TimerProvider missing'); return value; }
export function liveTask(task: Task, state: TimerState, now: number) { if (task.status !== 'running') return task; const running = state.tasks.filter(t => t.status === 'running'); const delta = Math.max(0, now - state.lastTimestamp); const index = running.findIndex(t => t.id === task.id); const allocated = Math.floor(delta / running.length) + (index < delta % running.length ? 1 : 0); return { ...task, elapsedDuration: task.elapsedDuration + delta, allocatedDuration: task.allocatedDuration + allocated }; }
