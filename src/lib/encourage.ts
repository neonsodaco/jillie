import type { Task } from '../db';

/**
 * Progress encouragement — warm, specific, never nagging.
 * Milestone messages fire when a tick crosses a real threshold,
 * so a long list feels like it's moving even when plenty remains.
 */

const GENERIC = [
  'Lovely — another one off the list.',
  "Tick. That's real progress.",
  'One less thing to hold in your head.',
  'Nicely done, Jillian.',
  'Chipping away — it adds up.'
];

export function tickMessage(doneAfter: number, total: number, projectName: string): string {
  const before = (doneAfter - 1) / total;
  const after = doneAfter / total;
  if (doneAfter === total) return `That was the last one — ${projectName} is finished. Well done, Jillian.`;
  if (total - doneAfter === 1) return `Only one left on ${projectName}. So close.`;
  if (before < 0.75 && after >= 0.75) return `Three quarters of ${projectName} done. The home stretch.`;
  if (before < 0.5 && after >= 0.5) return `Halfway through ${projectName} — look at that bar go.`;
  if (before < 0.25 && after >= 0.25) return `A quarter of ${projectName} done already.`;
  if (doneAfter === 1) return `First one done — ${projectName} is underway.`;
  return GENERIC[doneAfter % GENERIC.length];
}

/** How many tasks she's finished in the last `days` days. */
export function recentWins(tasks: Task[], days = 7): number {
  const since = Date.now() - days * 86400000;
  return tasks.filter((t) => t.done && t.completedAt !== null && t.completedAt >= since && t.deletedAt === null).length;
}

export function winsLine(n: number): string {
  if (n === 1) return "You've ticked off 1 thing this week.";
  return `You've ticked off ${n} things this week.`;
}
