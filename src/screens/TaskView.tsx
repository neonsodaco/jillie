import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, active, hardDeleteTasks, taskFamilyIds, snapshotTasks, restoreTaskSnapshot, type Task, type Photo, type Priority, type PhysicalDemand, type StoreType, type Update, type Need } from '../db';
import { labelMap } from '../lib/numbering';
import { stampWords } from '../lib/dates';
import { tickMessage } from '../lib/encourage';
import { celebrateTick } from '../lib/confetti';
import { Linkify } from '../components/Linkify';
import { ShopItemEditSheet } from '../components/ShopItemSheet';
import { StorePicker } from '../components/StorePicker';
import { compressPhoto, storageTight } from '../lib/images';
import { Sheet, SheetItem, ConfirmSheet, FieldLabel, colourClass, colourStyle } from '../components/ui';
import { IconBack, IconDots, IconTick, IconTrash, IconCamera, IconPlus, IconPencil } from '../components/icons';
import { useUndo } from '../lib/undo';

export default function TaskView() {
  const { id } = useParams<{ id: string }>();
  const task = useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id]);
  if (task === undefined) return <div className="screen" />;
  if (!task || task.deletedAt !== null) {
    return (
      <div className="screen">
        <div className="empty-note">This task isn't here any more.</div>
      </div>
    );
  }
  return <TaskForm key={task.id} task={task} />;
}

