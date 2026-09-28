import type { Sheet } from '../forge/motion';

// Exports from graphics/mvp-21/export-oath-screens-v01.py, listed in docs/art/oath-screens-assets.md.
const sheet = (source: number, cols: number, rows: number): Sheet => ({ source, cols, rows, aspect: 1, anchor: { x: 0.5, y: 0.5 }, blend: 'normal' });
export const oathArt = {
  hourglass: sheet(require('../../assets/oaths/hourglass-v01.png'), 4, 2),
  hourglassStill: require('../../assets/oaths/hourglass-still-v01.png') as number,
  ruleIcons: sheet(require('../../assets/oaths/rule-icons-v01.png'), 5, 2),
  sealStamp: sheet(require('../../assets/oaths/seal-stamp-v01.png'), 4, 2),
  sealSparks: sheet(require('../../assets/oaths/seal-sparks-v01.png'), 4, 2),
};
/** Cell index of each icon in rule-icons-v01. reward and consequence are DUMMY icons until new art exists. */
export const ruleIcon = { start: 0, deadline: 1, cutoff: 2, proof: 3, review: 4, fixed: 5, pause: 6, fullRules: 7, reward: 8, consequence: 9 } as const;
export type RuleIconId = keyof typeof ruleIcon;
