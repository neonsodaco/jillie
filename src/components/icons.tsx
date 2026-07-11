interface P {
  size?: number;
}
const S = (p: P) => ({
  width: p.size, height: p.size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
});

export const IconHome = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </svg>
);
export const IconList = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M7.5 9.5h6M7.5 14.5h9" />
  </svg>
);
export const IconTick = (p: P = {}) => (
  <svg {...S(p)} strokeWidth={3} aria-hidden>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
);
export const IconPlus = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconBack = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M15 5 8 12l7 7" />
  </svg>
);
export const IconDots = (p: P = {}) => (
  <svg {...S(p)} fill="currentColor" stroke="none" aria-hidden>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);
export const IconGrip = (p: P = {}) => (
  <svg {...S(p)} fill="currentColor" stroke="none" aria-hidden>
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
);
export const IconCamera = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
export const IconArchive = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M9.5 13h5" />
  </svg>
);
export const IconTrash = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M4 7h16M9.5 4.5h5M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </svg>
);
export const IconHelp = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.2a2.7 2.7 0 1 1 3.7 3.4c-.7.4-1.1.9-1.1 1.7" />
    <circle cx="12" cy="17.4" r="0.4" fill="currentColor" />
  </svg>
);
export const IconShare = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M12 15V4M8.5 7 12 3.5 15.5 7" />
    <path d="M6 11v8a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19v-8" />
  </svg>
);
export const IconRestore = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M4 9a8 8 0 1 1-1 6" />
    <path d="M4 4v5h5" />
  </svg>
);
export const IconFlag = (p: P = {}) => (
  <svg {...S(p)} fill="currentColor" stroke="none" aria-hidden>
    <path d="M6 3.5a1 1 0 0 0-1 1V21a1 1 0 1 0 2 0v-6.2c3.5-1.6 6.5 1.9 11 0V4.3c-4.5 1.9-7.5-1.6-11 0Z" />
  </svg>
);
export const IconPencil = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="m14.5 5.5 4 4L8 20l-4.7 1L4 16.3 14.5 5.5Z" />
  </svg>
);
export const IconCart = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M3 4h2.2l2.4 11.2a1.5 1.5 0 0 0 1.47 1.3h8.06a1.5 1.5 0 0 0 1.46-1.14L20.5 8H6" />
    <circle cx="10" cy="20" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
export const IconCompass = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </svg>
);
export const IconHeart = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M12 20.5C7 16.5 3.5 13.2 3.5 9.6A4.4 4.4 0 0 1 8 5.2c1.6 0 3.1.8 4 2.1a4.9 4.9 0 0 1 4-2.1 4.4 4.4 0 0 1 4.5 4.4c0 3.6-3.5 6.9-8.5 10.9Z" />
  </svg>
);
export const IconClose = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconPalette = (p: P = {}) => (
  <svg {...S(p)} aria-hidden>
    <path d="M12 3a9 9 0 1 0 .6 17.98c1.6-.1 1.9-1.6 1.2-2.6-.8-1.2 0-2.9 1.6-2.9H18a3 3 0 0 0 3-3A9.5 9.5 0 0 0 12 3Z" />
    <circle cx="8" cy="10" r="1" fill="currentColor" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /><circle cx="16" cy="10" r="1" fill="currentColor" />
  </svg>
);
