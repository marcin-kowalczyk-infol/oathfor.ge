import { hero, sheet, type FigureSheets, type Sheet } from '../forge/motion';
import type { ArtOverrides, CompanionFrames } from './registry';

// The cinematic restyle (docs/art/cinematic-assets.md). Only the files listed here are cinematic, every other file stays current.
// Candidates come from graphics/cinematic-restyle-2026-09-29. Owner acceptance is pending for each of them.

/**
 * The cinematic companion canvas is 1024 × 1536 and transparent. The figure is larger in it: about x 185 to 852 and y 22 to 1498.
 * The panel and the tile keep the v01 figure height on screen. The head is larger in proportion, so the avatar
 * scales to the head: source x 413.5 to 738.5 and y -10 to 315.
 */
const companionFrames: CompanionFrames = {
  // The v01 avatar showed its #222 backdrop around the head. The transparent picture needs the same colour behind it.
  bubble: { width: 138.63, height: 207.95, left: -55.98, top: 1.35, backdrop: '#222222' },
  tile: { width: 129.6, height: 194.4, top: -2.4, left: 20.1, right: 26.3 },
  panel: { width: 166.96, height: 250.44, left: 2.6, top: 4.67 },
};

const oathSheet = (source: number, cols: number, rows: number): Sheet => ({ source, cols, rows, aspect: 1, anchor: { x: 0.5, y: 0.5 }, blend: 'normal' });

// Player pilot sheets (starter_02 thin), remaining-v01: soles at y 312 in all 88 cells.
const pilot: FigureSheets = {
  walk: {
    back: hero(require('../../assets/player/motion/player-02-thin-walk-back-cinematic-v01.png'), 4),
    'back-left': hero(require('../../assets/player/motion/player-02-thin-walk-back-left-cinematic-v01.png'), 4),
    'back-right': hero(require('../../assets/player/motion/player-02-thin-walk-back-right-cinematic-v01.png'), 4),
    front: hero(require('../../assets/player/motion/player-02-thin-walk-front-cinematic-v01.png'), 4),
    'front-left': hero(require('../../assets/player/motion/player-02-thin-walk-front-left-cinematic-v01.png'), 4),
    'front-right': hero(require('../../assets/player/motion/player-02-thin-walk-front-right-cinematic-v01.png'), 4),
    left: hero(require('../../assets/player/motion/player-02-thin-walk-left-cinematic-v01.png'), 4),
    right: hero(require('../../assets/player/motion/player-02-thin-walk-right-cinematic-v01.png'), 4),
  },
  idle: hero(require('../../assets/player/motion/player-02-thin-idle-cinematic-v01.png'), 4),
  act: {
    hearth: hero(require('../../assets/player/motion/player-02-thin-act-hearth-cinematic-v01.png'), 2),
    seals: hero(require('../../assets/player/motion/player-02-thin-act-seals-cinematic-v01.png'), 2),
    chronicle: hero(require('../../assets/player/motion/player-02-thin-act-chronicle-cinematic-v01.png'), 2),
    door: hero(require('../../assets/player/motion/player-02-thin-act-door-cinematic-v01.png'), 2),
  },
};

