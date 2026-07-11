import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, active, hardDeleteProject, hardDeleteTasks, taskFamilyIds, type Task } from '../db';
import { numberTasks, appendOrder, orderAt, progress, type NumberedTask } from '../lib/numbering';
import { dueLine, stampWords } from '../lib/dates';
import { tickMessage } from '../lib/encourage';
import { celebrateTick } from '../lib/confetti';
import { Linkify } from '../components/Linkify';
import { ProgressBar, progressWords, Sheet, SheetItem, ConfirmSheet, ColourPicker, colourClass } from '../components/ui';
import { IconBack, IconDots, IconTick, IconGrip, IconArchive, IconTrash, IconPencil, IconPalette, IconPlus, IconCamera, IconFlag } from '../components/icons';
import { useUndo } from '../lib/undo';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const undo = useUndo();

  const project = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id]);
  const allTasks = useLiveQuery(() => (id ? db.tasks.where('projectId').equals(id).toArray() : []), [id]) ?? [];
  const photos = useLiveQuery(() => db.photos.toArray(), []) ?? [];
  const allUpdates = useLiveQuery(() => db.updates.toArray(), []) ?? [];

  const [quickName, setQuickName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [recolouring, setRecolouring] = useState(false);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const [taskMenu, setTaskMenu] = useState<NumberedTask | null>(null);
  const [confirmTaskDelete, setConfirmTaskDelete] = useState<NumberedTask | null>(null);
  const [renameText, setRenameText] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);
  const addBusy = useRef(false); // double-tap guard: one add at a time
  const lastOrder = useRef(0); // keeps step order monotonic during rapid entry

  // live rows for this screen
  const tasks = useMemo(() => active(allTasks), [allTasks]);
  const numbered = useMemo(() => numberTasks(tasks), [tasks]);
  const { done, total } = progress(tasks);
  const allDone = total > 0 && done === total;

  // the two freshest notes across every task in this project
  const latestNotes = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return allUpdates
      .filter((u) => byId.has(u.taskId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 2)
      .map((u) => ({ update: u, task: byId.get(u.taskId)! }));
  }, [allUpdates, tasks]);

  const photoCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of photos) m.set(p.taskId, (m.get(p.taskId) ?? 0) + 1);
    return m;
  }, [photos]);

  // ---- drag to reorder (within the same level) ----
  const drag = useRef<{ id: string; parentId: string | null } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function dragStart(e: React.PointerEvent, t: Task) {
    drag.current = { id: t.id, parentId: t.parentTaskId };
    setDraggingId(t.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function dragMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-taskid]') as HTMLElement | null;
    const targetId = el?.dataset.taskid ?? null;
    if (!targetId || targetId === drag.current.id) return;
    const target = tasks.find((t) => t.id === targetId);
    if (target && target.parentTaskId === drag.current.parentId) setOverId(targetId);
  }
  async function dragEnd() {
    const d = drag.current;
    const over = overId;
    drag.current = null;
    setDraggingId(null);
    setOverId(null);
    if (!d || !over || over === d.id) return;
    const siblings = tasks
      .filter((t) => t.parentTaskId === d.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const targetIndex = siblings.filter((s) => s.id !== d.id).findIndex((s) => s.id === over);
    if (targetIndex < 0) return;
    const moving = siblings.find((s) => s.id === d.id);
    const target = siblings.find((s) => s.id === over)!;
    // dropping below when moving down, above when moving up
    const movingIdx = siblings.findIndex((s) => s.id === d.id);
    const overIdx = siblings.findIndex((s) => s.id === over);
    const insertAt = movingIdx < overIdx ? targetIndex + 1 : targetIndex;
    if (moving) await db.tasks.update(d.id, { sortOrder: orderAt(siblings, insertAt, d.id) });
    void target;
  }

  if (!project || project.deletedAt !== null) {
    return (
      <div className="screen">
        <header className="topbar">
          <Link to="/projects" className="iconbtn" aria-label="Back to projects">
            <IconBack />
          </Link>
        </header>
        <div className="empty-note">This project isn't here any more.</div>
      </div>
    );
  }

  async function addQuick() {
    const name = quickName.trim();
    if (!name || !id || addBusy.current) return;
    addBusy.current = true;
    // clear the field straight away so she can type the next task immediately
    setQuickName('');
    quickRef.current?.focus();
    const tops = tasks.filter((t) => t.parentTaskId === null);
    const order = Math.max(appendOrder(tops), lastOrder.current + 1);
    lastOrder.current = order;
    try {
      await db.tasks.add({
        id: uid(),
        projectId: id,
        parentTaskId: null,
        sortOrder: order,
        name,
        priority: 'normal',
        physicalDemand: 'medium',
        done: false,
        archivedAt: null,
        deletedAt: null,
        doneBy: '',
        dueDate: null,
        involvedNotes: '',
        createdAt: Date.now(),
        completedAt: null
      });
    } catch {
      setQuickName(name);
      undo.toast("That didn't save — try again.");
    } finally {
      addBusy.current = false;
    }
  }

  async function addSubStep(parent: NumberedTask) {
    setTaskMenu(null);
    if (!id) return;
    const siblings = tasks.filter((t) => t.parentTaskId === parent.task.id);
    const newId = uid();
    await db.tasks.add({
      id: newId,
      projectId: id,
      parentTaskId: parent.task.id,
      sortOrder: appendOrder(siblings),
      name: '',
      priority: 'normal',
      physicalDemand: 'medium',
      done: false,
      archivedAt: null,
      deletedAt: null,
      doneBy: '',
      dueDate: null,
      involvedNotes: '',
      createdAt: Date.now(),
      completedAt: null
    });
    navigate(`/task/${newId}`);
  }

  async function toggleDone(t: Task, e: React.MouseEvent) {
    const markingDone = !t.done;
    await db.tasks.update(t.id, { done: markingDone, completedAt: markingDone ? Date.now() : null });
    if (markingDone && project) {
      const doneAfter = tasks.filter((x) => (x.id === t.id ? true : x.done)).length;
      celebrateTick(e, doneAfter === tasks.length);
      undo.toast(tickMessage(doneAfter, tasks.length, project.name));
    }
  }

  function deleteTask(n: NumberedTask) {
    setConfirmTaskDelete(null);
    setTaskMenu(null);
    void (async () => {
      const ids = await taskFamilyIds(n.task.id);
      await db.tasks.where('id').anyOf(ids).modify({ deletedAt: Date.now() });
      undo.run({
        message: `${n.task.name || 'Task'} deleted.`,
        revert: () => db.tasks.where('id').anyOf(ids).modify({ deletedAt: null }).then(() => undefined),
        commit: () => hardDeleteTasks(ids)
      });
    })();
  }

  function archiveProject() {
    setMenuOpen(false);
    void db.projects.update(project!.id, { archivedAt: Date.now() });
    undo.run({
      message: `${project!.name} moved to the Archive.`,
      revert: () => db.projects.update(project!.id, { archivedAt: null }).then(() => undefined),
      commit: () => undefined
    });
    navigate('/projects');
  }

  function deleteProject() {
    setConfirmProjectDelete(false);
    setMenuOpen(false);
    const p = project!;
    void db.projects.update(p.id, { deletedAt: Date.now() });
    undo.run({
      message: `${p.name} deleted.`,
      revert: () => db.projects.update(p.id, { deletedAt: null }).then(() => undefined),
      commit: () => hardDeleteProject(p.id)
    });
    navigate('/projects');
  }

  return (
    <div className={`screen ${colourClass(project.colour)}`}>
      <header className="topbar">
        <button className="iconbtn" aria-label="Back" onClick={() => navigate(-1)}>
          <IconBack />
        </button>
        <h1 className="topbar-title">{project.name}</h1>
        <div className="spacer" />
        <button className="iconbtn" aria-label="Project options" onClick={() => setMenuOpen(true)}>
          <IconDots />
        </button>
      </header>

      <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '1rem' }}>
        <ProgressBar done={done} total={total} finishedGlow />
        <div className="progress-words">{progressWords(done, total)}</div>
      </div>

      {allDone && <div className="celebrate">Project finished — well done, Jillian.</div>}

      {latestNotes.length > 0 && (
        <>
          <div className="feed-head">Latest updates</div>
          <div className="card" style={{ padding: '0.25rem 1rem', marginBottom: '1rem' }}>
            {latestNotes.map(({ update, task: noteTask }) => (
              <button
                key={update.id}
                className="update-item latest-note"
                onClick={() => navigate(`/task/${noteTask.id}`)}
              >
                <div className="update-when">
                  {stampWords(update.createdAt, true)} · {noteTask.name || 'Untitled task'}
                </div>
                <Linkify text={update.text} />
              </button>
            ))}
          </div>
        </>
      )}

      {numbered.length === 0 && (
        <div className="empty-note">
          <div className="big">No tasks yet.</div>
          Add the first one below — just type it and tap Add.
        </div>
      )}

      {numbered.map((n) => {
        const t = n.task;
        const due = t.dueDate && !t.done ? dueLine(t.dueDate) : null;
        const nPhotos = photoCount.get(t.id) ?? 0;
        return (
          <div
            key={t.id}
            data-taskid={t.id}
            className={`task-row${n.isSub ? ' sub' : ''}${t.done ? ' done' : ''}${draggingId === t.id ? ' dragging' : ''}`}
            style={overId === t.id ? { outline: '2px dashed var(--c)', outlineOffset: 2 } : undefined}
          >
            <span
              className="drag-handle"
              aria-hidden
              onPointerDown={(e) => dragStart(e, t)}
              onPointerMove={dragMove}
              onPointerUp={dragEnd}
              onPointerCancel={dragEnd}
            >
              <IconGrip />
            </span>
            <span className="num-chip">{n.label}</span>
            <button className="tbody" onClick={() => navigate(`/task/${t.id}`)}>
              <div className="tname">
                {t.priority === 'high' && (
                  <span className="flag" aria-label="High priority">
                    <IconFlag size={12} />{' '}
                  </span>
                )}
                {t.name || 'Untitled task'}
              </div>
              <div className="tmeta">
                {due && <span className={due.overdue ? 'overdue' : ''}>{due.text}</span>}
                {t.doneBy && <span>{t.doneBy}</span>}
                {nPhotos > 0 && (
                  <span>
                    <IconCamera size={11} /> {nPhotos}
                  </span>
                )}
              </div>
            </button>
            <button className="iconbtn" style={{ width: '2.25rem', height: '2.25rem' }} aria-label={`Options for ${t.name}`} onClick={() => setTaskMenu(n)}>
              <IconDots size={18} />
            </button>
            <button className={`tick${t.done ? ' on' : ''}`} aria-label={t.done ? 'Mark as not done' : 'Mark as done'} onClick={(e) => toggleDone(t, e)}>
              <IconTick />
            </button>
          </div>
        );
      })}

      <div className="quickadd">
        <input
          ref={quickRef}
          type="text"
          value={quickName}
          placeholder="Add a task…"
          aria-label="Add a task"
          onChange={(e) => setQuickName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addQuick()}
        />
        <button className="addbtn" disabled={!quickName.trim()} onClick={addQuick}>
          Add
        </button>
      </div>

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} label="Project options">
          <h2>{project.name}</h2>
          <SheetItem icon={<IconPencil />} label="Rename" onClick={() => { setRenameText(project.name); setRenaming(true); setMenuOpen(false); }} />
          <SheetItem icon={<IconPalette />} label="Change colour" onClick={() => { setRecolouring(true); setMenuOpen(false); }} />
          <SheetItem icon={<IconArchive />} label="Archive — put it away, keep everything" onClick={archiveProject} />
          <SheetItem icon={<IconTrash />} label="Delete" danger onClick={() => { setConfirmProjectDelete(true); setMenuOpen(false); }} />
        </Sheet>
      )}

      {renaming && (
        <Sheet onClose={() => setRenaming(false)} label="Rename project">
          <h2>Rename project</h2>
          <div className="field">
            <input type="text" value={renameText} onChange={(e) => setRenameText(e.target.value)} />
          </div>
          <button
            className="btn btn-primary btn-block"
            disabled={!renameText.trim()}
            onClick={async () => {
              await db.projects.update(project.id, { name: renameText.trim() });
              setRenaming(false);
            }}
          >
            Save
          </button>
        </Sheet>
      )}

      {recolouring && (
        <Sheet onClose={() => setRecolouring(false)} label="Change colour">
          <h2>Colour for {project.name}</h2>
          <ColourPicker
            value={project.colour}
            onChange={async (c) => {
              await db.projects.update(project.id, { colour: c });
              setRecolouring(false);
            }}
          />
        </Sheet>
      )}

      {taskMenu && (
        <Sheet onClose={() => setTaskMenu(null)} label="Task options">
          <h2>
            {taskMenu.label}. {taskMenu.task.name || 'Untitled task'}
          </h2>
          {!taskMenu.isSub && (
            <SheetItem icon={<IconPlus />} label={`Add a step under this (becomes ${taskMenu.label}.1, ${taskMenu.label}.2…)`} onClick={() => addSubStep(taskMenu)} />
          )}
          <SheetItem icon={<IconTrash />} label="Delete" danger onClick={() => { setConfirmTaskDelete(taskMenu); setTaskMenu(null); }} />
        </Sheet>
      )}

      {confirmTaskDelete && (
        <ConfirmSheet
          title={`Delete ${confirmTaskDelete.task.name || 'this task'}?`}
          body={
            confirmTaskDelete.isSub
              ? "Its notes and photos go with it. You'll have 10 seconds to change your mind."
              : "Its sub-steps, notes and photos go with it. You'll have 10 seconds to change your mind."
          }
          confirmLabel="Delete"
          onConfirm={() => deleteTask(confirmTaskDelete)}
          onCancel={() => setConfirmTaskDelete(null)}
        />
      )}

      {confirmProjectDelete && (
        <ConfirmSheet
          title={`Delete ${project.name}?`}
          body="Its tasks, notes and photos go with it. You'll have 10 seconds to change your mind."
          confirmLabel="Delete"
          onConfirm={deleteProject}
          onCancel={() => setConfirmProjectDelete(false)}
        />
      )}
    </div>
  );
}
