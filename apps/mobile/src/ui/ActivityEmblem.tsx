import { Image, View } from 'react-native';
import type { Activity } from '../api/oathSchema';
import { useArt } from '../art/ArtProvider';

/** Three atlas cells. Adjacent text names the activity for accessibility. */
export function ActivityEmblem({ activity, size = 80 }: { activity: Activity; size?: number }) {
  const { activityObjects } = useArt();
  const column = { running: 0, strength_training: 1, mobility: 2 }[activity];
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, overflow: 'hidden' }}>
    <Image source={activityObjects} resizeMode="stretch" style={{ position: 'absolute', width: size * 3, height: size, left: -column * size, top: 0 }} />
  </View>;
}
