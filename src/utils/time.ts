export const fullTime = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; };
export const shortTime = (ms: number) => { const m = Math.round(ms / 60000); if (!m) return '0m'; const h = Math.floor(m / 60); return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`; };
export const todayKey = (time = Date.now()) => new Date(time).toLocaleDateString('en-CA');
export const yesterdayKey = () => { const date = new Date(); date.setDate(date.getDate() - 1); return todayKey(date.getTime()); };
