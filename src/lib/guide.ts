import type { Project, Task, Update, PhysicalDemand } from '../db';
import { nextStepUrgency, urgencyWhy } from './feed';

/**
 * Guide Me, dependency-aware. Steps run strictly in order, so each
 * project offers exactly one candidate: its next unticked step. If that
 * step is too heavy for today's energy, the project offers nothing —
 * Guide Me never skips ahead past a blocking step. Urgency (own or
 * inherited from what the step unlocks) decides the order.
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

export function guidePicks(
  tasks: Task[],
  projectsById: Map<string, Project>,
  energy: Energy,
  latestUpdateByTask: Map<string, Update> = new Map()
): GuidePick[] {
  const allowed = ALLOWED[energy];
  const out: { pick: GuidePick; rank: number; due: string; prio: number; created: number }[] = [];

  for (const project of projectsById.values()) {
    if (project.archivedAt !== null || project.deletedAt !== null) continue;
    const projTasks = tasks.filter(
      (t) => t.projectId === project.id && t.deletedAt === null && t.archivedAt === null
    );
    const next = nextStepUrgency(projTasks, latestUpdateByTask);
    if (!next) continue;
    // her energy must match the step that is actually next — no skipping ahead
    if (!allowed.includes(next.actionable.physicalDemand ?? 'medium')) continue;

    let why = '';
    let overdue = false;
    let rank = 5;
    let due = '9999';
    let prio = prioRank[next.actionable.priority];
    if (next.urgency && next.urgency.rank < 4) {
      const w = urgencyWhy(next.urgency, latestUpdateByTask);
      why = w.why;
      overdue = w.overdue;
      rank = next.urgency.rank;
      due = next.urgency.srcTask.dueDate ?? '9999';
      prio = prioRank[next.urgency.srcTask.priority];
    }
    out.push({
      pick: { task: next.actionable, project, why, overdue },
      rank,
      due,
      prio,
      created: next.actionable.createdAt
    });
  }

  return out
    .sort((a, b) => a.rank - b.rank || a.due.localeCompare(b.due) || a.prio - b.prio || a.created - b.created)
    .map((o) => o.pick);
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
