import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, active, makeShopItem, lastStore, rememberStore, setShopItemBought, STORE_TYPES, type StoreType, type ShopItem } from '../db';
import { progress } from '../lib/numbering';
import { Sheet, colourClass, colourStyle, FieldLabel } from '../components/ui';
import { ShopItemEditSheet } from '../components/ShopItemSheet';
import { StorePicker } from '../components/StorePicker';
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
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShopItem | null>(null);

  const activeProjects = active(projects).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  const projectsById = useMemo(() => new Map(activeProjects.map((p) => [p.id, p])), [activeProjects]);

  // items can only be added for projects that still have something to do
  const openProjects = useMemo(
    () =>
      activeProjects.filter((p) => {
        const { done, total } = progress(active(tasks).filter((t) => t.projectId === p.id));
        return total === 0 || done < total;
      }),
    [activeProjects, tasks]
  );

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
  // bought items stay here until she clears them; clearing tidies them away
  // everywhere (here and on their task) — the record itself is kept
  const gotIt = visible.filter((i) => i.done && i.clearedAt === null);

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

  function toggle(item: ShopItem) {
    // buying a linked packing-list thing packs it too (one-way, in db.ts)
    void setShopItemBought(item, !item.done).catch(() => undo.toast("That didn't save — try again."));
  }

  function clearGot() {
    const ids = gotIt.map((i) => i.id);
    void db.shopItems.where('id').anyOf(ids).modify({ clearedAt: Date.now() });
    undo.run({
      message: `${ids.length} bought item${ids.length === 1 ? '' : 's'} tidied away.`,
      revert: () => db.shopItems.where('id').anyOf(ids).modify({ clearedAt: null }).then(() => undefined),
      commit: () => undefined
    });
  }

  const row = (item: ShopItem) => {
    const p = projectsById.get(item.projectId)!;
    return (
      <div key={item.id} className={`shop-row card ${colourClass(p.colour)}${item.done ? ' got' : ''}`} style={colourStyle(p)}>
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
          <div className="feed-head">Bought</div>
          {gotIt.map(row)}
          <button className="btn btn-ghost btn-block" onClick={clearGot}>
            <IconTrash size={16} /> Clear ticked items
          </button>
        </>
      )}

      <button className="fab-newproject" onClick={() => setAdding(true)} disabled={openProjects.length === 0}>
        + Add to the list
      </button>

      {editing && <ShopItemEditSheet item={editing} onClose={() => setEditing(null)} />}

      {adding && (
        <AddItemSheet
          projects={openProjects.map((p) => ({ id: p.id, name: p.name }))}
          defaultProject={
            projectFilter !== 'all' && openProjects.some((p) => p.id === projectFilter)
              ? projectFilter
              : openProjects[0]?.id
          }
          onClose={() => setAdding(false)}
          onAdd={(name, projectId, store) => {
            // close first, then save — the popup never lingers
            setAdding(false);
            db.shopItems
              .add(makeShopItem({ projectId, taskId: null, name, store }))
              .then(() => rememberStore(store))
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
  projects: { id: string; name: string }[];
  defaultProject?: string;
  onClose: () => void;
  onAdd: (name: string, projectId: string, store: StoreType) => void;
}) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(defaultProject ?? projects[0]?.id ?? '');
  const [store, setStore] = useState<StoreType>(lastStore);
  return (
    <Sheet onClose={onClose} label="Add to the shopping list">
      <h2>Add to the shopping list</h2>
      <div className="field">
        <FieldLabel text="What do you need?" help="Just the item — 'Sandpaper, 120 grit', 'White gloss paint'." />
        <input type="text" value={name} placeholder="e.g. Sandpaper, 120 grit" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <FieldLabel text="Which project is it for?" help="So the list can be sorted per project. Finished projects aren't offered." />
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
        <StorePicker value={store} onChange={setStore} ariaLabel="Where from" />
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
