import { hero, sheet, type FigureSheets, type Sheet } from '../forge/motion';
import type { ArtSet, CompanionFrames } from './registry';

// The current (v01) art. Metro needs every require spelled out, and every image of the app is required here or in cinematic.ts.
// Sources of each group: docs/art (forge-motion-assets.md, forge-scene-assets.md, oath-screens-assets.md, player-preset-assets.md).

/** Painted flames in room-prototype-v03, measured as the bright core. room-final-v01 keeps the same layout. */
const candles = [
  // Chandelier.
  { x: 0.409, y: 0.138, core: 0.007 }, { x: 0.439, y: 0.134, core: 0.006 }, { x: 0.512, y: 0.129, core: 0.009 }, { x: 0.581, y: 0.135, core: 0.006 },
  { x: 0.606, y: 0.139, core: 0.008 }, { x: 0.493, y: 0.156, core: 0.006 }, { x: 0.559, y: 0.154, core: 0.006 },
  // Hanging lamps.
  { x: 0.183, y: 0.191, core: 0.016 }, { x: 0.814, y: 0.194, core: 0.01 }, { x: 0.053, y: 0.244, core: 0.014 }, { x: 0.944, y: 0.245, core: 0.01 },
  // Wall braziers beside the door and the hearth.
  { x: 0.223, y: 0.404, core: 0.01 }, { x: 0.316, y: 0.43, core: 0.012 }, { x: 0.709, y: 0.43, core: 0.015 },
  // Lectern candle and pedestal bowls.
  { x: 0.906, y: 0.475, core: 0.015 }, { x: 0.057, y: 0.542, core: 0.015 }, { x: 0.362, y: 0.53, core: 0.01 }, { x: 0.947, y: 0.545, core: 0.016 },
  // Foreground braziers at the lower corners.
  { x: 0.015, y: 0.798, core: 0.032 }, { x: 0.983, y: 0.798, core: 0.033 },
];

/** The v01 companion canvas is 1024 × 1536 with a flat #222 backdrop. The figure spans x 190 to 801 and y 47 to 1417. */
const companionFrames: CompanionFrames = {
  // The head fills the avatar: source x 420 to 670 and y 20 to 270.
  bubble: { width: 180.224, height: 270.336, left: -73.92, top: -3.52, backdrop: '#44372c' },
  tile: { width: 140, height: 210, top: -6, left: 18, right: 18 },
  panel: { width: 180, height: 270, left: 0, top: 0 },
};

const zharomir: Required<FigureSheets> = {
  walk: {
    back: hero(require('../../assets/forge/motion/zharomir-walk-back-v02.png'), 4),
    'back-left': hero(require('../../assets/forge/motion/zharomir-walk-back-left-v01.png'), 4),
    'back-right': hero(require('../../assets/forge/motion/zharomir-walk-back-right-v01.png'), 4),
    front: hero(require('../../assets/forge/motion/zharomir-walk-front-v01.png'), 4),
    'front-left': hero(require('../../assets/forge/motion/zharomir-walk-front-left-v01.png'), 4),
    'front-right': hero(require('../../assets/forge/motion/zharomir-walk-front-right-v01.png'), 4),
    left: hero(require('../../assets/forge/motion/zharomir-walk-left-v02.png'), 4),
    right: hero(require('../../assets/forge/motion/zharomir-walk-right-v02.png'), 4),
  },
  idle: hero(require('../../assets/forge/motion/zharomir-idle-v02.png'), 4),
  // Gestures: explain, point left, point right, nod.
  talk: hero(require('../../assets/forge/motion/zharomir-talk-v01.png'), 2),
  // Back view to the player-facing three-quarter view.
  turn: hero(require('../../assets/forge/motion/zharomir-turn-v01.png'), 2),
  // Each pose faces its place: back view at the hearth and the door, back three-quarter at the seals and the chronicle.
  act: {
    hearth: hero(require('../../assets/forge/motion/zharomir-act-hearth-v01.png'), 2),
    seals: hero(require('../../assets/forge/motion/zharomir-act-seals-v01.png'), 2),
    chronicle: hero(require('../../assets/forge/motion/zharomir-act-chronicle-v01.png'), 2),
    door: hero(require('../../assets/forge/motion/zharomir-act-door-v01.png'), 2),
  },
};