function TaskForm({ task }: { task: Task }) {
  const navigate = useNavigate();
  const undo = useUndo();
  const project = useLiveQuery(() => db.projects.get(task.projectId), [task.projectId]);
  const siblings = useLiveQuery(() => db.tasks.where('projectId').equals(task.projectId).toArray(), [task.projectId]) ?? [];
  const updates = useLiveQuery(() => db.updates.where('taskId').equals(task.id).toArray(), [task.id]) ?? [];
  const photos = useLiveQuery(() => db.photos.where('taskId').equals(task.id).toArray(), [task.id]) ?? [];
  // items cleared off the shopping list are tidied off the task too
  const shopItems =
    useLiveQuery(
      () => db.shopItems.where('taskId').equals(task.id).filter((s) => s.clearedAt === null).toArray(),
      [task.id]
    ) ?? [];
  const needs = useLiveQuery(() => db.needs.where('taskId').equals(task.id).toArray(), [task.id]) ?? [];
  const live = useLiveQuery(() => db.tasks.get(task.id), [task.id]) ?? task;

  // local drafts so typing never fights the database
  const [name, setName] = useState(task.name);
  const [doneBy, setDoneBy] = useState(task.doneBy);
  const [involved, setInvolved] = useState(task.involvedNotes);
  const [newUpdate, setNewUpdate] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopStore, setShopStore] = useState<StoreType>(
    () => (localStorage.getItem('shop.lastStore') as StoreType) || 'Hardware Store'
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [confirmPhotoDelete, setConfirmPhotoDelete] = useState<Photo | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [noteMenu, setNoteMenu] = useState<Update | null>(null);
  const [editingNote, setEditingNote] = useState<Update | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [needName, setNeedName] = useState('');
  const [editingNeed, setEditingNeed] = useState<Need | null>(null);
  const [needDraft, setNeedDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // the description grows to fit its text exactly — no drag handle
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [involved]);

  const label = useMemo(() => labelMap(active(siblings)).get(task.id) ?? '', [siblings, task.id]);
  const sortedUpdates = useMemo(() => [...updates].sort((a, b) => b.createdAt - a.createdAt), [updates]);
  const sortedPhotos = useMemo(() => [...photos].sort((a, b) => a.createdAt - b.createdAt), [photos]);
  const sortedNeeds = useMemo(() => [...needs].sort((a, b) => a.createdAt - b.createdAt), [needs]);

  const save = (patch: Partial<Task>) => void db.tasks.update(task.id, patch);

  async function toggleDone(e: React.MouseEvent) {
    const markingDone = !live.done;
    await db.tasks.update(task.id, { done: markingDone, completedAt: markingDone ? Date.now() : null });
    if (markingDone && project) {
      const projectTasks = active(siblings);
      const doneAfter = projectTasks.filter((t) => (t.id === task.id ? true : t.done)).length;
      celebrateTick(e, doneAfter === projectTasks.length);
      undo.toast(tickMessage(doneAfter, projectTasks.length, project.name));
    }
  }

  async function addShopItem() {
    const itemName = shopName.trim();
    if (!itemName) return;
    setShopName(''); // clear straight away, ready for the next item
    try {
      await db.shopItems.add({
        id: uid(),
        projectId: task.projectId,
        taskId: task.id,
        name: itemName,
        store: shopStore,
        done: false,
        clearedAt: null,
        createdAt: Date.now()
      });
      localStorage.setItem('shop.lastStore', shopStore);
      undo.toast(`${itemName} added to the shopping list.`);
    } catch {
      setShopName(itemName);
      undo.toast("That didn't save — try again.");
    }
  }

  async function addNeed() {
    const itemName = needName.trim();
    if (!itemName) return;
    setNeedName(''); // clear straight away, ready for the next thing
    try {
      await db.needs.add({ id: uid(), taskId: task.id, name: itemName, packed: false, createdAt: Date.now() });
    } catch {
      setNeedName(itemName);
      undo.toast("That didn't save — try again.");
    }
  }

  function saveNeedEdit() {
    const text = needDraft.trim();
    if (!editingNeed || !text) return;
    void db.needs.update(editingNeed.id, { name: text });
    setEditingNeed(null);
  }

  function deleteNeed(n: Need) {
    setEditingNeed(null);
    void db.needs.delete(n.id).then(() => {
      undo.run({
        message: `${n.name} taken off the list.`,
        revert: () => db.needs.add(n).then(() => undefined),
        commit: () => undefined
      });
    });
  }

  async function addUpdate() {
    const text = newUpdate.trim();
    if (!text) return;
    setNewUpdate(''); // clear straight away, ready for the next note
    try {
      await db.updates.add({ id: uid(), taskId: task.id, text, createdAt: Date.now() });
    } catch {
      setNewUpdate(text);
      undo.toast("That didn't save — try again.");
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      for (const file of Array.from(files)) {
        const { blob, thumb } = await compressPhoto(file);
        await db.photos.add({ id: uid(), taskId: task.id, caption: '', blob, thumb, createdAt: Date.now() });
      }
      if (await storageTight()) {
        undo.toast('Your phone storage is getting full — a backup would be a good idea.');
      }
    } catch {
      undo.toast("That photo didn't come through — try again.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function deleteNote(u: Update) {
    setNoteMenu(null);
    void db.updates.delete(u.id).then(() => {
      undo.run({
        message: 'Note deleted.',
        revert: () => db.updates.add(u).then(() => undefined),
        commit: () => undefined
      });
    });
  }

  function saveNoteEdit() {
    const text = noteDraft.trim();
    if (!editingNote || !text) return;
    void db.updates.update(editingNote.id, { text });
    setEditingNote(null);
  }

  function deleteTask() {
    setConfirmDelete(false);
    setMenuOpen(false);
    void (async () => {
      const ids = await taskFamilyIds(task.id);
      const snap = await snapshotTasks(ids);
      await hardDeleteTasks(ids);
      undo.run({
        message: `${live.name || 'Task'} deleted.`,
        revert: () => restoreTaskSnapshot(snap),
        commit: () => undefined
      });
      navigate(-1);
    })();
  }

  function deletePhoto(p: Photo) {
    setConfirmPhotoDelete(null);
    setViewing(null);
    void db.photos.delete(p.id).then(() => undo.toast('Photo removed.'));
  }

  const colour = project ? colourClass(project.colour) : '';

  return (
    <div className={`screen ${colour}`} style={project ? colourStyle(project) : undefined}>
      <header className="topbar">
        <button className="iconbtn" aria-label="Back" onClick={() => navigate(-1)}>
          <IconBack />
        </button>
        <h1 className="topbar-title">
          {label && `${label}. `}
          {project?.name ?? ''}
        </h1>
        <div className="spacer" />
        <button className="iconbtn" aria-label="Task options" onClick={() => setMenuOpen(true)}>
          <IconDots />
        </button>
      </header>

      <div className="field">
        <FieldLabel text="Task name" help="What needs doing, in your own words." />
        <input
          type="text"
          value={name}
          placeholder="What needs doing?"
          onChange={(e) => {
            setName(e.target.value);
            save({ name: e.target.value });
          }}
        />
      </div>

      <div className="field">
        <FieldLabel text="Task description" help="What this task is about — details, names, the shop, a phone number." />
        <textarea
          ref={descRef}
          className="autogrow"
          rows={1}
          value={involved}
          placeholder="What's this task about? Details, names, numbers…"
          onChange={(e) => {
            setInvolved(e.target.value);
            save({ involvedNotes: e.target.value });
          }}
        />
      </div>

      <div className="field">
        <FieldLabel text="Priority" help="How important is this? High shows on your Today screen." />
        <div className="prio-row">
          {(['low', 'normal', 'high'] as Priority[]).map((p) => (
            <button
              key={p}
              className={`prio-btn grad-p-${p}${live.priority === p ? ' on' : ''}`}
              onClick={() => save({ priority: p })}
            >
              {p === 'low' ? 'Low' : p === 'normal' ? 'Normal' : 'High'}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <FieldLabel
          text="Energy required"
          help="How much physical energy this one takes. Guide Me uses it to suggest tasks that fit your energy on the day."
        />
        <div className="prio-row">
          {(['low', 'medium', 'high'] as PhysicalDemand[]).map((d) => (
            <button
              key={d}
              className={`prio-btn grad-e-${d}${(live.physicalDemand ?? 'medium') === d ? ' on' : ''}`}
              onClick={() => save({ physicalDemand: d })}
            >
              {d === 'low' ? 'Minimum' : d === 'medium' ? 'Moderate' : 'High'}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <FieldLabel text="To be done by" help="Who's doing this one? You, or someone helping — like Bob the plumber." />
        <input
          type="text"
          value={doneBy}
          placeholder="e.g. Me, or Bob the plumber"
          onChange={(e) => {
            setDoneBy(e.target.value);
            save({ doneBy: e.target.value });
          }}
        />
      </div>

      <div className="field">
        <FieldLabel text="Due by" help="When it should be finished. Leave it blank if there's no rush." />
        <input type="date" value={live.dueDate ?? ''} onChange={(e) => save({ dueDate: e.target.value || null })} />
      </div>

      <div className="field">
        <FieldLabel text="Photos" help="Screenshots and pictures. Found a supplier or something you like? Screenshot it, tap Share, and pick this app — or add it here from your gallery." />
        <div className="photo-grid">
          {sortedPhotos.map((p) => (
            <PhotoThumb key={p.id} photo={p} onOpen={() => setViewing(p)} />
          ))}
          <button className="photo-add" onClick={() => fileRef.current?.click()} disabled={importing}>
            <IconCamera />
            {importing ? 'Adding…' : 'Add photo'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addPhotos(e.target.files)}
        />
      </div>

      <div className="field">
        <FieldLabel
          text="Task updates and notes"
          help="Your running history for this task. Each note you add is saved with the date and time, so you can look back and see exactly what happened when."
        />
        <div className="update-add">
          <textarea
            value={newUpdate}
            placeholder="Add your notes on what you have done so far here"
            rows={2}
            onChange={(e) => setNewUpdate(e.target.value)}
          />
          <button className="btn btn-tint" disabled={!newUpdate.trim()} onClick={addUpdate}>
            <IconPlus size={16} /> Add
          </button>
        </div>
        <div className="card" style={{ padding: '0.25rem 1rem', marginTop: '0.625rem' }}>
          {sortedUpdates.length === 0 && (
            <div className="update-item" style={{ color: 'var(--ink-soft)' }}>
              No notes yet — add the first one above.
            </div>
          )}
          {sortedUpdates.map((u) => (
            <div key={u.id} className="update-item">
              <div className="update-head">
                <div className="update-when">{stampWords(u.createdAt, true)}</div>
                <button
                  className="iconbtn"
                  style={{ width: '2rem', height: '2rem' }}
                  aria-label="Note options"
                  onClick={() => setNoteMenu(u)}
                >
                  <IconDots size={16} />
                </button>
              </div>
              <Linkify text={u.text} />
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <FieldLabel
          text="Things needed for this task"
          help="Your packing list: everything to gather up before you start — tools, materials, bits from the shed. Tick each thing off as you pack it. This one's separate from the shopping list; nothing here gets bought."
        />
        {!live.done && (
          <div className="need-add">
            <input
              type="text"
              value={needName}
              placeholder="e.g. Drill, drop sheet, ladder"
              aria-label="Thing needed for this task"
              onChange={(e) => setNeedName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNeed()}
            />
            <button className="btn btn-tint" disabled={!needName.trim()} onClick={addNeed}>
              <IconPlus size={16} /> Add
            </button>
          </div>
        )}
        {sortedNeeds.length > 0 && (
          <div className="card need-list">
            {sortedNeeds.map((n) => (
              <div key={n.id} className={`need-row${n.packed ? ' packed' : ''}`}>
                <button
                  className={`tick small${n.packed ? ' on' : ''}`}
                  aria-label={n.packed ? `${n.name} — not packed after all` : `Packed ${n.name}`}
                  onClick={() => void db.needs.update(n.id, { packed: !n.packed })}
                >
                  <IconTick />
                </button>
                <button
                  className="need-name"
                  aria-label={`Change or delete ${n.name}`}
                  onClick={() => {
                    setNeedDraft(n.name);
                    setEditingNeed(n);
                  }}
                >
                  {n.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <FieldLabel
          text="Run out of something?"
          help="Pop it on the shopping list without leaving this task. Type the item, pick where it comes from, tap Add. The full list lives under Shopping at the bottom of the app."
        />
        {!live.done && (
          <div className="shop-add">
            <input
              type="text"
              value={shopName}
              placeholder="e.g. Sandpaper, 120 grit"
              aria-label="Item to add to the shopping list"
              onChange={(e) => setShopName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addShopItem()}
            />
            <div className="shop-add-row">
              <StorePicker value={shopStore} onChange={setShopStore} />
              <button className="btn btn-tint" disabled={!shopName.trim()} onClick={addShopItem}>
                <IconPlus size={16} /> Add
              </button>
            </div>
          </div>
        )}
        {live.done && shopItems.length === 0 && (
          <div style={{ color: 'var(--ink-soft)', fontSize: '0.8125rem' }}>
            This task is done, so nothing more can be added to its shopping list.
          </div>
        )}
        {shopItems.length > 0 && (
          <div className="shop-mini">
            {shopItems
              .slice()
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((s) =>
                s.done ? (
                  // bought: greyed out, no longer editable
                  <span key={s.id} className="shop-mini-item got">
                    {s.name}
                  </span>
                ) : (
                  // still to buy: bright green, tap to fix the name or store
                  <button key={s.id} className="shop-mini-item active" onClick={() => setEditingItem(s.id)}>
                    {s.name}
                  </button>
                )
              )}
            <button className="shop-mini-link" onClick={() => navigate('/shopping')}>
              See the whole list
            </button>
          </div>
        )}
        {editingItem && shopItems.some((s) => s.id === editingItem && !s.done) && (
          <ShopItemEditSheet item={shopItems.find((s) => s.id === editingItem)!} onClose={() => setEditingItem(null)} />
        )}
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: '0.5rem' }}
        onClick={() => undo.toast('All saved, Jillian.')}
      >
        Save task
      </button>

      <button className={`btn-done${live.done ? '' : ' undone'}`} onClick={toggleDone} style={{ marginTop: '0.75rem' }}>
        <IconTick size={18} /> {live.done ? 'Done — tap to reopen' : 'Mark as done'}
      </button>

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} label="Task options">
          <h2>{live.name || 'This task'}</h2>
          <SheetItem icon={<IconTrash />} label="Delete" danger onClick={() => { setConfirmDelete(true); setMenuOpen(false); }} />
        </Sheet>
      )}

      {noteMenu && (
        <Sheet onClose={() => setNoteMenu(null)} label="Note options">
          <h2>This note</h2>
          <SheetItem
            icon={<IconPencil />}
            label="Edit note"
            onClick={() => {
              setNoteDraft(noteMenu.text);
              setEditingNote(noteMenu);
              setNoteMenu(null);
            }}
          />
          <SheetItem icon={<IconTrash />} label="Delete note" danger onClick={() => deleteNote(noteMenu)} />
        </Sheet>
      )}

      {editingNeed && (
        <Sheet onClose={() => setEditingNeed(null)} label="This thing">
          <h2>This thing</h2>
          <div className="field">
            <input
              type="text"
              value={needDraft}
              onChange={(e) => setNeedDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveNeedEdit()}
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={!needDraft.trim()} onClick={saveNeedEdit}>
            Save
          </button>
          <SheetItem icon={<IconTrash />} label="Delete — take it off this list" danger onClick={() => deleteNeed(editingNeed)} />
        </Sheet>
      )}

      {editingNote && (
        <Sheet onClose={() => setEditingNote(null)} label="Edit note">
          <h2>Edit note</h2>
          <div className="field">
            <textarea value={noteDraft} rows={3} onChange={(e) => setNoteDraft(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" disabled={!noteDraft.trim()} onClick={saveNoteEdit}>
            Save
          </button>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title={`Delete ${live.name || 'this task'}?`}
          body="Its notes and photos go with it. You'll have 10 seconds to change your mind."
          confirmLabel="Delete"
          onConfirm={deleteTask}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {viewing && (
        <PhotoViewer
          photo={viewing}
          onClose={() => setViewing(null)}
          onDelete={() => setConfirmPhotoDelete(viewing)}
        />
      )}

      {confirmPhotoDelete && (
        <ConfirmSheet
          title="Remove this photo?"
          body="It will be taken off this task."
          confirmLabel="Remove"
          onConfirm={() => deletePhoto(confirmPhotoDelete)}
          onCancel={() => setConfirmPhotoDelete(null)}
        />
      )}
    </div>
  );
}

function PhotoThumb({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const url = useBlobURL(photo.thumb);
  return (
    <button className="photo-thumb" onClick={onOpen} aria-label={photo.caption || 'Photo'}>
      {url && <img src={url} alt={photo.caption || 'Photo on this task'} loading="lazy" />}
    </button>
  );
}

function PhotoViewer({ photo, onClose, onDelete }: { photo: Photo; onClose: () => void; onDelete: () => void }) {
  const url = useBlobURL(photo.blob);
  const [caption, setCaption] = useState(photo.caption);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Photo">
      <header className="topbar" style={{ padding: '0.5rem 0.75rem' }}>
        <button className="iconbtn" aria-label="Close photo" onClick={onClose}>
          <IconBack />
        </button>
        <div className="spacer" />
        <button className="iconbtn" aria-label="Remove photo" onClick={onDelete}>
          <IconTrash />
        </button>
      </header>
      <div className="vimg">{url && <img src={url} alt={photo.caption || 'Photo'} />}</div>
      <div className="vbar">
        <input
          type="text"
          value={caption}
          placeholder="Add a caption — e.g. the tap I want"
          onChange={(e) => {
            setCaption(e.target.value);
            void db.photos.update(photo.id, { caption: e.target.value });
          }}
        />
      </div>
    </div>
  );
}

function useBlobURL(blob: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
