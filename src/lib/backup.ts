import { zip, unzip, strToU8, strFromU8, type Zippable } from 'fflate';
import { db, uid, type Project, type Task, type Update, type Photo, type ShopItem } from '../db';
import { makeThumb } from './images';

/**
 * Backup = one dated .zip: data.json + every photo as a plain image file.
 * Readable outside the app — Jillian's data is never hostage to it.
 * Saved via the Android share sheet, straight into her own Google Drive.
 */

interface BackupJSON {
  app: string;
  version: 1 | 2;
  exportedAt: number;
  projects: Project[];
  tasks: Task[];
  updates: Update[];
  photos: (Omit<Photo, 'blob' | 'thumb'> & { file: string; type: string })[];
  shopItems?: ShopItem[];
}

const extFor = (type: string) => (type.includes('webp') ? 'webp' : type.includes('png') ? 'png' : 'jpg');

function zipAsync(data: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(data, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out)))
  );
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) =>
    unzip(data, (err, out) => (err ? reject(err) : resolve(out)))
  );
}

export function backupFilename(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `diy-backup-${dd}-${mm}-${d.getFullYear()}.zip`;
}

export async function buildBackup(): Promise<File> {
  const [projects, tasks, updates, photos, shopItems] = await Promise.all([
    db.projects.toArray(),
    db.tasks.toArray(),
    db.updates.toArray(),
    db.photos.toArray(),
    db.shopItems.toArray()
  ]);
  const files: Zippable = {};
  const photoMeta: BackupJSON['photos'] = [];
  for (const p of photos) {
    const file = `photos/${p.id}.${extFor(p.blob.type)}`;
    files[file] = new Uint8Array(await p.blob.arrayBuffer());
    photoMeta.push({ id: p.id, taskId: p.taskId, caption: p.caption, createdAt: p.createdAt, file, type: p.blob.type });
  }
  const data: BackupJSON = {
    app: 'jillians-diy-projects',
    version: 2,
    exportedAt: Date.now(),
    projects,
    tasks,
    updates,
    photos: photoMeta,
    shopItems
  };
  files['data.json'] = strToU8(JSON.stringify(data, null, 2));
  const bytes = await zipAsync(files);
  return new File([bytes as BlobPart], backupFilename(), { type: 'application/zip' });
}

/** Share to Drive via the share sheet where possible, otherwise download. */
export async function shareBackup(file: File): Promise<'shared' | 'downloaded'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'DIY Projects backup' });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') throw err; // she changed her mind
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}

export async function restoreBackup(zipFile: Blob): Promise<{ projects: number; tasks: number; photos: number }> {
  const entries = await unzipAsync(new Uint8Array(await zipFile.arrayBuffer()));
  const dataRaw = entries['data.json'];
  if (!dataRaw) throw new Error('That file does not look like a backup from this app.');
  const data = JSON.parse(strFromU8(dataRaw)) as BackupJSON;
  if (data.app !== 'jillians-diy-projects') throw new Error('That file does not look like a backup from this app.');

  const photos: Photo[] = [];
  for (const meta of data.photos) {
    const bytes = entries[meta.file];
    if (!bytes) continue;
    const blob = new Blob([bytes as BlobPart], { type: meta.type || 'image/webp' });
    photos.push({
      id: meta.id ?? uid(),
      taskId: meta.taskId,
      caption: meta.caption ?? '',
      blob,
      thumb: await makeThumb(blob),
      createdAt: meta.createdAt ?? Date.now()
    });
  }

  await db.transaction('rw', db.projects, db.tasks, db.updates, db.photos, db.shopItems, async () => {
    await Promise.all([db.projects.clear(), db.tasks.clear(), db.updates.clear(), db.photos.clear(), db.shopItems.clear()]);
    await db.projects.bulkAdd(data.projects);
    // older backups predate the physical-demand field
    await db.tasks.bulkAdd(data.tasks.map((t) => ({ ...t, physicalDemand: t.physicalDemand ?? 'medium' })));
    await db.updates.bulkAdd(data.updates);
    await db.photos.bulkAdd(photos);
    if (data.shopItems?.length) await db.shopItems.bulkAdd(data.shopItems);
  });

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
