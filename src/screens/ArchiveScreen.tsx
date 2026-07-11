import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hardDeleteProject, hardDeleteTasks, taskFamilyIds, type Project, type Task } from '../db';
import { stampWords } from '../lib/dates';
import { ConfirmSheet, colourClass } from '../components/ui';
import { IconBack, IconTrash } from '../components/icons';
import { useUndo } from '../lib/undo';

/** Everything she's put away — viewable, restorable, never lost by accident. */
export default function ArchiveScreen() {
  const navigate = useNavigate();
  const undo = useUndo();
  const [tab, setTab] = useState<'projects' | 'tasks'>('projects');
  const [confirmKill, setConfirmKill] = useState<{ kind: 'project' | 'task'; id: string; name: string } | null>(null);

  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];

  const archivedProjects = useMemo(
    () => projects.filter((p) => p.deletedAt === null && p.archivedAt !== null).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [projects]
  );
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  // tasks archived on their own, inside projects that are still active
  const archivedTasks = useMemo(
    () =>
      tasks
        .filter((t) => {
          const p = projectsById.get(t.projectId);
          return t.deletedAt === null && t.archivedAt !== null && p && p.deletedAt === null && p.archivedAt === null;
        })
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [tasks, projectsById]
  );

  function putBackProject(p: Project) {
    void db.projects.update(p.id, { archivedAt: null });
    undo.toast(`${p.name} is back with your projects.`);
  }

  async function putBackTask(t: Task) {
    const ids = await taskFamilyIds(t.id);
    await db.tasks.where('id').anyOf(ids).modify({ archivedAt: null });
    undo.toast(`${t.name || 'Task'} is back in its project.`);
  }

  function killForever() {
    const target = confirmKill!;
    setConfirmKill(null);
    if (target.kind === 'project') {
      void db.projects.update(target.id, { deletedAt: Date.now() });
      undo.run({
        message: `${target.name} deleted.`,
        revert: () => db.projects.update(target.id, { deletedAt: null }).then(() => undefined),
        commit: () => hardDeleteProject(target.id)
      });
    } else {
      void (async () => {
        const ids = await taskFamilyIds(target.id);
        await db.tasks.where('id').anyOf(ids).modify({ deletedAt: Date.now() });
        undo.run({
          message: `${target.name} deleted.`,
          revert: () => db.tasks.where('id').anyOf(ids).modify({ deletedAt: null }).then(() => undefined),
          commit: () => hardDeleteTasks(ids)
        });
      })();
    }
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

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'projects'} className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}>
          Projects
        </button>
        <button role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>
          Tasks
        </button>
      </div>

      {tab === 'projects' && (
        <>
          {archivedProjects.length === 0 && (
            <div className="empty-note">
              <div className="big">Nothing archived.</div>
              When you archive a project, it waits here — nothing is lost.
            </div>
          )}
          {archivedProjects.map((p) => (
            <div key={p.id} className={`arch-row card ${colourClass(p.colour)}`}>
              <span className="dot" aria-hidden />
              <div className="body">
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="when">archived {stampWords(p.archivedAt!)}</div>
              </div>
              <button className="putback" onClick={() => putBackProject(p)}>
                Put back
              </button>
              <button
                className="iconbtn"
                aria-label={`Delete ${p.name} forever`}
                onClick={() => setConfirmKill({ kind: 'project', id: p.id, name: p.name })}
              >
                <IconTrash size={18} />
              </button>
            </div>
          ))}
        </>
      )}

      {tab === 'tasks' && (
        <>
          {archivedTasks.length === 0 && (
            <div className="empty-note">
              <div className="big">Nothing archived.</div>
              When you archive a task, it waits here — nothing is lost.
            </div>
          )}
          {archivedTasks.map((t) => {
            const p = projectsById.get(t.projectId)!;
            return (
              <div key={t.id} className={`arch-row card ${colourClass(p.colour)}`}>
                <span className="dot" aria-hidden />
                <div className="body">
                  <div style={{ fontWeight: 700 }}>{t.name || 'Untitled task'}</div>
                  <div className="when">
                    {p.name} · archived {stampWords(t.archivedAt!)}
                  </div>
                </div>
                <button className="putback" onClick={() => putBackTask(t)}>
                  Put back
                </button>
                <button
                  className="iconbtn"
                  aria-label={`Delete ${t.name || 'task'} forever`}
                  onClick={() => setConfirmKill({ kind: 'task', id: t.id, name: t.name || 'Task' })}
                >
                  <IconTrash size={18} />
                </button>
              </div>
            );
          })}
        </>
      )}

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
