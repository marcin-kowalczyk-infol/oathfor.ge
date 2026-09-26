import { Platform } from 'react-native';

export const tokens = {
  font: { display: Platform.OS === 'ios' ? 'Georgia' : 'serif', body: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  color: { canvas: '#141719', surface: '#242a2d', text: '#ede7db', secondary: '#b8b2a7', primary: '#dfac63', neutral: '#a7becb', positive: '#a9c7a0', missed: '#d9a390' },
  space: { small: 8, item: 12, card: 16, section: 24 },
  body: 17,
  title: 28,
  radius: 16,
  controlHeight: 48,
  // Display text caps so the longest words (Obrończyni, NIEWYBRANY, a 20-letter name) never break mid-word at 375pt. Full-width body copy stays uncapped.
  // inset: text inside buttons, bubbles and cards, about 270 to 310pt wide on a 375pt screen. The native MVP-18 check broke
  // potwierdzeniem, Potwierdź and Zapamiętamy mid-word there at the largest size. At 2.5 they fit.
  maxScale: { display: 2, choice: 2.5, name: 1.5, inset: 2.5 },
} as const;
