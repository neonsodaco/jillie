import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, active, hardDeleteProject, snapshotProject, restoreProjectSnapshot, type Project } from '../db';
import { nextTask, progress } from '../lib/numbering';
import { ProgressBar, progressWords, Sheet, SheetItem, ConfirmSheet, ColourPicker, colourClass, colourStyle } from '../components/ui';
import { NewProjectSheet } from '../components/NewProjectSheet';
import { IconDots, IconArchive, IconTrash, IconPencil, IconPalette } from '../components/icons';
import { useUndo } from '../lib/undo';

export default function Projects() {
  const navigate = useNavigate();
  const undo = useUndo();
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];

  const [creating, setCreating] = useState(false);
  const [menuFor, setMenuFor] = useState<Project | null>(null);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [recolouring, setRecolouring] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const activeProjects = active(projects).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  const stats = useMemo(() => {
    const m = new Map<string, { done: number; total: number; next: string | null }>();
    for (const p of activeProjects) {
      const pt = active(tasks).filter((t) => t.projectId === p.id);
      const { done, total } = progress(pt);
      const nxt = nextTask(pt);
      m.set(p.id, { done, total, next: nxt ? `Next: ${nxt.label}. ${nxt.task.name}` : null });
    }
    return m;
  }, [activeProjects, tasks]);

  const onTheGo = activeProjects.filter((p) => {
    const s = stats.get(p.id)!;
    return s.total === 0 || s.done < s.total;
  });
  const finished = activeProjects.filter((p) => {
    const s = stats.get(p.id)!;
    return s.total > 0 && s.done === s.total;
  });

  function archiveProject(p: Project) {
    setMenuFor(null);
    void db.projects.update(p.id, { archivedAt: Date.now() });
    undo.run({
      message: `${p.name} moved to the Archive.`,
      revert: () => db.projects.update(p.id, { archivedAt: null }).then(() => undefined),
      commit: () => undefined
    });
  }

  function deleteProject(p: Project) {
    setConfirmDelete(null);
    setMenuFor(null);
    // delete NOW (a refresh can never bring it back); Undo restores the snapshot
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

  const card = (p: Project) => {
    const s = stats.get(p.id)!;
    return (
      <div key={p.id} className={`proj-card ${colourClass(p.colour)}`} style={colourStyle(p)}>
        <span className="band" aria-hidden />
        <button className="inner" onClick={() => navigate(`/project/${p.id}`)}>
          <div className="prow">
            <h3>{p.name}</h3>
          </div>
          <ProgressBar done={s.done} total={s.total} />
          <div className="progress-words">{progressWords(s.done, s.total)}</div>
          {s.next && <div className="next">{s.next}</div>}
        </button>
        <button
          className="iconbtn"
          style={{ alignSelf: 'center' }}
          aria-label={`Options for ${p.name}`}
          onClick={() => setMenuFor(p)}
        >
          <IconDots />
        </button>
      </div>
    );
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="topbar-title">All my projects</h1>
        <div className="spacer" />
      </header>

      {onTheGo.length === 0 && finished.length === 0 && (
        <div className="empty-note">
          <div className="big">No projects yet, Jillian.</div>
          What's first? Tap the button below to start one.
        </div>
      )}

      {onTheGo.map(card)}

      {finished.length > 0 && (
        <>
          <div className="finished-head">Finished — well done</div>
          {finished.map(card)}
        </>
      )}

      <button className="fab-newproject" onClick={() => setCreating(true)}>
        + New project
      </button>

      {creating && (
        <NewProjectSheet
          onClose={() => setCreating(false)}
          onCreate={(name, colour, customColour) => {
            // close first, then save — the popup never lingers
            setCreating(false);
            const id = uid();
            db.projects
              .add({ id, name, colour, customColour, archivedAt: null, deletedAt: null, createdAt: Date.now() })
              .then(() => navigate(`/project/${id}`))
              .catch(() => undo.toast("That didn't save — try again."));
          }}
        />
      )}

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)} label={`Options for ${menuFor.name}`}>
          <h2>{menuFor.name}</h2>
          <SheetItem icon={<IconPencil />} label="Rename" onClick={() => { setRenaming(menuFor); setMenuFor(null); }} />
          <SheetItem icon={<IconPalette />} label="Change colour" onClick={() => { setRecolouring(menuFor); setMenuFor(null); }} />
          <SheetItem icon={<IconArchive />} label="Archive — put it away, keep everything" onClick={() => archiveProject(menuFor)} />
          <SheetItem icon={<IconTrash />} label="Delete" danger onClick={() => { setConfirmDelete(menuFor); setMenuFor(null); }} />
        </Sheet>
      )}

      {renaming && (
        <RenameSheet
          project={renaming}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            await db.projects.update(renaming.id, { name });
            setRenaming(null);
          }}
        />
      )}

      {recolouring && (
        <Sheet onClose={() => setRecolouring(null)} label="Change colour">
          <h2>Colour for {recolouring.name}</h2>
          <ColourPicker
            value={(projects.find((p) => p.id === recolouring.id) ?? recolouring).colour}
            custom={(projects.find((p) => p.id === recolouring.id) ?? recolouring).customColour}
            onChange={async (c, custom) => {
              await db.projects.update(recolouring.id, { colour: c, customColour: custom });
              // a palette tap is final; her own pick keeps the sheet open to fiddle
              if (!custom) setRecolouring(null);
            }}
          />
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title={`Delete ${confirmDelete.name}?`}
          body="Its tasks, notes and photos go with it. You'll have 10 seconds to change your mind."
          confirmLabel="Delete"
          onConfirm={() => deleteProject(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function RenameSheet({
  project,
  onClose,
  onSave
}: {
  project: Project;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(project.name);
  return (
    <Sheet onClose={onClose} label="Rename project">
      <h2>Rename project</h2>
      <div className="field">
        <input
          type="text"
          value={name}
         
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSave(name.trim())}
        />
      </div>
      <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
        Save
      </button>
    </Sheet>
  );
}
