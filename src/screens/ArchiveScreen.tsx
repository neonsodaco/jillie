import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hardDeleteProject, snapshotProject, restoreProjectSnapshot, type Project } from '../db';
import { stampWords } from '../lib/dates';
import { ConfirmSheet, colourClass, colourStyle } from '../components/ui';
import { IconBack, IconTrash } from '../components/icons';
import { useUndo } from '../lib/undo';

/** Projects she's put away — viewable, restorable, never lost by accident. */
export default function ArchiveScreen() {
  const navigate = useNavigate();
  const undo = useUndo();
  const [confirmKill, setConfirmKill] = useState<Project | null>(null);

  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];

  const archivedProjects = useMemo(
    () =>
      projects
        .filter((p) => p.deletedAt === null && p.archivedAt !== null)
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [projects]
  );

  function putBack(p: Project) {
    void db.projects.update(p.id, { archivedAt: null });
    undo.toast(`${p.name} is back with your projects.`);
  }

  function killForever() {
    const p = confirmKill!;
    setConfirmKill(null);
    void (async () => {
      const snap = await snapshotProject(p.id);
      await hardDeleteProject(p.id);
      undo.run({
        message: `${p.name} deleted.`,
        revert: () => restoreProjectSnapshot(snap),
        commit: () => undefined
      });
    })();
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconbtn" aria-label="Back" onClick={() => navigate(-1)}>
          <IconBack />
        </button>
        <h1 className="topbar-title">Archive</h1>
        <div className="spacer" />
      </header>

      {archivedProjects.length === 0 && (
        <div className="empty-note">
          <div className="big">Nothing archived.</div>
          When you archive a project, it waits here — nothing is lost.
        </div>
      )}

      {archivedProjects.map((p) => (
        <div key={p.id} className={`arch-row card ${colourClass(p.colour)}`} style={colourStyle(p)}>
          <span className="dot" aria-hidden />
          <div className="body">
            <div style={{ fontWeight: 700 }}>{p.name}</div>
            <div className="when">archived {stampWords(p.archivedAt!)}</div>
          </div>
          <button className="putback" onClick={() => putBack(p)}>
            Put back
          </button>
          <button
            className="iconbtn"
            aria-label={`Delete ${p.name} forever`}
            onClick={() => setConfirmKill(p)}
          >
            <IconTrash size={18} />
          </button>
        </div>
      ))}

      {confirmKill && (
        <ConfirmSheet
          title={`Delete ${confirmKill.name} forever?`}
          body="This takes it out of the Archive for good. You'll have 10 seconds to change your mind."
          confirmLabel="Delete forever"
          onConfirm={killForever}
          onCancel={() => setConfirmKill(null)}
        />
      )}
    </div>
  );
}
