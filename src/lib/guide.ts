import type { Project, Task, PhysicalDemand } from '../db';
import { daysUntil, dueLine } from './dates';

/**
 * Guide Me: match today's energy to tasks whose physical demand fits,
 * then surface the most important of those — so a low day still ends
 * with something done, without pushing past her limits.
 */

export type Energy = 'low' | 'medium' | 'high';

const ALLOWED: Record<Energy, PhysicalDemand[]> = {
  low: ['low'],
  medium: ['low', 'medium'],
  high: ['low', 'medium', 'high']
};

export interface GuidePick {
  task: Task;
  project: Project;
  why: string;
  overdue: boolean;
}

const prioRank = { high: 0, normal: 1, low: 2 } as const;

function urgency(t: Task): number {
  if (t.dueDate) {
    const d = daysUntil(t.dueDate);
    if (d < 0) return 0; // overdue
    if (d === 0) return 1; // due today
    if (d <= 3 && t.priority !== 'high') return 3; // due soon
  }
  if (t.priority === 'high') return 2;
  return 4;
}

function whyLine(t: Task): { why: string; overdue: boolean } {
  if (t.dueDate) {
    const line = dueLine(t.dueDate);
    if (line.overdue || line.dueToday || daysUntil(t.dueDate) <= 3) return { why: line.text, overdue: line.overdue };
  }
  if (t.priority === 'high') return { why: 'high priority', overdue: false };
  return { why: 'ready when you are', overdue: false };
}

export function guidePicks(
  tasks: Task[],
  projectsById: Map<string, Project>,
  energy: Energy
): GuidePick[] {
  const allowed = ALLOWED[energy];
  return tasks
    .filter((t) => {
      if (t.done || t.archivedAt !== null || t.deletedAt !== null) return false;
      if (!allowed.includes(t.physicalDemand ?? 'medium')) return false;
      const p = projectsById.get(t.projectId);
      return !!p && p.archivedAt === null && p.deletedAt === null;
    })
    .sort(
      (a, b) =>
        urgency(a) - urgency(b) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
        prioRank[a.priority] - prioRank[b.priority] ||
        a.createdAt - b.createdAt
    )
    .map((t) => ({ task: t, project: projectsById.get(t.projectId)!, ...whyLine(t) }));
}

/* ---- today's energy answer, remembered for the day ---- */

const DATE_KEY = 'energy.date';
const LEVEL_KEY = 'energy.level';

const todayStamp = () => new Date().toDateString();

export function getTodayEnergy(): Energy | null {
  if (localStorage.getItem(DATE_KEY) !== todayStamp()) return null;
  const level = localStorage.getItem(LEVEL_KEY);
  return level === 'low' || level === 'medium' || level === 'high' ? level : null;
}

export function setTodayEnergy(level: Energy): void {
  localStorage.setItem(DATE_KEY, todayStamp());
  localStorage.setItem(LEVEL_KEY, level);
}

export function clearTodayEnergy(): void {
  localStorage.removeItem(DATE_KEY);
  localStorage.removeItem(LEVEL_KEY);
}
