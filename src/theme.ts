export const colors = {
  bg: '#0F1115',
  surface: '#181B21',
  surfaceAlt: '#20242C',
  line: '#2A2F39',
  text: '#F2F4F7',
  textDim: '#9AA3B2',
  accent: '#4C8DFF',
  accentSoft: '#1D2A44',
  warn: '#E5A33B',
  adSlot: '#101318',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 8, md: 14, lg: 20 };

export const type = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.4 },
  section: { fontSize: 13, fontWeight: '600' as const, color: colors.textDim, letterSpacing: 1.1 },
  tile: { fontSize: 15, fontWeight: '600' as const, color: colors.text },
  hint: { fontSize: 12, color: colors.textDim, lineHeight: 16 },
  body: { fontSize: 15, color: colors.text },
};

// Reserved height for the anchored adaptive banner. Never let content
// scroll under it — the page grid and annotation canvas both need the
// bottom edge to stay tappable.
export const AD_SLOT_HEIGHT = 62;
