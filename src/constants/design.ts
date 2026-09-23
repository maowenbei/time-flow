import { colors } from './colors';

// Shared, deliberately small visual scale. Keep screen-specific layout out of here.
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, page: 22 } as const;

export const radius = { control: 12, card: 20, sheet: 28, pill: 999 } as const;

export const border = {
  subtle: colors.border,
  soft: '#E8EFEC',
  input: '#DDE9E5',
} as const;

export const typography = {
  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, color: colors.primaryDark },
  sectionTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const, color: colors.text },
  cardTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, color: colors.text },
  secondary: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const, color: colors.textMuted },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '400' as const, color: '#728780' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, color: '#526C65' },
  button: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  timer: { fontSize: 43, lineHeight: 52, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as Array<'tabular-nums'> },
  timerCompact: { fontSize: 25, lineHeight: 31, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as Array<'tabular-nums'> },
  tab: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
} as const;
