import { useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { COLOURS, type ColourKey } from '../db';
import { customColourVars } from '../lib/colour';
import { IconHome, IconList, IconCart, IconCompass } from './icons';

export const colourClass = (c: ColourKey) => `c-${c}`;

/** Inline colour variables when the project wears a custom colour; pairs with colourClass. */
export const colourStyle = (p: { customColour?: string | null }): CSSProperties | undefined =>
  p.customColour ? customColourVars(p.customColour) : undefined;

/* ---------- progress bar: always thick, always in words ---------- */
export function ProgressBar({ done, total, finishedGlow = false }: { done: number; total: number; finishedGlow?: boolean }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${done} of ${total} things done`}
    >
      <div
        className={`progress-fill${finishedGlow && total > 0 && done === total ? ' finished' : ''}`}
        data-zero={done === 0}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function progressWords(done: number, total: number): string {
  if (total === 0) return 'No tasks yet';
  if (done === total) return `All ${total} done`;
  return `${done} of ${total} things done`;
}

/* ---------- the "?" helper on every field ---------- */
export function FieldLabel({ text, help }: { text: string; help: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="field-label">
        {text}
        <button
          type="button"
          className="helpdot"
          aria-label={`What does ${text} mean?`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          ?
        </button>
      </div>
      {open && (
        <div className="help-pop" onClick={() => setOpen(false)}>
          {help}
        </div>
      )}
    </>
  );
}

/* ---------- bottom sheet ---------- */
export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label?: string }) {
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

export function SheetItem({
  icon,
  label,
  danger = false,
  onClick
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`sheet-item${danger ? ' danger' : ''}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

/* ---------- confirm (used for every delete) ---------- */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet onClose={onCancel} label={title}>
      <div className="confirm-box">
        <div className="confirm-title">{title}</div>
        <p>{body}</p>
        <div className="confirm-actions">
          <button className="btn btn-tint" onClick={onCancel}>
            Keep it
          </button>
          <button className="btn btn-danger-solid" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- colour swatches ---------- */
export function ColourPicker({
  value,
  custom = null,
  onChange
}: {
  value: ColourKey;
  custom?: string | null;
  onChange: (c: ColourKey, custom: string | null) => void;
}) {
  return (
    <div className="swatch-grid" role="radiogroup" aria-label="Project colour">
      {COLOURS.map((c) => (
        <button
          key={c.key}
          type="button"
          role="radio"
          aria-checked={!custom && value === c.key}
          aria-label={c.label}
          className={`swatch ${colourClass(c.key)}${!custom && value === c.key ? ' sel' : ''}`}
          onClick={() => onChange(c.key, null)}
        />
      ))}
      {/* the 13th swatch: her own colour — a label so one tap opens the phone's picker */}
      <label
        className={`swatch swatch-custom${custom ? ' sel' : ''}`}
        style={custom ? { ...customColourVars(custom), background: 'var(--c)' } : undefined}
      >
        <input
          type="color"
          value={custom ?? '#7ed9a0'}
          aria-label="Pick your own colour"
          onChange={(e) => onChange(value, e.target.value)}
        />
      </label>
    </div>
  );
}

/* ---------- bottom navigation ---------- */
export function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Main">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        <IconHome />
        Today
      </NavLink>
      <NavLink to="/projects" className={({ isActive }) => (isActive ? 'active' : '')}>
        <IconList />
        Projects
      </NavLink>
      <NavLink to="/shopping" className={({ isActive }) => (isActive ? 'active' : '')}>
        <IconCart />
        Shopping
      </NavLink>
      <NavLink to="/guide" className={({ isActive }) => (isActive ? 'active' : '')}>
        <IconCompass />
        Guide Me
      </NavLink>
    </nav>
  );
}
