export const appearances = {
  'zharomir-wanderer-v01': { copyKey: 'wanderer', image: require('../../assets/companion/zharomir-wanderer-v01.png'), next: 'zharomir-ember-sash-v01' },
  'zharomir-ember-sash-v01': { copyKey: 'emberSash', image: require('../../assets/companion/zharomir-ember-sash-v01.png'), next: 'zharomir-guardian-token-v01' },
  'zharomir-guardian-token-v01': { copyKey: 'guardianToken', image: require('../../assets/companion/zharomir-guardian-token-v01.png'), next: 'zharomir-oath-fittings-v01' },
  'zharomir-oath-fittings-v01': { copyKey: 'oathFittings', image: require('../../assets/companion/zharomir-oath-fittings-v01.png'), next: 'zharomir-spark-mantle-v01' },
  'zharomir-spark-mantle-v01': { copyKey: 'sparkMantle', image: require('../../assets/companion/zharomir-spark-mantle-v01.png'), next: null },
} as const;

export type AppearanceId = keyof typeof appearances;
// Local presentation input, not an unvalidated server payload or an entitlement grant.
export type CompanionPresentation = {
  [Id in AppearanceId]: { current: Id; next: typeof appearances[Id]['next'] }
}[AppearanceId];
