/**
 * Celebrations — colourful, happy, and over in a couple of seconds.
 * A small burst for every tick; a full shower when a project finishes.
 * Pure DOM + Web Animations API, no dependencies, pointer-events: none.
 */

const COLOURS = [
  '#c4704f', '#8a9b6e', '#6b8cbe', '#d9a441', '#c98a98', '#4f9b94', '#8e6c9e',
  '#f2c94c', '#e86f9e', '#5fbf77', '#7fc8f8'
];

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function layer(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'confetti-layer';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '95'
  });
  document.body.appendChild(el);
  return el;
}

function particle(parent: HTMLElement, x: number, y: number): HTMLDivElement {
  const el = document.createElement('div');
  const size = rand(6, 11);
  const round = Math.random() < 0.35;
  Object.assign(el.style, {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${size}px`,
    height: `${round ? size : size * rand(0.45, 0.75)}px`,
    background: pick(COLOURS),
    borderRadius: round ? '50%' : '2px',
    willChange: 'transform, opacity'
  });
  parent.appendChild(el);
  return el;
}

/** A happy little burst from a point — every tick earns one. */
export function confettiBurst(x: number, y: number, count = 28): void {
  const host = layer();
  let longest = 0;
  for (let i = 0; i < count; i++) {
    const el = particle(host, x, y);
    const angle = rand(-Math.PI, Math.PI);
    const power = rand(50, 150);
    const dx = Math.cos(angle) * power;
    const lift = -Math.abs(Math.sin(angle)) * power - rand(30, 90);
    const fall = rand(160, 340);
    const rot = rand(-720, 720);
    const dur = rand(800, 1500);
    longest = Math.max(longest, dur);
    el.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.7}px, ${lift}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px, ${lift + fall}px) rotate(${rot}deg)`, opacity: 0 }
      ],
      { duration: dur, easing: 'cubic-bezier(0.16, 0.7, 0.45, 1)', fill: 'forwards' }
    );
  }
  window.setTimeout(() => host.remove(), longest + 100);
}

/** The full shower — a finished project deserves the works. */
export function confettiRain(count = 110): void {
  const host = layer();
  const w = window.innerWidth;
  const h = window.innerHeight;
  let longest = 0;
  for (let i = 0; i < count; i++) {
    const el = particle(host, rand(-20, w + 20), rand(-140, -10));
    const sway = rand(-90, 90);
    const rot = rand(-900, 900);
    const dur = rand(1700, 3200);
    const delay = rand(0, 500);
    longest = Math.max(longest, dur + delay);
    el.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${sway}px, ${h * 0.45}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${sway * 0.4}px, ${h + 160}px) rotate(${rot}deg)`, opacity: 0.9 }
      ],
      { duration: dur, delay, easing: 'cubic-bezier(0.3, 0.35, 0.6, 0.9)', fill: 'forwards' }
    );
  }
  window.setTimeout(() => host.remove(), longest + 150);
}

/** Burst from wherever she tapped; falls back to mid-screen. */
export function celebrateTick(e?: { currentTarget: EventTarget | null }, projectFinished = false): void {
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 3;
  const el = e?.currentTarget as HTMLElement | null;
  if (el?.getBoundingClientRect) {
    const r = el.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  confettiBurst(x, y);
  if (projectFinished) window.setTimeout(() => confettiRain(), 250);
}
