import { SpriteLoop } from '../forge/Sprite';
import { effectSheets } from '../forge/motion';
import { useMotionAllowed } from './useMotion';

const sheet = effectSheets.hearthLoop;

/** Decorative looping flame, eight crossfaded frames. Base centre sits on the anchor, size is the sprite width. Reduced motion shows one still frame. */
export function HearthFire({ anchor, size, opacity = 0.9 }: { anchor: { left: number; top: number }; size: number; opacity?: number }) {
  const motion = useMotionAllowed();
  const height = size / sheet.aspect;
  return <SpriteLoop sheet={sheet} width={size} duration={1400} allowed={motion}
    style={{ left: anchor.left - size * sheet.anchor.x, top: anchor.top - height * sheet.anchor.y, opacity }} />;
}