// Player motion sheets, exported by graphics/mvp-20/export-player-v01.py.
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

// Oath screen sheets from graphics/mvp-21/export-oath-screens-v01.py: square cells, centred.
const oathSheet = (source: number, cols: number, rows: number): Sheet => ({ source, cols, rows, aspect: 1, anchor: { x: 0.5, y: 0.5 }, blend: 'normal' });

export const currentArt: ArtSet = {
  room: {
    image: require('../../assets/forge/room-prototype-v03.png'),
    candles,
    // Cut layers from room-prototype-v03 (export-scene-v01.py), in artwork pixels.
    sealsFront: { source: require('../../assets/forge/motion/room-seals-front-v01.png'), box: [50, 850, 280, 115] },
    doorLeaf: { source: require('../../assets/forge/scene/room-door-leaf-v01.png'), box: [31, 476, 94, 395], hinge: 34 },
    seals: {
      star: { source: require('../../assets/forge/scene/room-seal-star-v01.png'), box: [62, 867, 89, 95], centre: [110.5, 919] },
      tree: { source: require('../../assets/forge/scene/room-seal-tree-v01.png'), box: [149, 861, 85, 99], centre: [196, 915.5] },
      wolf: { source: require('../../assets/forge/scene/room-seal-wolf-v01.png'), box: [231, 857, 85, 101], centre: [277.5, 912.5] },
    },
    // One leaf turns over the lectern book (export-feedback-v01.py, docs/art/forge-scene-assets.md "Demo feedback exports").
    bookPageTurn: { sheet: sheet(require('../../assets/forge/scene/fx-book-page-turn-v01.png'), 4, 2, [312, 227], [0.5064, 0.978], 'normal'), x: 739, y: 932, width: 0.1759 },
  },
  stations: {
    hearth: require('../../assets/forge/station-hearth-v01.jpg'),
    seals: require('../../assets/forge/station-seals-v01.jpg'),
    chronicle: require('../../assets/forge/station-chronicle-v01.jpg'),
  },
  // The flame's base sits on the painted logs, 0.24 of the width stays inside the arch opening.
  stationFire: { x: 0.5, y: 0.345, width: 0.24 },
  haze: require('../../assets/forge/ember-haze-v01.png'),
  activityObjects: require('../../assets/forge/activity-objects-v01.png'),
  stateSeals: require('../../assets/forge/oath-state-seals-v01.png'),
  menuTools: require('../../assets/menu/settings-tools-v01.jpg'),
  companion: {
    'zharomir-wanderer-v01': { image: require('../../assets/companion/zharomir-wanderer-v01.png'), frames: companionFrames },
    'zharomir-ember-sash-v01': { image: require('../../assets/companion/zharomir-ember-sash-v01.png'), frames: companionFrames },
    'zharomir-guardian-token-v01': { image: require('../../assets/companion/zharomir-guardian-token-v01.png'), frames: companionFrames },
    'zharomir-oath-fittings-v01': { image: require('../../assets/companion/zharomir-oath-fittings-v01.png'), frames: companionFrames },
    'zharomir-spark-mantle-v01': { image: require('../../assets/companion/zharomir-spark-mantle-v01.png'), frames: companionFrames },
  },
  zharomir,
  zharomirBust: require('../../assets/forge/scene/zharomir-bust-v01.png'),
  effects: {
    hearthLoop: sheet(require('../../assets/forge/motion/fx-hearth-loop-v01.png'), 4, 2, [288, 384], [0.5, 0.94], 'screen'),
    hearthBurst: sheet(require('../../assets/forge/motion/fx-hearth-burst-v01.png'), 4, 2, [288, 384], [0.5, 0.94], 'screen'),
    doorMist: sheet(require('../../assets/forge/motion/fx-door-mist-v01.png'), 4, 2, [192, 256], [0.5, 0.94], 'screen'),
    candle: sheet(require('../../assets/forge/motion/fx-candle-loop-v01.png'), 4, 2, [96, 128], [0.5, 0.94], 'screen'),
    wisp: sheet(require('../../assets/forge/motion/fx-attract-wisp-v01.png'), 4, 2, [96, 128], [0.5, 0.55], 'screen'),
    // MVP-20 scene responses (docs/art/forge-scene-assets.md).
    sealStar: sheet(require('../../assets/forge/scene/fx-seal-star-v01.png'), 4, 2, [192, 256], [0.5, 0.4], 'screen'),
    sealTree: sheet(require('../../assets/forge/scene/fx-seal-tree-v01.png'), 4, 2, [192, 256], [0.5, 0.4], 'screen'),
    sealWolf: sheet(require('../../assets/forge/scene/fx-seal-wolf-v01.png'), 4, 2, [192, 256], [0.5, 0.4], 'screen'),
    bookSigns: sheet(require('../../assets/forge/scene/fx-book-signs-v01.png'), 4, 2, [288, 384], [0.5, 0.94], 'screen'),
  },
  // The painted dialogue frame, exported for 3x screens: 1 point is 3 pixels.
  panel: {
    corner: require('../../assets/forge/scene/panel-corner-v01.png'),
    edgeH: require('../../assets/forge/scene/panel-edge-h-v01.png'),
    edgeV: require('../../assets/forge/scene/panel-edge-v-v01.png'),
    fill: require('../../assets/forge/scene/panel-fill-v01.png'),
    plate: require('../../assets/forge/scene/panel-plate-v01.png'),
    // The rune with alpha from its brightness (export-rune-alpha-v01.py). A screen blend drew a dark square in the panel on iOS.
    rune: require('../../assets/forge/scene/panel-rune-alpha-v01.png'),
  },
  talk: {
    oaths: require('../../assets/forge/scene/talk-seal-v01.png'),
    chronicle: require('../../assets/forge/scene/talk-chronicle-v01.png'),
  },
  oaths: {
    hourglass: oathSheet(require('../../assets/oaths/hourglass-v01.png'), 4, 2),
    hourglassStill: require('../../assets/oaths/hourglass-still-v01.png'),
    ruleIcons: oathSheet(require('../../assets/oaths/rule-icons-v01.png'), 5, 2),
    sealStamp: oathSheet(require('../../assets/oaths/seal-stamp-v01.png'), 4, 2),
    sealSparks: oathSheet(require('../../assets/oaths/seal-sparks-v01.png'), 4, 2),
    stepBadges: oathSheet(require('../../assets/oaths/step-badges-v01.png'), 4, 1),
    // DUMMY until MVP-22-E3.5: the candidate hold seal art awaits owner acceptance, ui/HoldSeal draws the wax in code.
    holdSeal: null,
  },
  // The owner's six starters, each drawn thin and heavy (docs/art/player-preset-assets.md).
  presets: {
    starter_01: {
      thin: { figure: require('../../assets/player/starter-01-thin-figure-v01.png'), portrait: require('../../assets/player/starter-01-thin-portrait-v01.png') },
      heavy: { figure: require('../../assets/player/starter-01-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-01-heavy-portrait-v01.png') },
    },
    starter_02: {
      thin: { figure: require('../../assets/player/starter-02-thin-figure-v01.png'), portrait: require('../../assets/player/starter-02-thin-portrait-v01.png') },
      heavy: { figure: require('../../assets/player/starter-02-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-02-heavy-portrait-v01.png') },
    },
    starter_03: {
      thin: { figure: require('../../assets/player/starter-03-thin-figure-v01.png'), portrait: require('../../assets/player/starter-03-thin-portrait-v01.png') },
      heavy: { figure: require('../../assets/player/starter-03-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-03-heavy-portrait-v01.png') },
    },
    starter_04: {
      thin: { figure: require('../../assets/player/starter-04-thin-figure-v01.png'), portrait: require('../../assets/player/starter-04-thin-portrait-v01.png') },
      heavy: { figure: require('../../assets/player/starter-04-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-04-heavy-portrait-v01.png') },
    },
    starter_05: {
      thin: { figure: require('../../assets/player/starter-05-thin-figure-v01.png'), portrait: require('../../assets/player/starter-05-thin-portrait-v01.png') },
      heavy: { figure: require('../../assets/player/starter-05-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-05-heavy-portrait-v01.png') },
    },
    starter_06: {
      thin: { figure: require('../../assets/player/starter-06-thin-figure-v01.png'), portrait: require('../../assets/player/starter-06-thin-portrait-v01.png') },
      heavy: { figure: require('../../assets/player/starter-06-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-06-heavy-portrait-v01.png') },
    },
  },
  playerMotion: { 'starter_02.thin': pilot },
};
