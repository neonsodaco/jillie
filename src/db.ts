import Dexie, { type Table } from 'dexie';

export type ColourKey =
  | 'terracotta' | 'sage' | 'cornflower' | 'marigold'
  | 'rose' | 'teal' | 'plum' | 'olive'
  | 'slate' | 'walnut' | 'berry' | 'pine';

// Bright flower palette. The keys are legacy ids kept stable so existing
// projects and backups keep working — the labels and CSS carry the colours.
export const COLOURS: { key: ColourKey; label: string }[] = [
  { key: 'terracotta', label: 'Bright orange' },
  { key: 'sage', label: 'Bright green' },
  { key: 'cornflower', label: 'Blue' },
  { key: 'marigold', label: 'Coral' },
  { key: 'rose', label: 'Pink' },
  { key: 'teal', label: 'Teal' },
  { key: 'plum', label: 'Purple' },
  { key: 'olive', label: 'Turquoise' },
  { key: 'slate', label: 'Sky blue' },
  { key: 'walnut', label: 'Magenta' },
  { key: 'berry', label: 'Raspberry' },
  { key: 'pine', label: 'Indigo' }
];

export type Priority = 'low' | 'normal' | 'high';

/** How much oomph a task takes — Guide Me matches tasks to Jillian's energy. */
export type PhysicalDemand = 'low' | 'medium' | 'high';

// alphabetical, so the right store is easy to find in the picker
export const STORE_TYPES = [
  'Automotive Store',
  'Boating Store',
  'Caravan Store',
  'Discount Store',
  'Hardware Store',
  'Marketplace',
  'Online',
  'Other',
  'Supermarket'
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
  done: boolean; // bought
  clearedAt: number | null; // tidied off the shopping list, but NEVER off its task
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
    this.version(3).upgrade(async (tx) => {
      // cleared items stay on their tasks; they only leave the shopping list
      await tx
        .table('shopItems')
        .toCollection()
        .modify((i) => {
          if (i.clearedAt === undefined) i.clearedAt = null;
        });
      // task archiving was removed from the app: release anything stranded
      await tx
        .table('tasks')
        .toCollection()
        .modify((t) => {
          if (t.archivedAt !== null) t.archivedAt = null;
        });
    });
  }
}

export const db = new TrackerDB();

// debug handle: lets us inspect or exercise the database from devtools
// (e.g. remotely helping Jillian via chrome://inspect) and from tests
if (typeof window !== 'undefined') {
  (window as unknown as { __jillieDb: TrackerDB }).__jillieDb = db;
}

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

/* ---- durable delete with in-memory undo ---------------------------------
   Deletes happen IMMEDIATELY (so a refresh can never resurrect anything);
   Undo restores from a snapshot held in memory for the 10-second window. */

export interface ProjectSnapshot {
  project: Project;
  tasks: Task[];
  updates: Update[];
  photos: Photo[];
  shopItems: ShopItem[];
}

export async function snapshotProject(projectId: string): Promise<ProjectSnapshot> {
  const project = (await db.projects.get(projectId))!;
  const tasks = await db.tasks.where('projectId').equals(projectId).toArray();
  const taskIds = tasks.map((t) => t.id);
  const [updates, photos, shopItems] = await Promise.all([
    db.updates.where('taskId').anyOf(taskIds).toArray(),
    db.photos.where('taskId').anyOf(taskIds).toArray(),
    db.shopItems.where('projectId').equals(projectId).toArray()
  ]);
  return { project, tasks, updates, photos, shopItems };
}

export async function restoreProjectSnapshot(s: ProjectSnapshot): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.updates, db.photos, db.shopItems, async () => {
    await db.projects.put(s.project);
    await db.tasks.bulkPut(s.tasks);
    await db.updates.bulkPut(s.updates);
    await db.photos.bulkPut(s.photos);
    await db.shopItems.bulkPut(s.shopItems);
  });
}

export interface TaskSnapshot {
  tasks: Task[];
  updates: Update[];
  photos: Photo[];
  shopLinks: { itemId: string; taskId: string }[]; // items survive; only the link is cut
}

export async function snapshotTasks(taskIds: string[]): Promise<TaskSnapshot> {
  const [tasks, updates, photos, linkedItems] = await Promise.all([
    db.tasks.where('id').anyOf(taskIds).toArray(),
    db.updates.where('taskId').anyOf(taskIds).toArray(),
    db.photos.where('taskId').anyOf(taskIds).toArray(),
    db.shopItems.where('taskId').anyOf(taskIds).toArray()
  ]);
  return { tasks, updates, photos, shopLinks: linkedItems.map((i) => ({ itemId: i.id, taskId: i.taskId! })) };
}

export async function restoreTaskSnapshot(s: TaskSnapshot): Promise<void> {
  await db.transaction('rw', db.tasks, db.updates, db.photos, db.shopItems, async () => {
    await db.tasks.bulkPut(s.tasks);
    await db.updates.bulkPut(s.updates);
    await db.photos.bulkPut(s.photos);
    for (const link of s.shopLinks) {
      await db.shopItems.update(link.itemId, { taskId: link.taskId });
    }
  });
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

/* ---- connection resilience ----------------------------------------------
   Android closes IndexedDB connections when the phone locks or the app
   sleeps. Without handling, every later read shows nothing and every write
   silently hangs — data looks lost and buttons look dead. These hooks
   reopen the connection (or reload the app) so it always comes back. */

export function armDbResilience(onRecovered: () => void): void {
  try {
    // another window/tab upgraded the schema: reload to match it
    db.on('versionchange', () => {
      try {
        db.close();
      } catch {
        /* already closing */
      }
      window.location.reload();
    });
    // connection killed underneath us: reopen, or reload as a last resort
    db.on('close', () => {
      window.setTimeout(() => {
        if (db.isOpen()) return;
        db.open()
          .then(() => onRecovered())
          .catch(() => window.location.reload());
      }, 150);
    });
  } catch {
    /* event not supported: the wake-up probe below still covers recovery */
  }
}

/** Probe the connection; reopen if dead. Returns whether a reopen happened. */
export async function ensureDbAlive(): Promise<'ok' | 'reopened'> {
  try {
    if (!db.isOpen()) {
      await db.open();
      return 'reopened';
    }
    await db.projects.limit(1).count();
    return 'ok';
  } catch {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    try {
      await db.open();
      return 'reopened';
    } catch {
      window.location.reload();
      return 'reopened';
    }
  }
}
