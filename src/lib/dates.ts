const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(aISO: string, bISO: string): number {
  return Math.round((fromISO(bISO).getTime() - fromISO(aISO).getTime()) / 86400000);
}

export function greeting(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Morning, ${name}`;
  if (h < 17) return `Afternoon, ${name}`;
  return `Evening, ${name}`;
}

export function todayWords(): string {
  const d = new Date();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateWords(d: Date, withYear = false): string {
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withYear && d.getFullYear() !== new Date().getFullYear() ? `${base} ${d.getFullYear()}` : base;
}

/** "was due Tuesday" / "due today" / "due tomorrow" / "due Thursday" / "due 24 July" */
export function dueLine(dueISO: string): { text: string; overdue: boolean; dueToday: boolean } {
  const diff = daysBetween(todayISO(), dueISO);
  const due = fromISO(dueISO);
  if (diff < 0) {
    const text = diff >= -6 ? `was due ${DAYS[due.getDay()]}` : `was due ${dateWords(due, true)}`;
    return { text, overdue: true, dueToday: false };
  }
  if (diff === 0) return { text: 'due today', overdue: false, dueToday: true };
  if (diff === 1) return { text: 'due tomorrow', overdue: false, dueToday: false };
  if (diff <= 6) return { text: `due ${DAYS[due.getDay()]}`, overdue: false, dueToday: false };
  return { text: `due ${dateWords(due, true)}`, overdue: false, dueToday: false };
}

/** Days until due; negative = overdue. */
export function daysUntil(dueISO: string): number {
  return daysBetween(todayISO(), dueISO);
}

/** "Tue 8 July" for update stamps and archive dates; with time: "Tue 8 July, 2:15 pm". */
export function stampWords(ts: number, withTime = false): string {
  const d = new Date(ts);
  const base = `${DAYS_SHORT[d.getDay()]} ${dateWords(d, true)}`;
  if (!withTime) return base;
  let h = d.getHours();
  const ampm = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return `${base}, ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 86400000);
}
