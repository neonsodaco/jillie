import { unzip, strFromU8 } from 'fflate';
import { db, uid, type Project, type Task, type Update, type Photo, type ShopItem } from '../db';
import { makeThumb } from './images';

/**
 * Backup = ONE text file (JSON inside, photos embedded as data URLs),
 * saved via the Android share sheet straight into her own Google Drive.
 *
 * Why text and not zip: Android's share menu only accepts a short list
 * of file types and quietly rejects .zip — that was why "Send to Google
 * Drive" always fell back to a download. text/plain shares cleanly.
 * Old .zip backups from earlier versions still restore.
 */

interface BackupV3 {
  app: string;
  version: 3;
  exportedAt: number;
  projects: Project[];
  tasks: Task[];
  updates: Update[];
  shopItems: ShopItem[];
  photos: { id: string; taskId: string; caption: string; createdAt: number; data: string }[];
}

/* legacy zip format (v1/v2) */
interface BackupZipJSON {
  app: string;
  version: 1 | 2;
  exportedAt: number;
  projects: Project[];
  tasks: Task[];
  updates: Update[];
  photos: (Omit<Photo, 'blob' | 'thumb'> & { file: string; type: string })[];
  shopItems?: ShopItem[];
}

const blobToDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

function dataURLToBlob(dataURL: string): Blob {
  const [head, b64] = dataURL.split(',');
  if (!b64) throw new Error('Bad photo data');
  const declared = head.match(/data:([^;]+)/)?.[1] ?? 'image/webp';
  // photos are the only thing a backup may carry — a doctored file can't
  // smuggle any other content type into the database
  const type = declared.startsWith('image/') ? declared : 'image/webp';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function backupFilename(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `jillie-backup-${dd}-${mm}-${d.getFullYear()}.txt`;
}

export async function buildBackup(): Promise<File> {
  const [projects, tasks, updates, photos, shopItems] = await Promise.all([
    db.projects.toArray(),
    db.tasks.toArray(),
    db.updates.toArray(),
    db.photos.toArray(),
    db.shopItems.toArray()
  ]);
  const photosOut: BackupV3['photos'] = [];
  for (const p of photos) {
    photosOut.push({
      id: p.id,
      taskId: p.taskId,
      caption: p.caption,
      createdAt: p.createdAt,
      data: await blobToDataURL(p.blob)
    });
  }
  const data: BackupV3 = {
    app: 'jillians-diy-projects',
    version: 3,
    exportedAt: Date.now(),
    projects,
    tasks,
    updates,
    shopItems,
    photos: photosOut
  };
  return new File([JSON.stringify(data)], backupFilename(), { type: 'text/plain' });
}

async function writeRestored(
  projects: Project[],
  tasks: Task[],
  updates: Update[],
  shopItems: ShopItem[],
  photos: Photo[]
): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.updates, db.photos, db.shopItems, async () => {
    await Promise.all([db.projects.clear(), db.tasks.clear(), db.updates.clear(), db.photos.clear(), db.shopItems.clear()]);
    await db.projects.bulkAdd(projects);
    await db.tasks.bulkAdd(tasks.map((t) => ({ ...t, physicalDemand: t.physicalDemand ?? 'medium', archivedAt: t.archivedAt ?? null })));
    await db.updates.bulkAdd(updates);
    await db.photos.bulkAdd(photos);
    if (shopItems.length) await db.shopItems.bulkAdd(shopItems.map((i) => ({ ...i, clearedAt: i.clearedAt ?? null })));
  });
}

async function restoreZip(bytes: Uint8Array): Promise<{ projects: number; tasks: number; photos: number }> {
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(bytes, (err, out) => (err ? reject(err) : resolve(out)))
  );
  const dataRaw = entries['data.json'];
  if (!dataRaw) throw new Error('Not a Jillie backup');
  const data = JSON.parse(strFromU8(dataRaw)) as BackupZipJSON;
  if (data.app !== 'jillians-diy-projects') throw new Error('Not a Jillie backup');
  const photos: Photo[] = [];
  for (const meta of data.photos) {
    const raw = entries[meta.file];
    if (!raw) continue;
    const type = meta.type?.startsWith('image/') ? meta.type : 'image/webp';
    const blob = new Blob([raw as BlobPart], { type });
    try {
      photos.push({
        id: meta.id ?? uid(),
        taskId: meta.taskId,
        caption: meta.caption ?? '',
        blob,
        thumb: await makeThumb(blob),
        createdAt: meta.createdAt ?? Date.now()
      });
    } catch {
      // one unreadable photo shouldn't cost her the whole restore
    }
  }
  await writeRestored(data.projects, data.tasks, data.updates, data.shopItems ?? [], photos);
  return { projects: data.projects.length, tasks: data.tasks.length, photos: photos.length };
}

export async function restoreBackup(file: Blob): Promise<{ projects: number; tasks: number; photos: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // legacy zips start with "PK"
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return restoreZip(bytes);

  let data: BackupV3;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes)) as BackupV3;
  } catch {
    throw new Error('That file does not look like a backup from this app.');
  }
  if (data.app !== 'jillians-diy-projects') throw new Error('That file does not look like a backup from this app.');

  const photos: Photo[] = [];
  for (const meta of data.photos ?? []) {
    try {
      const blob = dataURLToBlob(meta.data);
      photos.push({
        id: meta.id ?? uid(),
        taskId: meta.taskId,
        caption: meta.caption ?? '',
        blob,
        thumb: await makeThumb(blob),
        createdAt: meta.createdAt ?? Date.now()
      });
    } catch {
      // one unreadable photo shouldn't cost her the whole restore
    }
  }
  await writeRestored(data.projects, data.tasks, data.updates, data.shopItems ?? [], photos);
  return { projects: data.projects.length, tasks: data.tasks.length, photos: photos.length };
}

/* ---- the gentle monthly rhythm (a soft card, never a nag) ---- */

const LAST_KEY = 'backup.lastAt';
const SNOOZE_KEY = 'backup.snoozedAt';
const MONTH = 30 * 86400000;

export function recordBackupDone(): void {
  localStorage.setItem(LAST_KEY, String(Date.now()));
}
export function snoozeBackupNudge(): void {
  localStorage.setItem(SNOOZE_KEY, String(Date.now()));
}
export function shouldNudgeBackup(hasAnyData: boolean): boolean {
  if (!hasAnyData) return false;
  const last = Number(localStorage.getItem(LAST_KEY) ?? 0);
  const snoozed = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  const start = Number(localStorage.getItem('app.firstRunAt') ?? 0);
  const anchor = Math.max(last, start);
  return Date.now() - anchor > MONTH && Date.now() - snoozed > MONTH;
}
export function noteFirstRun(): void {
  if (!localStorage.getItem('app.firstRunAt')) {
    localStorage.setItem('app.firstRunAt', String(Date.now()));
  }
}
