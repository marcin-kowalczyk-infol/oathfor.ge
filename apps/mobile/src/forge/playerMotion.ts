import type { CharacterBuild } from '../api/characters';
import { hero, type FigureSheets } from './motion';

// Player motion sheets, exported by graphics/mvp-20/export-player-v01.py (docs/art/forge-scene-assets.md).
// Only the pilot starter_02 thin exists. The other figures follow after the owner accepts the pilot on device.
const pilot: FigureSheets = {
  walk: {
    back: hero(require('../../assets/player/motion/player-02-thin-walk-back-v01.png'), 4),
    'back-left': hero(require('../../assets/player/motion/player-02-thin-walk-back-left-v01.png'), 4),
    'back-right': hero(require('../../assets/player/motion/player-02-thin-walk-back-right-v01.png'), 4),
    front: hero(require('../../assets/player/motion/player-02-thin-walk-front-v01.png'), 4),
    'front-left': hero(require('../../assets/player/motion/player-02-thin-walk-front-left-v01.png'), 4),
    'front-right': hero(require('../../assets/player/motion/player-02-thin-walk-front-right-v01.png'), 4),
    left: hero(require('../../assets/player/motion/player-02-thin-walk-left-v01.png'), 4),
    right: hero(require('../../assets/player/motion/player-02-thin-walk-right-v01.png'), 4),
  },
  idle: hero(require('../../assets/player/motion/player-02-thin-idle-v01.png'), 4),
  act: {
    hearth: hero(require('../../assets/player/motion/player-02-thin-act-hearth-v01.png'), 2),
    seals: hero(require('../../assets/player/motion/player-02-thin-act-seals-v01.png'), 2),
    chronicle: hero(require('../../assets/player/motion/player-02-thin-act-chronicle-v01.png'), 2),
    door: hero(require('../../assets/player/motion/player-02-thin-act-door-v01.png'), 2),
  },
};

/** The player's sprite sheets for a preset and build, or null while only the still menu figure exists. */
export function playerSheets(presetId: string, build: CharacterBuild): FigureSheets | null {
  return presetId === 'starter_02' && build === 'thin' ? pilot : null;
}
