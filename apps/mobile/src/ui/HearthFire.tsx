import { SpriteLoop } from '../forge/Sprite';
import { useArt } from '../art/ArtProvider';
import { useMotionAllowed } from './useMotion';

/** Decorative looping flame, eight crossfaded frames. Base centre sits on the anchor, size is the sprite width. Reduced motion shows one still frame. */
export function HearthFire({ anchor, size, opacity = 0.9 }: { anchor: { left: number; top: number }; size: number; opacity?: number }) {
  const motion = useMotionAllowed();
  const sheet = useArt().effects.hearthLoop;
  const height = size / sheet.aspect;
  return <SpriteLoop sheet={sheet} width={size} duration={1400} allowed={motion}
    style={{ left: anchor.left - size * sheet.anchor.x, top: anchor.top - height * sheet.anchor.y, opacity }} />;
}
