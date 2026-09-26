import { Image, View } from 'react-native';
import type { Oath } from '../api/oathSchema';

const order: Oath['state'][] = ['scheduled', 'active', 'proof_pending', 'needs_more_evidence', 'review_pending', 'fulfilled', 'missed', 'unresolved', 'withdrawn'];

/** Shape-coded state emblem. Adjacent text and accessibility labels carry the meaning. */
export function StateSeal({ state, size = 40 }: { state: Oath['state']; size?: number }) {
  const index = order.indexOf(state);
  return <View testID={`state-seal-${state}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, overflow: 'hidden' }}>
    <Image source={require('../../assets/forge/oath-state-seals-v01.png')} resizeMode="stretch" style={{ position: 'absolute', width: size * 3, height: size * 3, left: -(index % 3) * size, top: -Math.floor(index / 3) * size }} />
  </View>;
}
