import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { restoreBackup } from '../lib/backup';
import { IconBack } from '../components/icons';
import { ConfirmSheet } from '../components/ui';
import { BackupSheet } from '../components/BackupSheet';
import { useUndo } from '../lib/undo';

/** One friendly page. No tech words. Everything she might forget, findable. */
export default function HelpScreen() {
  const navigate = useNavigate();
  const { toast } = useUndo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doRestore() {
    const file = pendingRestore!;
    setPendingRestore(null);
    try {
      setBusy(true);
      const counts = await restoreBackup(file);
      toast(`All back: ${counts.projects} projects, ${counts.tasks} tasks, ${counts.photos} photos.`);
      navigate('/');
    } catch {
      toast('That file does not look like a backup from this app.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconbtn" aria-label="Back" onClick={() => navigate(-1)}>
          <IconBack />
        </button>
        <h1 className="topbar-title">How this works</h1>
        <div className="spacer" />
      </header>

      <div className="help-section">
        <h2>Your Today screen</h2>
        <p>
          Open the app and it shows you what needs you today: anything running late, anything due, anything
          important, and anything you haven't touched in a while. Each line says why it's there. If the screen
          says nothing needs you — believe it, and enjoy the cuppa.
        </p>
      </div>

      <div className="help-section">
        <h2>Projects and their colours</h2>
        <p>
          Every project gets its own colour, and that colour follows it everywhere — so a glance tells you what
          belongs to what. The bar under each project fills up as you tick things off, and it always says it in
          words too: "7 of 12 things done".
        </p>
      </div>

      <div className="help-section">
        <h2>Tasks and step numbers</h2>
        <p>
          Inside a project, tasks are numbered in order — 1, 2, 3. A task can have smaller steps under it: 3.1,
          3.2. You never type the numbers; the app does them for you. Drag the dots on the left of a task to
          change the order, and the numbers sort themselves out.
        </p>
        <p>To add a task fast: type it in the bar at the bottom of a project and tap Add. Done.</p>
      </div>

      <div className="help-section">
        <h2>Adding a screenshot to a task</h2>
        <p>
          See something while you're browsing — a supplier, a tap you like? Take a screenshot, tap
          <strong> Share</strong> on it, and choose this app. It will ask "Which task is this for?" — tap the
          task, done. You can also add photos from your gallery inside any task.
        </p>
      </div>

      <div className="help-section">
        <h2>Notes — the story of a task</h2>
        <p>
          Every task has a Notes box. Each note you add is saved with the date and time, newest at the top —
          so "who did I ring about this, and when?" is always one look away. Pop a web link in a note and it
          becomes tappable — it opens in your browser.
        </p>
      </div>

      <div className="help-section">
        <h2>The shopping list</h2>
        <p>
          Run out of something mid-job? On the task there's a "Run out of something?" box — type the item, pick
          the kind of shop it comes from, tap Add, and get on with what you were doing. The full list lives
          under <strong>Shopping</strong> at the bottom, sorted by store — and you can narrow it to one project
          or one kind of shop before you head out. Tap any item on the list to fix its name or store, and tick
          it off as you buy. "Clear ticked items" just tidies the Bought pile off this list — everything always
          stays on its task. On the task, green items are still to buy; grey means bought.
        </p>
      </div>

      <div className="help-section">
        <h2>Guide Me — for low-energy days</h2>
        <p>
          Tap <strong>Guide Me</strong> and tell it how you're feeling — taking it gently, somewhere in the
          middle, or full of beans. It looks at how big each job is (the "How big a job is it?" buttons on each
          task) and shows you the most useful thing that fits your energy today. On a gentle day it only offers
          gentle jobs — one tick on a low day is a good day's work.
        </p>
      </div>

      <div className="help-section">
        <h2>The little "?" circles</h2>
        <p>Anywhere you see a small ?, tap it and it tells you what that box is for. Tap again to hide it.</p>
      </div>

      <div className="help-section">
        <h2>Archive and delete</h2>
        <p>
          <strong>Archive</strong> puts a whole project away but keeps every task, note and photo — you'll find
          it in the Archive (the three dots on your Today screen), and you can put it back any time.
          <strong> Delete</strong> is for real mistakes. After a delete you get 10 seconds to change your mind,
          and you can dismiss that little black bar early with its ✕ if it's in your way.
        </p>
      </div>

      <div className="help-section">
        <h2>Backups — your safety net</h2>
        <p>
          Everything lives on your phone. A backup puts a copy in your Google Drive, so a lost or broken phone
          can't take your projects with it. Tap Save a backup, give it a moment to pack, then tap
          <strong> Send to Google Drive</strong> and pick Save to Drive. Once a month is plenty.
        </p>
        <div className="card" style={{ padding: '0.875rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => setBackupOpen(true)}>
            Save a backup
          </button>
          <button className="btn btn-tint" disabled={busy} onClick={() => fileRef.current?.click()}>
            Restore from backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => e.target.files?.[0] && setPendingRestore(e.target.files[0])}
          />
        </div>
      </div>

      {backupOpen && <BackupSheet onClose={() => setBackupOpen(false)} />}

      {pendingRestore && (
        <ConfirmSheet
          title="Restore from this backup?"
          body="Everything currently in the app will be replaced by what's in the backup file."
          confirmLabel="Restore"
          onConfirm={doRestore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </div>
  );
}
