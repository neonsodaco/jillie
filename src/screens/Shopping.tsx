import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, active, STORE_TYPES, type ColourKey, type StoreType, type ShopItem } from '../db';
import { Sheet, colourClass, FieldLabel } from '../components/ui';
import { ShopItemEditSheet } from '../components/ShopItemSheet';
import { IconTick, IconTrash, IconPlus } from '../components/icons';
import { useUndo } from '../lib/undo';

/**
 * The whole shopping list, across every project — filterable by project
 * and by store type, so one trip to the hardware store covers everything.
 */
export default function Shopping() {
  const undo = useUndo();
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const items = useLiveQuery(() => db.shopItems.toArray(), []) ?? [];

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShopItem | null>(null);

  const activeProjects = active(projects).sort((a, b) => a.createdAt - b.createdAt);
  const projectsById = useMemo(() => new Map(activeProjects.map((p) => [p.id, p])), [activeProjects]);

  const visible = useMemo(
    () =>
      items
        .filter((i) => projectsById.has(i.projectId))
        .filter((i) => projectFilter === 'all' || i.projectId === projectFilter)
        .filter((i) => storeFilter === 'all' || i.store === storeFilter)
        .sort((a, b) => a.createdAt - b.createdAt),
    [items, projectsById, projectFilter, storeFilter]
  );
  const toBuy = visible.filter((i) => !i.done);
  const gotIt = visible.filter((i) => i.done);

  // group the to-buy list by store so a shop trip reads top to bottom
  const byStore = useMemo(() => {
    const m = new Map<string, ShopItem[]>();
    for (const i of toBuy) {
      const list = m.get(i.store) ?? [];
      list.push(i);
      m.set(i.store, list);
    }
    return [...m.entries()];
  }, [toBuy]);

  async function toggle(item: ShopItem) {
    await db.shopItems.update(item.id, { done: !item.done });
  }

  function clearGot() {
    const cleared = [...gotIt];
    void db.shopItems.bulkDelete(cleared.map((i) => i.id));
    undo.run({
      message: `${cleared.length} ticked item${cleared.length === 1 ? '' : 's'} cleared.`,
      revert: () => db.shopItems.bulkAdd(cleared).then(() => undefined),
      commit: () => undefined
    });
  }

  const row = (item: ShopItem) => {
    const p = projectsById.get(item.projectId)!;
    return (
      <div key={item.id} className={`shop-row card ${colourClass(p.colour)}${item.done ? ' got' : ''}`}>
        <button
          className={`tick small${item.done ? ' on' : ''}`}
          aria-label={item.done ? `Mark ${item.name} as still needed` : `Got ${item.name}`}
          onClick={() => toggle(item)}
        >
          <IconTick />
        </button>
        {item.done ? (
          <div className="body">
            <div className="iname">{item.name}</div>
            <div className="imeta">
              {p.name}
              {storeFilter === 'all' ? '' : ` · ${item.store}`}
            </div>
          </div>
        ) : (
          <button className="body editable" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}>
            <div className="iname">{item.name}</div>
            <div className="imeta">
              {p.name}
              {storeFilter === 'all' ? '' : ` · ${item.store}`}
            </div>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="topbar-title">Shopping list</h1>
        <div className="spacer" />
      </header>

      <div className="filter-row">
        <select value={projectFilter} aria-label="Show items for" onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="all">All projects</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={storeFilter} aria-label="Show items from" onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="all">All stores</option>
          {STORE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {toBuy.length === 0 && gotIt.length === 0 && (
        <div className="empty-note">
          <div className="big">Nothing on the list.</div>
          Run out of something while you're working? Add it from the task, or with the button below.
        </div>
      )}

      {byStore.map(([store, list]) => (
        <section key={store}>
          {storeFilter === 'all' && <div className="feed-head">{store}</div>}
          {list.map(row)}
        </section>
      ))}

      {gotIt.length > 0 && (
        <>
          <div className="feed-head">In the trolley</div>
          {gotIt.map(row)}
          <button className="btn btn-ghost btn-block" onClick={clearGot}>
            <IconTrash size={16} /> Clear ticked items
          </button>
        </>
      )}

      <button className="fab-newproject" onClick={() => setAdding(true)} disabled={activeProjects.length === 0}>
        + Add to the list
      </button>

      {editing && <ShopItemEditSheet item={editing} onClose={() => setEditing(null)} />}

      {adding && (
        <AddItemSheet
          projects={activeProjects.map((p) => ({ id: p.id, name: p.name, colour: p.colour }))}
          defaultProject={projectFilter !== 'all' ? projectFilter : activeProjects[0]?.id}
          onClose={() => setAdding(false)}
          onAdd={(name, projectId, store) => {
            // close first, then save — the popup never lingers
            setAdding(false);
            db.shopItems
              .add({ id: uid(), projectId, taskId: null, name, store, done: false, createdAt: Date.now() })
              .then(() => localStorage.setItem('shop.lastStore', store))
              .catch(() => undo.toast("That didn't save — try again."));
          }}
        />
      )}
    </div>
  );
}

function AddItemSheet({
  projects,
  defaultProject,
  onClose,
  onAdd
}: {
  projects: { id: string; name: string; colour: ColourKey }[];
  defaultProject?: string;
  onClose: () => void;
  onAdd: (name: string, projectId: string, store: StoreType) => void;
}) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(defaultProject ?? projects[0]?.id ?? '');
  const [store, setStore] = useState<StoreType>(
    () => (localStorage.getItem('shop.lastStore') as StoreType) || 'Hardware Store'
  );
  return (
    <Sheet onClose={onClose} label="Add to the shopping list">
      <h2>Add to the shopping list</h2>
      <div className="field">
        <FieldLabel text="What do you need?" help="Just the item — 'Sandpaper, 120 grit', 'White gloss paint'." />
        <input type="text" value={name} placeholder="e.g. Sandpaper, 120 grit" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <FieldLabel text="Which project is it for?" help="So the list can be sorted per project." />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <FieldLabel text="Where from?" help="The kind of shop it comes from — handy for doing one store in one trip." />
        <select value={store} onChange={(e) => setStore(e.target.value as StoreType)}>
          {STORE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={!name.trim() || !projectId}
        onClick={() => onAdd(name.trim(), projectId, store)}
      >
        <IconPlus size={16} /> Add it
      </button>
    </Sheet>
  );
}