export const cinematicArt: ArtOverrides = {
  room: {
    // C4 with the less polished floor (room-cinematic-v02). Every 96 pixel tile sits within 1 pixel of C4,
    // and C4 keeps the v03 composition: a 50/50 blend shows no double outlines.
    image: require('../../assets/forge/room-cinematic-v02.png'),
    // Measured on C4 and v02 (graphics/cinematic-restyle-2026-09-29/measure-candles.py). The chandelier holds wax candles,
    // so its flames start at the top of the wax, 9 to 21 pixels above the v03 flames. The other flames match v03.
    candles: [
      { x: 0.411, y: 0.131, core: 0.004 }, { x: 0.443, y: 0.128, core: 0.005 }, { x: 0.513, y: 0.121, core: 0.006 }, { x: 0.581, y: 0.129, core: 0.005 },
      { x: 0.605, y: 0.133, core: 0.006 }, { x: 0.494, y: 0.150, core: 0.004 }, { x: 0.559, y: 0.149, core: 0.004 },
      { x: 0.183, y: 0.191, core: 0.016 }, { x: 0.814, y: 0.194, core: 0.01 }, { x: 0.053, y: 0.244, core: 0.014 }, { x: 0.944, y: 0.245, core: 0.01 },
      { x: 0.223, y: 0.404, core: 0.01 }, { x: 0.316, y: 0.43, core: 0.012 }, { x: 0.709, y: 0.43, core: 0.015 },
      { x: 0.906, y: 0.475, core: 0.015 }, { x: 0.057, y: 0.542, core: 0.015 }, { x: 0.362, y: 0.53, core: 0.01 }, { x: 0.947, y: 0.545, core: 0.016 },
      { x: 0.015, y: 0.798, core: 0.032 }, { x: 0.983, y: 0.798, core: 0.033 },
    ],
    // Cut from v02 itself (cut-room-cinematic-v02.py). The v03 masks do not fit its larger drums and other door arch.
    sealsFront: { source: require('../../assets/forge/motion/room-seals-front-cinematic-v01.png'), box: [63, 858, 252, 106] },
    doorLeaf: { source: require('../../assets/forge/scene/room-door-leaf-cinematic-v01.png'), box: [33, 477, 93, 393], hinge: 35.5 },
    // The turning drums are the face disks only (v02). The barrel sides and knobs stay painted, the seals front holds whole drums.
    seals: {
      star: { source: require('../../assets/forge/scene/room-seal-star-cinematic-v02.png'), box: [69, 877, 84, 84], centre: [111.2, 919.2] },
      tree: { source: require('../../assets/forge/scene/room-seal-tree-cinematic-v02.png'), box: [157, 874, 80, 79], centre: [197.2, 913.5] },
      wolf: { source: require('../../assets/forge/scene/room-seal-wolf-cinematic-v02.png'), box: [239, 870, 76, 76], centre: [277.0, 908.0] },
    },
    // Revision 03: built on the v02 book pixels. Its cell covers x 644, y 819, 179 pixels wide, so the first and last frames equal the room.
    bookPageTurn: { sheet: sheet(require('../../assets/forge/scene/fx-book-page-turn-cinematic-v03.png'), 4, 2, [312, 227], [0.5064, 0.978], 'normal'),
      x: 644 + 179 * 0.5064, y: 819 + 179 * 227 / 312 * 0.978, width: 179 / 887 },
  },
  companion: {
    'zharomir-wanderer-v01': { image: require('../../assets/companion/zharomir-wanderer-cinematic-v01.png'), frames: companionFrames },
    'zharomir-ember-sash-v01': { image: require('../../assets/companion/zharomir-ember-sash-cinematic-v01.png'), frames: companionFrames },
    'zharomir-guardian-token-v01': { image: require('../../assets/companion/zharomir-guardian-token-cinematic-v01.png'), frames: companionFrames },
    'zharomir-oath-fittings-v01': { image: require('../../assets/companion/zharomir-oath-fittings-cinematic-v01.png'), frames: companionFrames },
    'zharomir-spark-mantle-v01': { image: require('../../assets/companion/zharomir-spark-mantle-cinematic-v01.png'), frames: companionFrames },
  },
  // Revision 03 (2026-09-30): one silhouette assembled into every sheet, same cells as v01. The sheets change together.
  zharomir: {
    walk: {
      back: hero(require('../../assets/forge/motion/zharomir-walk-back-cinematic-v02.png'), 4),
      'back-left': hero(require('../../assets/forge/motion/zharomir-walk-back-left-cinematic-v02.png'), 4),
      'back-right': hero(require('../../assets/forge/motion/zharomir-walk-back-right-cinematic-v02.png'), 4),
      front: hero(require('../../assets/forge/motion/zharomir-walk-front-cinematic-v02.png'), 4),
      'front-left': hero(require('../../assets/forge/motion/zharomir-walk-front-left-cinematic-v02.png'), 4),
      'front-right': hero(require('../../assets/forge/motion/zharomir-walk-front-right-cinematic-v02.png'), 4),
      left: hero(require('../../assets/forge/motion/zharomir-walk-left-cinematic-v02.png'), 4),
      right: hero(require('../../assets/forge/motion/zharomir-walk-right-cinematic-v02.png'), 4),
    },
    idle: hero(require('../../assets/forge/motion/zharomir-idle-cinematic-v02.png'), 4),
    talk: hero(require('../../assets/forge/motion/zharomir-talk-cinematic-v02.png'), 2),
    turn: hero(require('../../assets/forge/motion/zharomir-turn-cinematic-v02.png'), 2),
    act: {
      hearth: hero(require('../../assets/forge/motion/zharomir-act-hearth-cinematic-v02.png'), 2),
      seals: hero(require('../../assets/forge/motion/zharomir-act-seals-cinematic-v02.png'), 2),
      chronicle: hero(require('../../assets/forge/motion/zharomir-act-chronicle-cinematic-v02.png'), 2),
      door: hero(require('../../assets/forge/motion/zharomir-act-door-cinematic-v02.png'), 2),
    },
  },
  // Revision 03 bust, reframed to the v01 head size (crop-bust-cinematic-v01.py).
  zharomirBust: require('../../assets/forge/scene/zharomir-bust-cinematic-v01.png'),
  // Remaining batch (incoming/remaining-v01, 2026-09-30). Every sheet keeps its v01 cell layout.
  presets: {
    starter_01: {
      thin: { figure: require('../../assets/player/starter-01-thin-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-01-thin-portrait-cinematic-v01.png') },
      heavy: { figure: require('../../assets/player/starter-01-heavy-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-01-heavy-portrait-cinematic-v01.png') },
    },
    starter_02: {
      thin: { figure: require('../../assets/player/starter-02-thin-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-02-thin-portrait-cinematic-v01.png') },
      heavy: { figure: require('../../assets/player/starter-02-heavy-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-02-heavy-portrait-cinematic-v01.png') },
    },
    starter_03: {
      thin: { figure: require('../../assets/player/starter-03-thin-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-03-thin-portrait-cinematic-v01.png') },
      heavy: { figure: require('../../assets/player/starter-03-heavy-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-03-heavy-portrait-cinematic-v01.png') },
    },
    starter_04: {
      thin: { figure: require('../../assets/player/starter-04-thin-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-04-thin-portrait-cinematic-v01.png') },
      heavy: { figure: require('../../assets/player/starter-04-heavy-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-04-heavy-portrait-cinematic-v01.png') },
    },
    starter_05: {
      thin: { figure: require('../../assets/player/starter-05-thin-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-05-thin-portrait-cinematic-v01.png') },
      heavy: { figure: require('../../assets/player/starter-05-heavy-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-05-heavy-portrait-cinematic-v01.png') },
    },
    starter_06: {
      thin: { figure: require('../../assets/player/starter-06-thin-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-06-thin-portrait-cinematic-v01.png') },
      heavy: { figure: require('../../assets/player/starter-06-heavy-figure-cinematic-v01.png'), portrait: require('../../assets/player/starter-06-heavy-portrait-cinematic-v01.png') },
    },
  },
  playerMotion: { 'starter_02.thin': pilot },
  stations: {
    hearth: require('../../assets/forge/station-hearth-cinematic-v01.jpg'),
    seals: require('../../assets/forge/station-seals-cinematic-v01.jpg'),
    chronicle: require('../../assets/forge/station-chronicle-cinematic-v01.jpg'),
  },
  // Measured on the cinematic hearth: the fire bed is centred at x 0.526 at the v01 height, and the opening is 0.22 of the width.
  stationFire: { x: 0.526, y: 0.345, width: 0.16 },
  haze: require('../../assets/forge/ember-haze-cinematic-v01.png'),
  activityObjects: require('../../assets/forge/activity-objects-cinematic-v01.png'),
  stateSeals: require('../../assets/forge/oath-state-seals-cinematic-v01.png'),
  // The same box of the hearth close-up as settings-tools-v01 (crop-settings-tools-cinematic-v01.py).
  menuTools: require('../../assets/menu/settings-tools-cinematic-v01.jpg'),
  // Frame tiles v02 keep the v01 row profile: margin, oak band, bronze line at 44 to 49, inner shadow to 74 (panel-frame-v02).
  panel: {
    corner: require('../../assets/forge/scene/panel-corner-cinematic-v02.png'),
    edgeH: require('../../assets/forge/scene/panel-edge-h-cinematic-v02.png'),
    edgeV: require('../../assets/forge/scene/panel-edge-v-cinematic-v02.png'),
    fill: require('../../assets/forge/scene/panel-fill-cinematic-v01.png'),
    plate: require('../../assets/forge/scene/panel-plate-cinematic-v01.png'),
    rune: require('../../assets/forge/scene/panel-rune-alpha-cinematic-v01.png'),
  },
  talk: {
    oaths: require('../../assets/forge/scene/talk-seal-cinematic-v01.png'),
    chronicle: require('../../assets/forge/scene/talk-chronicle-cinematic-v01.png'),
  },
  oaths: {
    hourglass: oathSheet(require('../../assets/oaths/hourglass-cinematic-v01.png'), 4, 2),
    hourglassStill: require('../../assets/oaths/hourglass-still-cinematic-v01.png'),
    ruleIcons: oathSheet(require('../../assets/oaths/rule-icons-cinematic-v01.png'), 5, 2),
    sealStamp: oathSheet(require('../../assets/oaths/seal-stamp-cinematic-v01.png'), 4, 2),
    sealSparks: oathSheet(require('../../assets/oaths/seal-sparks-cinematic-v01.png'), 4, 2),
    stepBadges: oathSheet(require('../../assets/oaths/step-badges-cinematic-v01.png'), 4, 1),
  },
};
