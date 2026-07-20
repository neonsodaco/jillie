import { useState } from 'react';
import { db, deleteShopItem, restoreShopItem, rememberStore, STORE_TYPES, type ShopItem, type StoreType } from '../db';
import { Sheet, SheetItem, FieldLabel } from './ui';
import { IconTrash } from './icons';
import { useUndo } from '../lib/undo';

/** Edit an unbought shopping item — fix the name or where it comes from, or take it off the list. */
export function ShopItemEditSheet({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const undo = useUndo();
  const [name, setName] = useState(item.name);
  const [store, setStore] = useState<StoreType>(item.store);

  async function saveItem() {
    if (!name.trim()) return;
    await db.shopItems.update(item.id, { name: name.trim(), store });
    rememberStore(store);
    onClose();
  }

  function deleteItem() {
    onClose();
    // linked packing things let go of the item; undo re-ties them
    void deleteShopItem(item).then((linkedNeedIds) => {
      undo.run({
        message: `${item.name} taken off the shopping list.`,
        revert: () => restoreShopItem(item, linkedNeedIds),
        commit: () => undefined
      });
    });
  }

  return (
    <Sheet onClose={onClose} label="Edit shopping item">
      <h2>Fix this item</h2>
      <div className="field">
        <FieldLabel text="What is it?" help="Change the wording any time — right up until you've bought it." />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveItem()} />
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
      <SheetItem icon={<IconTrash />} label="Delete — take it off the list" danger onClick={deleteItem} />
    </Sheet>
  );
}
