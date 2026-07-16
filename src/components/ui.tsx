import { useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { COLOURS, type ColourKey } from '../db';
import { customColourVars, pastelHex, hueOf, MIX_S, MIX_L } from '../lib/colour';
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
// pine gave up its spot to the mix-your-own swatch; the key and CSS stay
// so projects already wearing pine keep rendering
const PICKER_COLOURS = COLOURS.filter((c) => c.key !== 'pine');

export function ColourPicker({
  value,
  custom = null,
  onChange
}: {
  value: ColourKey;
  custom?: string | null;
  onChange: (c: ColourKey, custom: string | null) => void;
}) {
  const [mixing, setMixing] = useState(false);
  const hue = (custom ? hueOf(custom) : null) ?? 150;
  return (
    <>
      <div className="swatch-grid" role="radiogroup" aria-label="Project colour">
        {PICKER_COLOURS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={!custom && value === c.key}
            aria-label={c.label}
            className={`swatch ${colourClass(c.key)}${!custom && value === c.key ? ' sel' : ''}`}
            onClick={() => {
              setMixing(false);
              onChange(c.key, null);
            }}
          />
        ))}
        {/* the 12th swatch: mix your own pastel — opens the slider below */}
        <button
          type="button"
          aria-label="Mix your own pastel colour"
          aria-expanded={mixing}
          className={`swatch swatch-custom${custom ? ' sel' : ''}`}
          style={custom ? { ...customColourVars(custom), background: 'var(--c)' } : undefined}
          onClick={() => {
            if (!custom) onChange(value, pastelHex(hue));
            setMixing((m) => !m);
          }}
        />
      </div>
      {mixing && (
        <div className="pastel-mixer">
          <div className="mixer-label">Slide to mix your own pastel</div>
          <input
            type="range"
            min={0}
            max={359}
            value={hue}
            aria-label="Your pastel colour"
            style={{ '--mix': `hsl(${hue}, ${MIX_S}%, ${MIX_L}%)` } as CSSProperties}
            onChange={(e) => onChange(value, pastelHex(Number(e.target.value)))}
          />
        </div>
      )}
    </>
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
