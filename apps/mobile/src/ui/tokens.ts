import { Platform } from 'react-native';

export const tokens = {
  font: { display: Platform.OS === 'ios' ? 'Georgia' : 'serif', body: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  color: { canvas: '#141719', surface: '#242a2d', text: '#ede7db', secondary: '#b8b2a7', primary: '#dfac63', neutral: '#a7becb', positive: '#a9c7a0', missed: '#d9a390' },
  space: { small: 8, item: 12, card: 16, section: 24 },
  body: 17,
  title: 28,
  radius: 16,
  controlHeight: 48,
} as const;
