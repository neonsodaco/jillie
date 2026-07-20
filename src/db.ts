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
  customColour: string | null; // her own pick (#rrggbb); overrides the palette colour's look when set
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

/** One thing to gather up before starting a task — tools, materials, bits from the shed.
    Separate from the shopping list: nothing here is bought, only packed. */
export interface Need {
  id: string;
  taskId: string;
  name: string;
  packed: boolean; // gathered and ready to take out
  shopItemId: string | null; // linked shopping-list item; buying it ticks this off as packed
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
  clearedAt: number | null; // tidied away — hidden from the list and its task, record kept
  createdAt: number;
}

class TrackerDB extends Dexie {
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  updates!: Table<Update, string>;
  photos!: Table<Photo, string>;
  pendingShares!: Table<PendingShare, string>;
  shopItems!: Table<ShopItem, string>;
  needs!: Table<Need, string>;

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
      // clearing hides an item from view; the record itself is kept
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
    this.version(4).upgrade((tx) =>
      // custom colours arrive: existing projects keep their palette colour
      tx
        .table('projects')
        .toCollection()
        .modify((p) => {
          if (p.customColour === undefined) p.customColour = null;
        })
    );
    // things needed for a task — the packing checklist
    this.version(5).stores({
      needs: 'id, taskId'
    });
    // a packing-list thing can be linked onto the shopping list
    this.version(6)
      .stores({
        needs: 'id, taskId, shopItemId'
      })
      .upgrade((tx) =>
        tx
          .table('needs')
          .toCollection()
          .modify((n) => {
            if (n.shopItemId === undefined) n.shopItemId = null;
          })
      );
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

/** Single owner of the shopping-item record shape — every add goes through here. */
export function makeShopItem(fields: { projectId: string; taskId: string | null; name: string; store: StoreType }): ShopItem {
  return { id: uid(), ...fields, done: false, clearedAt: null, createdAt: Date.now() };
}

/** The store she used last time, remembered across every add path. */
export const lastStore = (): StoreType => (localStorage.getItem('shop.lastStore') as StoreType) || 'Hardware Store';
export const rememberStore = (s: StoreType): void => localStorage.setItem('shop.lastStore', s);

/* ---- packing-list <-> shopping-list link lifecycle -----------------------
   One owner for every step, each in a single transaction, so the two lists
   can never half-agree: create the link, propagate bought -> packed, and
   tear the link down when either end is deleted. */

/** Tick a shopping item bought (or not). Buying packs any linked packing thing;
    un-ticking never wipes a manual pack. */
export async function setShopItemBought(item: ShopItem, bought: boolean): Promise<void> {
  await db.transaction('rw', db.shopItems, db.needs, async () => {
    await db.shopItems.update(item.id, { done: bought });
    if (bought && item.taskId) {
      await db.needs.where('shopItemId').equals(item.id).modify({ packed: true });
    }
  });
}

/** Put a packing thing onto the shopping list as a linked item, atomically. */
export async function linkNeedToShopping(need: Need, projectId: string, store: StoreType): Promise<void> {
  await db.transaction('rw', db.shopItems, db.needs, async () => {
    const item = makeShopItem({ projectId, taskId: need.taskId, name: need.name, store });
    await db.shopItems.add(item);
    const updated = await db.needs.update(need.id, { shopItemId: item.id });
    if (!updated) throw new Error('packing item gone'); // rolls the orphan item back out
  });
}

/** Take a shopping item off the list; linked packing things let go of it.
    Returns the ids of the needs that were linked, so undo can re-tie them. */
export async function deleteShopItem(item: ShopItem): Promise<string[]> {
  return db.transaction('rw', db.shopItems, db.needs, async () => {
    const linkedIds = (await db.needs.where('shopItemId').equals(item.id).primaryKeys()) as string[];
    if (linkedIds.length) await db.needs.where('shopItemId').equals(item.id).modify({ shopItemId: null });
    await db.shopItems.delete(item.id);
    return linkedIds;
  });
}

export async function restoreShopItem(item: ShopItem, linkedNeedIds: string[]): Promise<void> {
  await db.transaction('rw', db.shopItems, db.needs, async () => {
    await db.shopItems.add(item);
    for (const id of linkedNeedIds) await db.needs.update(id, { shopItemId: item.id });
  });
}

export interface NeedSnapshot {
  need: Need;
  item: ShopItem | null; // the linked unbought item that went with it
}

/** Delete a packing thing; its linked UNBOUGHT shopping item goes with it
    (a bought one is history and stays). */
export async function deleteNeedEverywhere(need: Need): Promise<NeedSnapshot> {
  return db.transaction('rw', db.needs, db.shopItems, async () => {
    let item: ShopItem | null = null;
    if (need.shopItemId) {
      const linked = await db.shopItems.get(need.shopItemId);
      if (linked && !linked.done) {
        item = linked;
        await db.shopItems.delete(linked.id);
      }
    }
    await db.needs.delete(need.id);
    return { need, item };
  });
}

export async function restoreNeedSnapshot(s: NeedSnapshot): Promise<void> {
  await db.transaction('rw', db.needs, db.shopItems, async () => {
    if (s.item) await db.shopItems.add(s.item);
    await db.needs.add(s.need);
  });
}

/** Rows a screen should ever see: not soft-deleted. */
export const alive = <T extends { deletedAt: number | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.deletedAt === null);

/** Alive and not archived. */
export const active = <T extends { deletedAt: number | null; archivedAt: number | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.deletedAt === null && r.archivedAt === null);

/** Permanently remove a task, its sub-steps, and their updates, photos and packing list. */
export async function hardDeleteTasks(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  await db.transaction('rw', db.tasks, db.updates, db.photos, db.shopItems, db.needs, async () => {
    await db.updates.where('taskId').anyOf(taskIds).delete();
    await db.photos.where('taskId').anyOf(taskIds).delete();
    await db.needs.where('taskId').anyOf(taskIds).delete();
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
  needs: Need[];
}

export async function snapshotProject(projectId: string): Promise<ProjectSnapshot> {
  const project = (await db.projects.get(projectId))!;
  const tasks = await db.tasks.where('projectId').equals(projectId).toArray();
  const taskIds = tasks.map((t) => t.id);
  const [updates, photos, shopItems, needs] = await Promise.all([
    db.updates.where('taskId').anyOf(taskIds).toArray(),
    db.photos.where('taskId').anyOf(taskIds).toArray(),
    db.shopItems.where('projectId').equals(projectId).toArray(),
    db.needs.where('taskId').anyOf(taskIds).toArray()
  ]);
  return { project, tasks, updates, photos, shopItems, needs };
}

export async function restoreProjectSnapshot(s: ProjectSnapshot): Promise<void> {
  await db.transaction('rw', [db.projects, db.tasks, db.updates, db.photos, db.shopItems, db.needs], async () => {
    await db.projects.put(s.project);
    await db.tasks.bulkPut(s.tasks);
    await db.updates.bulkPut(s.updates);
    await db.photos.bulkPut(s.photos);
    await db.shopItems.bulkPut(s.shopItems);
    await db.needs.bulkPut(s.needs);
  });
}

export interface TaskSnapshot {
  tasks: Task[];
  updates: Update[];
  photos: Photo[];
  needs: Need[];
  shopLinks: { itemId: string; taskId: string }[]; // items survive; only the link is cut
}

export async function snapshotTasks(taskIds: string[]): Promise<TaskSnapshot> {
  const [tasks, updates, photos, needs, linkedItems] = await Promise.all([
    db.tasks.where('id').anyOf(taskIds).toArray(),
    db.updates.where('taskId').anyOf(taskIds).toArray(),
    db.photos.where('taskId').anyOf(taskIds).toArray(),
    db.needs.where('taskId').anyOf(taskIds).toArray(),
    db.shopItems.where('taskId').anyOf(taskIds).toArray()
  ]);
  return { tasks, updates, photos, needs, shopLinks: linkedItems.map((i) => ({ itemId: i.id, taskId: i.taskId! })) };
}

export async function restoreTaskSnapshot(s: TaskSnapshot): Promise<void> {
  await db.transaction('rw', db.tasks, db.updates, db.photos, db.shopItems, db.needs, async () => {
    await db.tasks.bulkPut(s.tasks);
    await db.updates.bulkPut(s.updates);
    await db.photos.bulkPut(s.photos);
    await db.needs.bulkPut(s.needs);
    for (const link of s.shopLinks) {
      await db.shopItems.update(link.itemId, { taskId: link.taskId });
    }
    // the shopping list kept living during the undo window — anything
    // bought in the meantime packs its restored packing thing
    for (const n of s.needs) {
      if (n.shopItemId && !n.packed) {
        const item = await db.shopItems.get(n.shopItemId);
        if (item?.done) await db.needs.update(n.id, { packed: true });
      }
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
