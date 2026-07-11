import Dexie, { type Table } from 'dexie';

export type ColourKey =
  | 'terracotta' | 'sage' | 'cornflower' | 'marigold'
  | 'rose' | 'teal' | 'plum' | 'olive';

export const COLOURS: { key: ColourKey; label: string }[] = [
  { key: 'terracotta', label: 'Terracotta' },
  { key: 'sage', label: 'Sage' },
  { key: 'cornflower', label: 'Cornflower' },
  { key: 'marigold', label: 'Marigold' },
  { key: 'rose', label: 'Dusty rose' },
  { key: 'teal', label: 'Teal' },
  { key: 'plum', label: 'Plum' },
  { key: 'olive', label: 'Olive' }
];

export type Priority = 'low' | 'normal' | 'high';

/** How much oomph a task takes — Guide Me matches tasks to Jillian's energy. */
export type PhysicalDemand = 'low' | 'medium' | 'high';

export const STORE_TYPES = [
  'Hardware Store',
  'Discount Store',
  'Supermarket',
  'Online',
  'Boating Store',
  'Caravan Store',
  'Automotive Store',
  'Marketplace',
  'Other'
] as const;
export type StoreType = (typeof STORE_TYPES)[number];

export interface Project {
  id: string;
  name: string;
  colour: ColourKey;
  archivedAt: number | null;
  deletedAt: number | null;   // soft delete; purged after the undo window
  createdAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null; // null = top-level step, set = sub-step (one level)
  sortOrder: number;           // fractional index; step numbers are computed, never stored
  name: string;
  priority: Priority;
  physicalDemand: PhysicalDemand; // default 'medium'
  done: boolean;
  archivedAt: number | null;
  deletedAt: number | null;
  doneBy: string;              // the person responsible
  dueDate: string | null;      // YYYY-MM-DD
  involvedNotes: string;
  createdAt: number;
  completedAt: number | null;
}

export interface Update {
  id: string;
  taskId: string;
  text: string;
  createdAt: number;
}

export interface Photo {
  id: string;
  taskId: string;
  caption: string;
  blob: Blob;   // compressed full image
  thumb: Blob;  // small thumbnail for grids
  createdAt: number;
}

/** A screenshot shared in via the Android share sheet, waiting to be attached to a task. */
export interface PendingShare {
  id: string;
  blob: Blob;
  createdAt: number;
}

/** One thing to buy, tied to a project (and optionally the task it came from). */
export interface ShopItem {
  id: string;
  projectId: string;
  taskId: string | null; // the task she was on when she ran out of something
  name: string;
  store: StoreType;
  done: boolean; // in the trolley
  createdAt: number;
}

class TrackerDB extends Dexie {
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  updates!: Table<Update, string>;
  photos!: Table<Photo, string>;
  pendingShares!: Table<PendingShare, string>;
  shopItems!: Table<ShopItem, string>;

  constructor() {
    super('jillians-diy-projects');
    this.version(1).stores({
      projects: 'id, archivedAt, deletedAt, createdAt',
      tasks: 'id, projectId, parentTaskId, dueDate, deletedAt',
      updates: 'id, taskId, createdAt',
      photos: 'id, taskId, createdAt',
      pendingShares: 'id, createdAt'
    });
    this.version(2)
      .stores({
        shopItems: 'id, projectId, taskId, store, done, createdAt'
      })
      .upgrade((tx) =>
        tx
          .table('tasks')
          .toCollection()
          .modify((t) => {
            if (!t.physicalDemand) t.physicalDemand = 'medium';
          })
      );
  }
}

export const db = new TrackerDB();

export const uid = (): string =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Rows a screen should ever see: not soft-deleted. */
export const alive = <T extends { deletedAt: number | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.deletedAt === null);

/** Alive and not archived. */
export const active = <T extends { deletedAt: number | null; archivedAt: number | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.deletedAt === null && r.archivedAt === null);

/** Permanently remove a task, its sub-steps, and their updates and photos. */
export async function hardDeleteTasks(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  await db.transaction('rw', db.tasks, db.updates, db.photos, db.shopItems, async () => {
    await db.updates.where('taskId').anyOf(taskIds).delete();
    await db.photos.where('taskId').anyOf(taskIds).delete();
    // shopping items outlive the task — still things to buy, just untied from it
    await db.shopItems.where('taskId').anyOf(taskIds).modify({ taskId: null });
    await db.tasks.bulkDelete(taskIds);
  });
}

/** Permanently remove a project and everything in it. */
export async function hardDeleteProject(projectId: string): Promise<void> {
  const tasks = await db.tasks.where('projectId').equals(projectId).toArray();
  await hardDeleteTasks(tasks.map((t) => t.id));
  await db.shopItems.where('projectId').equals(projectId).delete();
  await db.projects.delete(projectId);
}

/** Task ids of a task plus its sub-steps. */
export async function taskFamilyIds(taskId: string): Promise<string[]> {
  const kids = await db.tasks.where('parentTaskId').equals(taskId).toArray();
  return [taskId, ...kids.map((k) => k.id)];
}

/** On boot: clear out anything left soft-deleted by a previous session. */
export async function purgeLeftovers(): Promise<void> {
  const deadTasks = await db.tasks.filter((t) => t.deletedAt !== null).toArray();
  await hardDeleteTasks(deadTasks.map((t) => t.id));
  const deadProjects = await db.projects.filter((p) => p.deletedAt !== null).toArray();
  for (const p of deadProjects) await hardDeleteProject(p.id);
}

/** Ask the browser to protect our storage from automatic clean-up. */
export function requestPersistentStorage(): void {
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => undefined);
  }
}
