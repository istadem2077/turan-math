const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const CalculatorIcon = () => (
  <svg {...base}>
    <rect x="5" y="2.5" width="14" height="19" rx="2" />
    <rect x="8" y="5.5" width="8" height="4" rx="0.5" />
    <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" strokeWidth="2.6" />
  </svg>
);
export const ReferenceIcon = () => (
  <svg {...base}>
    <path d="M4 20 20 4M6 4h4M8 2v4M14 18h4M5 15l4 4" />
  </svg>
);
export const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg {...base} width={18} height={18} fill={filled ? "currentColor" : "none"}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
);
export const FlagIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#c13145">
    <path d="M5 2h2v20H5zM8 3h12l-3 5 3 5H8z" />
  </svg>
);
export const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#1e1e1e">
    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
  </svg>
);
export const ChevronDown = () => (
  <svg {...base} width={16} height={16}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ChevronUp = () => (
  <svg {...base} width={16} height={16}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const ExpandIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
