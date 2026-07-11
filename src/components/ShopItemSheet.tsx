import { useState } from 'react';
import { db, STORE_TYPES, type ShopItem, type StoreType } from '../db';
import { Sheet, FieldLabel } from './ui';

/** Edit an unbought shopping item — fix the name or where it comes from. */
export function ShopItemEditSheet({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [store, setStore] = useState<StoreType>(item.store);

  async function saveItem() {
    if (!name.trim()) return;
    await db.shopItems.update(item.id, { name: name.trim(), store });
    localStorage.setItem('shop.lastStore', store);
    onClose();
  }

  return (
    <Sheet onClose={onClose} label="Edit shopping item">
      <h2>Fix this item</h2>
      <div className="field">
        <FieldLabel text="What is it?" help="Change the wording any time — right up until you've bought it." />
        <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveItem()} />
      </div>
      <div className="field">
        <FieldLabel text="Where from?" help="The kind of shop it comes from." />
        <select value={store} onChange={(e) => setStore(e.target.value as StoreType)}>
          {STORE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={saveItem}>
        Save
      </button>
    </Sheet>
  );
}
