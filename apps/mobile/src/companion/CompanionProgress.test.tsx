import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ArtProvider, resolveArt } from '../art/ArtProvider';
import type { ArtStyle } from '../art/registry';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { CompanionArt, CompanionProgress } from './CompanionProgress';
import { CompanionPresentation } from './catalog';

test.each([['pl', 'Płaszcz Iskry', 'Początkowa ścieżka ukończona'], ['en', 'Spark Mantle', 'Initial track complete']] as const)('level 5 completes the initial track in %s without a next unlock', async (locale, name, complete) => {
  await render(<LocalizationProvider initialLocale={locale}><CompanionProgress current="zharomir-spark-mantle-v01" next={null} /></LocalizationProvider>);
  expect(screen.getByText(name)).toBeOnTheScreen();
  expect(screen.getByText(complete)).toBeOnTheScreen();
  expect(screen.getAllByRole('image')).toHaveLength(1);
  expect(screen.queryByText(/Locked|Jeszcze nieodblokowane|Level 6|Poziom 6/)).not.toBeOnTheScreen();
});

test.each([
  [{ current: 'zharomir-wanderer-v01', next: 'zharomir-ember-sash-v01' }, 'Wanderer', 'Ember Sash'],
  [{ current: 'zharomir-ember-sash-v01', next: 'zharomir-guardian-token-v01' }, 'Ember Sash', 'Guardian’s Token'],
  [{ current: 'zharomir-guardian-token-v01', next: 'zharomir-oath-fittings-v01' }, 'Guardian’s Token', 'Oath Fittings'],
  [{ current: 'zharomir-oath-fittings-v01', next: 'zharomir-spark-mantle-v01' }, 'Oath Fittings', 'Spark Mantle'],
] satisfies [CompanionPresentation, string, string][])('renders selected current/locked-next content for %j', async (state, currentName, nextName) => {
  await render(<LocalizationProvider initialLocale="en"><CompanionProgress {...state} /></LocalizationProvider>);
  expect(screen.getByText('Current appearance')).toBeOnTheScreen();
  expect(screen.getByText(currentName)).toBeOnTheScreen();
  expect(screen.getByText('Locked')).toBeOnTheScreen();
  expect(screen.getByText(nextName)).toBeOnTheScreen();
  expect(screen.getAllByRole('image')).toHaveLength(2);
});

test.each([['pl', 'Grafika niedostępna', 'Wędrowiec', 'Żaromir, drewniany wędrowiec z żelazną latarnią.'], ['en', 'Artwork unavailable', 'Wanderer', 'Zharomir, a wooden wanderer carrying an iron lantern.']] as const)('failed %s image retains informative copy and another appearance can load', async (locale, unavailable, name, description) => {
  const view = await render(<LocalizationProvider initialLocale={locale}><CompanionArt appearance="zharomir-wanderer-v01" /></LocalizationProvider>);
  await fireEvent(screen.getByRole('image', { name: description }), 'error', { nativeEvent: { error: 'synthetic failure' } });
  expect(screen.getByText(unavailable)).toBeOnTheScreen();
  expect(screen.getByText(name)).toBeOnTheScreen();
  expect(screen.getByText(description)).toBeOnTheScreen();
  await view.rerender(<LocalizationProvider initialLocale={locale}><CompanionArt appearance="zharomir-ember-sash-v01" /></LocalizationProvider>);
  expect(screen.queryByText(unavailable)).not.toBeOnTheScreen();
  expect(screen.getByRole('image')).toBeOnTheScreen();
});

test('decorative art is absent from the accessibility tree', async () => {
  await render(<LocalizationProvider initialLocale="en"><CompanionArt appearance="zharomir-wanderer-v01" decorative /></LocalizationProvider>);
  expect(screen.queryByRole('image')).not.toBeOnTheScreen();
  expect(screen.queryByText('Wanderer')).not.toBeOnTheScreen();
});

test.each(['current', 'cinematic'] as const)('the panel keeps Żaromir\'s size and place for the %s art', async (style: ArtStyle) => {
  const { image, frames } = resolveArt(style).companion['zharomir-ember-sash-v01'];
  await render(<ArtProvider style={style}><LocalizationProvider initialLocale="en"><CompanionArt appearance="zharomir-ember-sash-v01" /></LocalizationProvider></ArtProvider>);
  const picture = screen.getByRole('image');
  expect(picture.props.source).toBe(image);
  expect(StyleSheet.flatten(picture.props.style)).toMatchObject({ position: 'absolute', ...frames.panel });
  expect(StyleSheet.flatten(screen.getByTestId('companion-art-frame').props.style)).toMatchObject({ width: 180, height: 270, overflow: 'hidden', alignSelf: 'center' });
});
