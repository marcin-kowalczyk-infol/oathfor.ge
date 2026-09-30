// Żaromir's appearances. The picture of each, in every art style, is in src/art.
export const appearances = {
  'zharomir-wanderer-v01': { copyKey: 'wanderer', next: 'zharomir-ember-sash-v01' },
  'zharomir-ember-sash-v01': { copyKey: 'emberSash', next: 'zharomir-guardian-token-v01' },
  'zharomir-guardian-token-v01': { copyKey: 'guardianToken', next: 'zharomir-oath-fittings-v01' },
  'zharomir-oath-fittings-v01': { copyKey: 'oathFittings', next: 'zharomir-spark-mantle-v01' },
  'zharomir-spark-mantle-v01': { copyKey: 'sparkMantle', next: null },
} as const;

export type AppearanceId = keyof typeof appearances;
// Local presentation input, not an unvalidated server payload or an entitlement grant.
export type CompanionPresentation = {
  [Id in AppearanceId]: { current: Id; next: typeof appearances[Id]['next'] }
}[AppearanceId];
