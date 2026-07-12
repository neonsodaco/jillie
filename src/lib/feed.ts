import type { Project, Task, Update } from '../db';
import { numberTasks } from './numbering';
import { daysUntil, daysSince, dueLine } from './dates';

/**
 * The Today feed, dependency-aware. Steps are done strictly in order
 * (1, then 2, then 3…), so the only recommendable task in a project is
 * the FIRST unticked step. Its urgency is inherited from anything it
 * unlocks: if step 2 is next and step 5 is overdue, step 2 appears under
 * "Running late" with "clears the way for 5. … — was due Friday".
 */

export interface FeedItem {
  task: Task;
  project: Project;
  label: string; // computed step number
  why: string;
  overdue: boolean;
}

export interface FeedGroup {
  key: string;
  heading: string;
  items: FeedItem[];
}

const STALE_DAYS = 7;
const SOON_DAYS = 3;
const prioRank = { high: 0, normal: 1, low: 2 } as const;

interface Urgency {
  rank: number; // 0 overdue, 1 due today, 2 high priority, 3 due soon, 4 stale
  srcTask: Task;
  srcLabel: string;
  own: boolean; // the urgency belongs to the actionable step itself
}

/** Due-date/priority urgency of one task, or null if it isn't urgent. */
function taskUrgency(t: Task): number | null {
  let rank: number | null = null;
  if (t.dueDate) {
    const d = daysUntil(t.dueDate);
    rank = d < 0 ? 0 : d === 0 ? 1 : d <= SOON_DAYS ? 3 : null;
  }
  if (t.priority === 'high') rank = rank === null ? 2 : Math.min(rank, 2);
  return rank;
}

/**
 * For a project's tasks (done + open, in numbered order): the next
 * actionable step, plus the strongest urgency among it and everything
 * it blocks. Returns null when the project has nothing open or nothing
 * urgent/stale to surface.
 */
export function nextStepUrgency(
  projectTasks: Task[],
  latestUpdateByTask: Map<string, Update>
): { actionable: Task; label: string; urgency: Urgency | null } | null {
  const numbered = numberTasks(projectTasks);
  const idx = numbered.findIndex((n) => !n.task.done);
  if (idx < 0) return null;
  const actionable = numbered[idx];

  let best: Urgency | null = null;
  const consider = (t: Task, label: string, own: boolean) => {
    const rank = taskUrgency(t);
    if (rank === null) return;
    if (!best || rank < best.rank) best = { rank, srcTask: t, srcLabel: label, own };
  };
  consider(actionable.task, actionable.label, true);
  for (const n of numbered.slice(idx + 1)) {
    if (!n.task.done) consider(n.task, n.label, false);
  }
  if (!best) {
    // nothing urgent anywhere — is the step she's on going quiet?
    const latest = latestUpdateByTask.get(actionable.task.id);
    if (latest && daysSince(latest.createdAt) >= STALE_DAYS) {
      best = { rank: 4, srcTask: actionable.task, srcLabel: actionable.label, own: true };
    }
  }
  return { actionable: actionable.task, label: actionable.label, urgency: best };
}

/** The reason line for an urgency, from the actionable step's point of view. */
export function urgencyWhy(u: Urgency, latestUpdateByTask: Map<string, Update>): { why: string; overdue: boolean } {
  if (u.rank === 4) {
    const latest = latestUpdateByTask.get(u.srcTask.id)!;
    return { why: `no update in ${daysSince(latest.createdAt)} days`, overdue: false };
  }
  const line = u.srcTask.dueDate ? dueLine(u.srcTask.dueDate) : null;
  const what = line ? line.text : 'high priority';
  const overdue = line?.overdue ?? false;
  if (u.own) return { why: what, overdue };
  return {
    why: `clears the way for ${u.srcLabel}. ${u.srcTask.name || 'the next step'} — ${what}`,
    overdue
  };
}

export function buildFeed(
  tasks: Task[],
  projectsById: Map<string, Project>,
  latestUpdateByTask: Map<string, Update>
): FeedGroup[] {
  const picks: { item: FeedItem; rank: number; due: string; prio: number }[] = [];

  for (const project of projectsById.values()) {
    if (project.archivedAt !== null || project.deletedAt !== null) continue;
    const projTasks = tasks.filter(
      (t) => t.projectId === project.id && t.deletedAt === null && t.archivedAt === null
    );
    const next = nextStepUrgency(projTasks, latestUpdateByTask);
    if (!next || !next.urgency) continue;
    const { why, overdue } = urgencyWhy(next.urgency, latestUpdateByTask);
    picks.push({
      item: { task: next.actionable, project, label: next.label, why, overdue },
      rank: next.urgency.rank,
      due: next.urgency.srcTask.dueDate ?? '9999',
      prio: prioRank[next.urgency.srcTask.priority]
    });
  }

  picks.sort((a, b) => a.rank - b.rank || a.due.localeCompare(b.due) || a.prio - b.prio);

  const defs = [
    { key: 'overdue', heading: 'Running late' },
    { key: 'today', heading: 'On today' },
    { key: 'important', heading: 'Important' },
    { key: 'soon', heading: 'Coming up' },
    { key: 'stale', heading: 'Waiting for an update' }
  ];
  return defs
    .map((d, i) => ({ ...d, items: picks.filter((p) => p.rank === i).map((p) => p.item) }))
    .filter((g) => g.items.length > 0);
}
