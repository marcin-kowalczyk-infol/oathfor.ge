import { createRef } from 'react';
import { Dimensions, StyleSheet, type Text as NativeText, type TextStyle } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Text } from './Text';

// Node modules of the Jest runtime. The app has no Node typings, so the few calls used here are typed locally.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as { readdirSync(dir: string): string[]; readFileSync(path: string, encoding: 'utf8'): string; statSync(path: string): { isDirectory(): boolean } };
const { join, relative } = require('path') as { join(...parts: string[]): string; relative(from: string, to: string): string };

const scale = (value: number) => Dimensions.set({ window: { width: 402, height: 874, scale: value, fontScale: 1 }, screen: { width: 402, height: 874, scale: value, fontScale: 1 } });
const flat = (text: { props: { style?: unknown } }) => (StyleSheet.flatten(text.props.style as TextStyle) ?? {}) as TextStyle;
beforeEach(() => scale(3));
afterEach(() => scale(3));

// Native check, 2026-09-30, iPhone 18 Pro: a pixel-exact text frame came back from Yoga a float step short and TextKit
// dropped the last line. Every outermost text keeps half a device pixel below its last line (see textSlack.ts).
describe('shared Text', () => {
  test('adds half a device pixel of bottom padding at 3x', async () => {
    await render(<Text style={{ fontSize: 17, lineHeight: 24 }}>Przysięga</Text>);
    expect(flat(screen.getByText('Przysięga')).paddingBottom).toBe(1 / 6);
  });

  test('adds the slack to a text without a line height too', async () => {
    scale(2);
    await render(<Text>Pauza</Text>);
    expect(flat(screen.getByText('Pauza')).paddingBottom).toBe(1 / 4);
  });

  test.each([
    [{ paddingBottom: 4 }, 4],
    [{ paddingVertical: 6 }, 6],
    [{ padding: 8 }, 8],
    [{ padding: 8, paddingVertical: 6, paddingBottom: 4 }, 4],
  ])('keeps a caller bottom padding of %j and adds the slack to it', async (style, bottom) => {
    await render(<Text style={[{ color: 'white' }, style]}>Zapis</Text>);
    const resolved = flat(screen.getByText('Zapis'));
    expect(resolved.paddingBottom).toBe(bottom + 1 / 6);
    expect(resolved).toMatchObject({ ...style, paddingBottom: bottom + 1 / 6, color: 'white' });
  });

  test('leaves a percentage bottom padding as the caller set it', async () => {
    await render(<Text style={{ paddingBottom: '5%' }}>Zapis</Text>);
    expect(flat(screen.getByText('Zapis')).paddingBottom).toBe('5%');
  });

  // Yoga lays the text out in the content box, so padding would take room from a text of fixed height.
  test.each([{ height: 24 }, { maxHeight: 48 }])('leaves a text with %j without the slack', async style => {
    await render(<Text style={{ lineHeight: 24, ...style }}>Zapis</Text>);
    expect(flat(screen.getByText('Zapis')).paddingBottom).toBeUndefined();
  });

  test('pads only the outermost text, never a text nested inside it', async () => {
    await render(<Text testID="outer" style={{ lineHeight: 24 }}>Dzień <Text testID="bold" style={{ fontWeight: '700' }}>7</Text> z <Text testID="span"><Text testID="deep">30</Text></Text></Text>);
    expect(flat(screen.getByTestId('outer')).paddingBottom).toBe(1 / 6);
    for (const id of ['bold', 'span', 'deep']) expect(flat(screen.getByTestId(id)).paddingBottom).toBeUndefined();
    expect(screen.getByText('Dzień 7 z 30')).toBeOnTheScreen();
  });

  test('forwards props and the ref to the native text', async () => {
    const ref = createRef<NativeText>();
    await render(<Text ref={ref} numberOfLines={2} accessibilityRole="header" testID="title">Kuźnia</Text>);
    const text = screen.getByTestId('title');
    expect(text.props).toMatchObject({ numberOfLines: 2, accessibilityRole: 'header' });
    expect(ref.current).not.toBeNull();
  });
});

describe('text imports', () => {
  test('every text of the app renders through ui/Text', () => {
    const root = join(__dirname, '..', '..');
    const offenders: string[] = [];
    const namedImport = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]react-native['"]/g;
    const namespaceImport = /import\s+\*\s+as\s+(\w+)\s+from\s*['"]react-native['"]/g;
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (['node_modules', 'ios', 'android'].includes(name) || name.startsWith('.')) continue;
        if (statSync(path).isDirectory()) { walk(path); continue; }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name) || relative(root, path) === 'src/ui/Text.tsx') continue;
        const source = readFileSync(path, 'utf8');
        const named = [...source.matchAll(namedImport)].some(match => match[1].split(',').some(entry => /^Text(\s+as\s+\w+)?$/.test(entry.trim())));
        const namespaced = [...source.matchAll(namespaceImport)].some(match => new RegExp(`\\b${match[1]}\\.Text\\b`).test(source));
        if (named || namespaced) offenders.push(relative(root, path));
      }
    };
    walk(join(root, 'src'));
    walk(join(root, 'demo'));
    expect(offenders).toEqual([]);
  });
});
