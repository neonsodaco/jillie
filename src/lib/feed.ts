import type { Project, Task, Update } from '../db';
import { daysUntil, daysSince, dueLine } from './dates';

/**
 * The Today feed: one ranked list of what genuinely needs Jillian,
 * grouped with a plain reason line on every item. No artificial cap.
 * Order: overdue → due today → high priority → due soon → waiting for an update.
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

export function buildFeed(
  tasks: Task[],
  projectsById: Map<string, Project>,
  labelsByTask: Map<string, string>,
  latestUpdateByTask: Map<string, Update>
): FeedGroup[] {
  const open = tasks.filter((t) => {
    if (t.done || t.archivedAt !== null || t.deletedAt !== null) return false;
    const p = projectsById.get(t.projectId);
    return !!p && p.archivedAt === null && p.deletedAt === null;
  });

  const seen = new Set<string>();
  const take = (list: Task[]) => list.filter((t) => !seen.has(t.id)).map((t) => (seen.add(t.id), t));

  const byDueThenPrio = (a: Task, b: Task) =>
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || prioRank[a.priority] - prioRank[b.priority];

  const overdue = take(open.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0).sort(byDueThenPrio));
  const today = take(open.filter((t) => t.dueDate && daysUntil(t.dueDate) === 0).sort(byDueThenPrio));
  const important = take(open.filter((t) => t.priority === 'high').sort(byDueThenPrio));
  const soon = take(
    open.filter((t) => t.dueDate && daysUntil(t.dueDate) > 0 && daysUntil(t.dueDate) <= SOON_DAYS).sort(byDueThenPrio)
  );
  const stale = take(
    open
      .filter((t) => {
        const latest = latestUpdateByTask.get(t.id);
        return !!latest && daysSince(latest.createdAt) >= STALE_DAYS;
      })
      .sort((a, b) => (latestUpdateByTask.get(a.id)?.createdAt ?? 0) - (latestUpdateByTask.get(b.id)?.createdAt ?? 0))
  );

  const item = (t: Task, why: string, isOverdue = false): FeedItem => ({
    task: t,
    project: projectsById.get(t.projectId)!,
    label: labelsByTask.get(t.id) ?? '',
    why,
    overdue: isOverdue
  });

  const groups: FeedGroup[] = [
    { key: 'overdue', heading: 'Running late', items: overdue.map((t) => item(t, dueLine(t.dueDate!).text, true)) },
    { key: 'today', heading: 'On today', items: today.map((t) => item(t, 'due today')) },
    { key: 'important', heading: 'Important', items: important.map((t) => item(t, t.dueDate ? dueLine(t.dueDate).text : 'high priority')) },
    { key: 'soon', heading: 'Coming up', items: soon.map((t) => item(t, dueLine(t.dueDate!).text)) },
    {
      key: 'stale',
      heading: 'Waiting for an update',
      items: stale.map((t) => {
        const d = daysSince(latestUpdateByTask.get(t.id)!.createdAt);
        return item(t, `no update in ${d} days`);
      })
    }
  ];
  return groups.filter((g) => g.items.length > 0);
}
