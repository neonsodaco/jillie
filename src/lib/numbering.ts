import type { Task } from '../db';

export interface NumberedTask {
  task: Task;
  label: string;      // "3" or "3.2" — always computed from position, never stored
  isSub: boolean;
}

/**
 * Turns a project's tasks into the display list: top-level steps in order,
 * each followed by its sub-steps, with computed step numbers.
 */
export function numberTasks(tasks: Task[]): NumberedTask[] {
  const bySort = (a: Task, b: Task) => a.sortOrder - b.sortOrder;
  const tops = tasks.filter((t) => t.parentTaskId === null).sort(bySort);
  const kids = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parentTaskId !== null) {
      const list = kids.get(t.parentTaskId) ?? [];
      list.push(t);
      kids.set(t.parentTaskId, list);
    }
  }
  const out: NumberedTask[] = [];
  tops.forEach((top, i) => {
    out.push({ task: top, label: `${i + 1}`, isSub: false });
    (kids.get(top.id) ?? []).sort(bySort).forEach((kid, j) => {
      out.push({ task: kid, label: `${i + 1}.${j + 1}`, isSub: true });
    });
  });
  return out;
}

/** Map of task id → step label for a project's tasks. */
export function labelMap(tasks: Task[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of numberTasks(tasks)) m.set(n.task.id, n.label);
  return m;
}

/** Sort order for appending after the current last sibling. */
export function appendOrder(siblings: Task[]): number {
  return siblings.length === 0 ? 1 : Math.max(...siblings.map((s) => s.sortOrder)) + 1;
}

/**
 * Sort order that places a task at `targetIndex` within its ordered siblings
 * (fractional indexing — neighbours' midpoint).
 */
export function orderAt(orderedSiblings: Task[], targetIndex: number, movingId: string): number {
  const rest = orderedSiblings.filter((s) => s.id !== movingId);
  const before = rest[targetIndex - 1];
  const after = rest[targetIndex];
  if (!before && !after) return 1;
  if (!before) return after.sortOrder - 1;
  if (!after) return before.sortOrder + 1;
  return (before.sortOrder + after.sortOrder) / 2;
}

/** First not-done task in display order — "Next: 3. Pick the paint colour". */
export function nextTask(tasks: Task[]): NumberedTask | null {
  return numberTasks(tasks).find((n) => !n.task.done) ?? null;
}

export function progress(tasks: Task[]): { done: number; total: number; pct: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
