import { Platform } from 'react-native';

export const tokens = {
  font: { display: Platform.OS === 'ios' ? 'Georgia' : 'serif', body: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  // surface: the neutral fill of fields, idle choices and disabled buttons. Warm since MVP-22-B2 (G17), it was slate #242a2d.
  color: { canvas: '#141719', surface: '#262019', text: '#ede7db', secondary: '#b8b2a7', primary: '#dfac63', neutral: '#a7becb', positive: '#a9c7a0', missed: '#d9a390' },
  // The warm bronze of Settings and character creation (MVP-22-B1). line and faint draw borders, panel fills a card, well an
  // input or a choice, chosen a selected choice, raised an idle control such as a switch track that is off.
  // edge: the dark under-edge of a raised surface such as a field or a button (MVP-22-B2).
  warm: { line: 'rgba(214,170,105,0.55)', faint: 'rgba(214,170,105,0.22)', field: 'rgba(214,170,105,0.35)', bright: '#f0c987', role: '#caa06a', name: '#f6e6c8',
    panel: '#1f1812', well: '#1b1714', chosen: '#2e2318', raised: '#3c3023', edge: '#18110a' },
  space: { small: 8, item: 12, card: 16, section: 24 },
  body: 17,
  title: 28,
  radius: 16,
  controlHeight: 48,
  // Display text caps so the longest words (Obrończyni, NIEWYBRANY, a 20-letter name) never break mid-word at 375pt. Full-width body copy stays uncapped unless a word measures wider than its column at the largest size (native check, 2026-09-30).
  // inset: text inside buttons, bubbles and cards, about 270 to 310pt wide on a 375pt screen. The native MVP-18 check broke
  // potwierdzeniem, Potwierdź and Zapamiętamy mid-word there at the largest size. At 2.5 they fit.
  maxScale: { display: 2, choice: 2.5, name: 1.5, inset: 2.5 },
} as const;
