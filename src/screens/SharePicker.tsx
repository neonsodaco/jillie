import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, active, type PendingShare } from '../db';
import { labelMap } from '../lib/numbering';
import { compressPhoto } from '../lib/images';
import { colourClass } from '../components/ui';
import { IconBack } from '../components/icons';
import { useUndo } from '../lib/undo';

/**
 * Landing screen for screenshots shared in from Android.
 * One question: which task is this for?
 */
export default function SharePicker() {
  const navigate = useNavigate();
  const { toast } = useUndo();
  const pending = useLiveQuery(() => db.pendingShares.orderBy('createdAt').toArray(), []) ?? [];
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const updates = useLiveQuery(() => db.updates.toArray(), []) ?? [];

  const [search, setSearch] = useState('');
  const [attaching, setAttaching] = useState(false);
  const current: PendingShare | undefined = pending[0];

  const activeProjects = active(projects);
  const projectsById = useMemo(() => new Map(activeProjects.map((p) => [p.id, p])), [activeProjects]);

  const labels = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of activeProjects) {
      for (const [tid, label] of labelMap(active(tasks).filter((t) => t.projectId === p.id))) m.set(tid, label);
    }
    return m;
  }, [activeProjects, tasks]);

  // recent activity first: the task she touched last is probably the one she means
  const candidates = useMemo(() => {
    const lastTouch = new Map<string, number>();
    for (const u of updates) lastTouch.set(u.taskId, Math.max(lastTouch.get(u.taskId) ?? 0, u.createdAt));
    const open = active(tasks).filter((t) => !t.done && projectsById.has(t.projectId));
    const q = search.trim().toLowerCase();
    return open
      .filter((t) => !q || t.name.toLowerCase().includes(q) || projectsById.get(t.projectId)!.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Math.max(lastTouch.get(b.id) ?? 0, b.createdAt) - Math.max(lastTouch.get(a.id) ?? 0, a.createdAt)
      )
      .slice(0, 30);
  }, [tasks, updates, search, projectsById]);

  const [previewURL, setPreviewURL] = useState<string | null>(null);
  useEffect(() => {
    if (!current) {
      setPreviewURL(null);
      return;
    }
    const u = URL.createObjectURL(current.blob);
    setPreviewURL(u);
    return () => URL.revokeObjectURL(u);
  }, [current?.id]);

  if (!current) {
    return (
      <div className="screen">
        <header className="topbar">
          <button className="iconbtn" aria-label="Back" onClick={() => navigate('/')}>
            <IconBack />
          </button>
          <h1 className="topbar-title">Shared photos</h1>
        </header>
        <div className="empty-note">
          <div className="big">All done.</div>
          Nothing waiting to be added.
        </div>
      </div>
    );
  }

  async function attachTo(taskId: string) {
    if (attaching) return;
    setAttaching(true);
    try {
      const { blob, thumb } = await compressPhoto(current!.blob);
      await db.photos.add({ id: uid(), taskId, caption: '', blob, thumb, createdAt: Date.now() });
      await db.pendingShares.delete(current!.id);
      const remaining = pending.length - 1;
      if (remaining > 0) {
        toast(`Added. ${remaining} more to place.`);
      } else {
        toast('Photo added to the task.');
        navigate(`/task/${taskId}`);
      }
    } catch {
      toast("That photo didn't come through — try again.");
    } finally {
      setAttaching(false);
    }
  }

  async function discard() {
    await db.pendingShares.delete(current!.id);
    if (pending.length - 1 === 0) navigate('/');
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconbtn" aria-label="Back" onClick={() => navigate('/')}>
          <IconBack />
        </button>
        <h1 className="topbar-title">Which task is this for?</h1>
        <div className="spacer" />
      </header>

      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {previewURL && (
          <img
            src={previewURL}
            alt="The photo you shared"
            style={{ width: '4.5rem', height: '4.5rem', objectFit: 'cover', borderRadius: '0.75rem', flex: 'none' }}
          />
        )}
        <div style={{ flex: 1, color: 'var(--ink-soft)' }}>
          Pick the task this belongs to{pending.length > 1 ? ` (${pending.length} photos to place)` : ''}.
        </div>
        <button className="btn btn-ghost" onClick={discard}>
          Skip
        </button>
      </div>

      <div className="field">
        <input
          type="text"
          value={search}
          placeholder="Search your tasks…"
          aria-label="Search your tasks"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {candidates.length === 0 && (
        <div className="empty-note">
          No open tasks match. Add the task first, then share the screenshot again.
        </div>
      )}

      {candidates.map((t) => {
        const p = projectsById.get(t.projectId)!;
        return (
          <button
            key={t.id}
            className={`feed-item card ${colourClass(p.colour)}`}
            disabled={attaching}
            onClick={() => attachTo(t.id)}
          >
            <span className="dot" aria-hidden />
            {labels.get(t.id) && <span className="stepno">{labels.get(t.id)}</span>}
            <span className="body">
              <span className="name">{t.name || 'Untitled task'}</span>
              <span className="why">{p.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
