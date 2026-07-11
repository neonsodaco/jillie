import { useState } from 'react';
import { STORE_TYPES, type StoreType } from '../db';
import { Sheet } from './ui';

/**
 * Store chooser with a proper way out: opens as a sheet, alphabetical list,
 * tap outside or the Close button to collapse without choosing anything.
 */
export function StorePicker({
  value,
  onChange,
  ariaLabel = 'Where to buy it'
}: {
  value: StoreType;
  onChange: (s: StoreType) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="picker-btn" aria-label={ariaLabel} onClick={() => setOpen(true)}>
        <span>{value}</span>
        <span className="chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label="Choose a store">
          <h2>Where from?</h2>
          {STORE_TYPES.map((s) => (
            <button
              key={s}
              className="sheet-item"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
              {s === value ? ' ✓' : ''}
            </button>
          ))}
          <button className="btn btn-tint btn-block" style={{ marginTop: '0.5rem' }} onClick={() => setOpen(false)}>
            Close
          </button>
        </Sheet>
      )}
    </>
  );
}
