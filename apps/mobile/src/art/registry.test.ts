import { resolveArt } from './ArtProvider';
import { cinematicArt } from './cinematic';
import { currentArt } from './current';
import { mergeArt } from './registry';

// Node modules of the Jest runtime. The app has no Node typings, so the few calls used here are typed locally.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as { readdirSync(dir: string): string[]; readFileSync(path: string, encoding: 'utf8'): string; statSync(path: string): { isDirectory(): boolean } };
const { join, relative } = require('path') as { join(...parts: string[]): string; relative(from: string, to: string): string };

// jest-expo resolves an image require to { testUri } with the path, so a file name identifies each image.
const file = (source: unknown) => String((source as { testUri: string }).testUri).split('/').pop();
const appearances = ['zharomir-wanderer-v01', 'zharomir-ember-sash-v01', 'zharomir-guardian-token-v01', 'zharomir-oath-fittings-v01', 'zharomir-spark-mantle-v01'] as const;

function sources(value: unknown, found: string[] = []): string[] {
  if (value && typeof value === 'object') {
    if ('testUri' in value) found.push(file(value)!);
    else Object.values(value).forEach(item => sources(item, found));
  }
  return found;
}

describe('art registry', () => {
  test('the current style is the v01 set, unchanged by the cinematic files', () => {
    expect(resolveArt('current')).toBe(currentArt);
    expect(file(currentArt.room.image)).toBe('room-prototype-v03.png');
    for (const id of appearances) expect(file(currentArt.companion[id].image)).toBe(`${id}.png`);
    expect(sources(currentArt).some(name => name!.includes('cinematic'))).toBe(false);
  });

  test('the cinematic style draws the exported Żaromir and the C4 room', () => {
    const art = resolveArt('cinematic');
    for (const id of appearances) expect(file(art.companion[id].image)).toBe(`${id.replace('-v01', '-cinematic-v01')}.png`);
    expect(file(art.room.image)).toBe('room-cinematic-v02.png');
  });

  test('a file without a cinematic version falls back to its current one', () => {
    const art = resolveArt('cinematic');
    // The art session kept the light sheets as they are (remaining-v01/optional-fx-review.md).
    for (const key of ['hearthLoop', 'hearthBurst', 'doorMist', 'candle', 'wisp', 'sealStar', 'sealTree', 'sealWolf', 'bookSigns'] as const) expect(art.effects[key]).toBe(currentArt.effects[key]);
    // Nothing draws the seal ring or the chronicle page since 28ef796, so neither style lists them (owner decision, 2026-09-30).
    expect(Object.keys(currentArt.effects).sort()).toEqual(['bookSigns', 'candle', 'doorMist', 'hearthBurst', 'hearthLoop', 'sealStar', 'sealTree', 'sealWolf', 'wisp']);
    expect(Object.keys(art.effects).sort()).toEqual(Object.keys(currentArt.effects).sort());
    // One cinematic companion picture keeps the others, each with its own frames.
    const partial = mergeArt(currentArt, { companion: { 'zharomir-wanderer-v01': cinematicArt.companion!['zharomir-wanderer-v01'] } });
    expect(partial.companion['zharomir-wanderer-v01']).toBe(cinematicArt.companion!['zharomir-wanderer-v01']);
    expect(partial.companion['zharomir-ember-sash-v01']).toBe(currentArt.companion['zharomir-ember-sash-v01']);
    // A single build of a preset keeps the other build.
    const thin = { figure: currentArt.presets.starter_01.heavy.figure, portrait: currentArt.presets.starter_01.heavy.portrait };
    const presets = mergeArt(currentArt, { presets: { starter_01: { thin } } }).presets;
    expect(presets.starter_01.thin).toBe(thin);
    expect(presets.starter_01.heavy).toBe(currentArt.presets.starter_01.heavy);
    expect(presets.starter_02).toBe(currentArt.presets.starter_02);
  });

  test('the cinematic style draws the delivered players, stations, interface and Oath art', () => {
    const art = resolveArt('cinematic');
    const all = sources({ presets: art.presets, playerMotion: art.playerMotion, stations: art.stations, panel: { fill: art.panel.fill, plate: art.panel.plate, rune: art.panel.rune }, talk: art.talk, oaths: art.oaths,
      activityObjects: art.activityObjects, stateSeals: art.stateSeals, haze: art.haze, menuTools: art.menuTools });
    expect(all).toHaveLength(24 + 13 + 3 + 3 + 2 + 6 + 4);
    // The frame tiles are v02, with the v01 row profile (panel-frame-v02).
    for (const key of ['corner', 'edgeH', 'edgeV'] as const) expect(file(art.panel[key])).toMatch(/^panel-.*-cinematic-v02\.png$/);
    for (const name of all) expect(name).toMatch(/-cinematic-v01\.(png|jpg)$/);
    for (const id of Object.keys(currentArt.presets)) for (const build of ['thin', 'heavy'] as const) expect(file(art.presets[id][build].figure)).toBe(`${id.replace('_', '-')}-${build}-figure-cinematic-v01.png`);
    // Sheets keep the v01 cell layout, so frame indices such as ruleIcon stay valid.
    const layout = (value: { cols: number; rows: number; aspect: number }) => [value.cols, value.rows, value.aspect];
    for (const key of ['hourglass', 'ruleIcons', 'sealStamp', 'sealSparks', 'stepBadges'] as const) expect(layout(art.oaths[key])).toEqual(layout(currentArt.oaths[key]));
    expect(layout(art.playerMotion['starter_02.thin'].walk.front)).toEqual(layout(currentArt.playerMotion['starter_02.thin'].walk.front));
  });

  // Step badges (MVP-22): interrupted, needsMore, review, waiting, one row of 96 px cells.
  test('each style has its own step badge sheet of four square cells', () => {
    expect(file(currentArt.oaths.stepBadges.source)).toBe('step-badges-v01.png');
    expect(file(resolveArt('cinematic').oaths.stepBadges.source)).toBe('step-badges-cinematic-v01.png');
    expect([currentArt.oaths.stepBadges.cols, currentArt.oaths.stepBadges.rows, currentArt.oaths.stepBadges.aspect]).toEqual([4, 1, 1]);
  });

  test('each style places the hearth flame on its own close-up', () => {
    expect(currentArt.stationFire).toEqual({ x: 0.5, y: 0.345, width: 0.24 });
    const fire = resolveArt('cinematic').stationFire;
    // The cinematic fire bed is centred at x 0.526 and its opening is 0.22 of the width, so the flame stays inside the arch.
    expect(fire.x).toBeCloseTo(0.526, 3);
    expect(fire.width).toBeLessThan(0.22);
  });

  test('the cinematic room draws only cuts from itself, never the v03 cuts', () => {
    const room = resolveArt('cinematic').room;
    expect(room).toBe(cinematicArt.room);
    expect(file(room.sealsFront!.source)).toBe('room-seals-front-cinematic-v01.png');
    expect(file(room.doorLeaf!.source)).toBe('room-door-leaf-cinematic-v01.png');
    for (const id of ['star', 'tree', 'wolf'] as const) expect(file(room.seals![id].source)).toBe(`room-seal-${id}-cinematic-v02.png`);
    // The leaf is built on the room's own book pixels and placed where that book lies.
    expect(file(room.bookPageTurn!.sheet.source)).toBe('fx-book-page-turn-cinematic-v03.png');
    const leaf = room.bookPageTurn!, height = leaf.width * 887 / leaf.sheet.aspect;
    expect(leaf.x - leaf.width * 887 * leaf.sheet.anchor.x).toBeCloseTo(644, 1);
    expect(leaf.y - height * leaf.sheet.anchor.y).toBeCloseTo(819, 1);
    expect(leaf.width * 887).toBeCloseTo(179, 1);
    // Each cut box lies on the 887 × 1774 artwork and holds its turning centre or hinge.
    const inside = (box: readonly number[]) => box[0] >= 0 && box[1] >= 0 && box[0] + box[2] <= 887 && box[1] + box[3] <= 1774;
    expect(inside(room.sealsFront!.box) && inside(room.doorLeaf!.box)).toBe(true);
    for (const id of ['star', 'tree', 'wolf'] as const) {
      const { box, centre } = room.seals![id];
      expect(centre[0]).toBeGreaterThan(box[0]); expect(centre[0]).toBeLessThan(box[0] + box[2]);
      expect(centre[1]).toBeGreaterThan(box[1]); expect(centre[1]).toBeLessThan(box[1] + box[3]);
      // Native check: a layer with the barrel side and knob swung them around the face. A turning layer is the face disk only,
      // so its box is square and centred on the turning centre within the 1 pixel feather.
      expect(Math.abs(box[2] - box[3])).toBeLessThanOrEqual(1);
      expect(Math.abs(box[0] + box[2] / 2 - centre[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(box[1] + box[3] / 2 - centre[1])).toBeLessThanOrEqual(1);
    }
    expect(room.doorLeaf!.hinge).toBeGreaterThanOrEqual(room.doorLeaf!.box[0]);
    // Without its own room the style keeps the current room with its cuts.
    expect(mergeArt(currentArt, {}).room).toBe(currentArt.room);
  });

  test('each style measures its own flames, and C4 moves only the chandelier', () => {
    const current = currentArt.room.candles, cinematic = resolveArt('cinematic').room.candles;
    expect(cinematic).toHaveLength(current.length);
    // The chandelier's wax candles lift their flames 9 to 21 pixels on the 1774 pixel artwork.
    for (let i = 0; i < 7; i++) expect((current[i].y - cinematic[i].y) * 1774).toBeGreaterThan(8);
    expect(cinematic.slice(7)).toEqual(current.slice(7));
  });

  test('Żaromir\'s sheets and bust are cinematic as one unit with the current cell layout', () => {
    const art = resolveArt('cinematic');
    const sheets = [...Object.values(art.zharomir.walk), art.zharomir.idle, art.zharomir.talk, art.zharomir.turn, ...Object.values(art.zharomir.act)];
    expect(sheets).toHaveLength(15);
    for (const sheet of sheets) expect(file(sheet.source)).toMatch(/^zharomir-.*-cinematic-v02\.png$/);
    const layout = (value: { cols: number; rows: number; aspect: number; anchor: object; blend: string }) => [value.cols, value.rows, value.aspect, value.anchor, value.blend];
    expect(layout(art.zharomir.walk.front)).toEqual(layout(currentArt.zharomir.walk.front));
    expect(layout(art.zharomir.act.door)).toEqual(layout(currentArt.zharomir.act.door));
    expect(file(art.zharomirBust)).toBe('zharomir-bust-cinematic-v01.png');
  });

  test('each style frames Żaromir for its own canvas', () => {
    const current = currentArt.companion['zharomir-wanderer-v01'].frames;
    const cinematic = resolveArt('cinematic').companion['zharomir-wanderer-v01'].frames;
    expect(current.bubble).toEqual({ width: 180.224, height: 270.336, left: -73.92, top: -3.52, backdrop: '#44372c' });
    expect(current.tile).toEqual({ width: 140, height: 210, top: -6, left: 18, right: 18 });
    expect(current.panel).toEqual({ width: 180, height: 270, left: 0, top: 0 });
    // The frames keep the 2:3 canvas.
    for (const frame of [cinematic.bubble, cinematic.tile, cinematic.panel]) expect(frame.height / frame.width).toBeCloseTo(1.5, 2);
    // The v01 figure is 1370 pixels tall from y 47, the cinematic one 1477 from y 22. Tile and panel keep its height and head line.
    const figure = (frame: { height: number; top: number }, top: number, height: number) => ({ head: frame.top + top * frame.height / 1536, height: height * frame.height / 1536 });
    for (const key of ['tile', 'panel'] as const) {
      const old = figure(current[key], 47, 1370), next = figure(cinematic[key], 22, 1477);
      expect(Math.abs(next.head - old.head)).toBeLessThan(0.5);
      expect(Math.abs(next.height - old.height)).toBeLessThan(0.5);
    }
    // The larger cinematic head gets a larger source window in the 44 pt avatar: 325 source pixels instead of 250.
    expect(44 * 1024 / cinematic.bubble.width).toBeCloseTo(325, 0);
    expect(cinematic.bubble.backdrop).toBe('#222222');
  });

  test('every image of the app is required in src/art', () => {
    const root = join(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && relative(root, path).split('/')[0] !== 'art'
          && /require\([^)]*\.(png|jpe?g|webp|gif)/.test(readFileSync(path, 'utf8'))) offenders.push(relative(root, path));
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
