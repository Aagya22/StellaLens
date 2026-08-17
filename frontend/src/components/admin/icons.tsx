const base = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

export const IconOverview = () => (
  <svg {...base}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
);

export const IconOrders = () => (
  <svg {...base}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5" /><path d="M12 12v9" /></svg>
);

export const IconCustomers = () => (
  <svg {...base}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M17.5 14.2A6.5 6.5 0 0 1 21.5 20" /></svg>
);

export const IconPieces = () => (
  <svg {...base}><path d="M7 3h10l4 6-9 12L3 9z" /><path d="M3 9h18" /><path d="m12 21 3-12-2-6" /><path d="M12 21 9 9l2-6" /></svg>
);

export const IconShop = () => (
  <svg {...base}><path d="M4 8h16l-1 12H5z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);

export const IconSignOut = () => (
  <svg {...base}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></svg>
);

export const IconGem = () => (
  <svg {...base} width={17} height={17}><path d="M7 3h10l4 6-9 12L3 9z" /><path d="M3 9h18" /><path d="M12 21 8 9l3-6" /></svg>
);

export const IconMenu = () => (
  <svg {...base} width={22} height={22}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);

export const IconBell = () => (
  <svg {...base} width={19} height={19}><path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.5 20a1.9 1.9 0 0 0 3 0" /></svg>
);

export const IconClose = () => (
  <svg {...base} width={20} height={20}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
