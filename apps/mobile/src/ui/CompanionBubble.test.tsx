import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ArtProvider, resolveArt } from '../art/ArtProvider';
import type { ArtStyle } from '../art/registry';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { CompanionBubble } from './CompanionBubble';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

test('the message is capped so a long Polish word never breaks inside the bubble at the largest text', async () => {
  // Native MVP-18 check on iPhone SE 3: "potwierdzeniem" broke as "potwierdzen / iem" in the pause review bubble.
  await render(<LocalizationProvider initialLocale="pl"><CompanionBubble message="Przed potwierdzeniem przejrzyj każdą Przysięgę poniżej." /></LocalizationProvider>);
  expect(screen.getByText('Przed potwierdzeniem przejrzyj każdą Przysięgę poniżej.').props.maxFontSizeMultiplier).toBeLessThanOrEqual(2.5);
  // The speaker label stays smaller than the message, as in the Forge room bubble.
  expect(screen.getByText('Żaromir').props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
});

test.each(['current', 'cinematic'] as const)('the avatar frames Żaromir\'s head for the %s art', async (style: ArtStyle) => {
  const { image, frames } = resolveArt(style).companion['zharomir-wanderer-v01'];
  await render(<ArtProvider style={style}><LocalizationProvider initialLocale="pl"><CompanionBubble message="Witaj." /></LocalizationProvider></ArtProvider>);
  const picture = screen.getByTestId('companion-avatar-image', { includeHiddenElements: true });
  expect(picture.props.source).toBe(image);
  const { backdrop, ...place } = frames.bubble;
  expect(StyleSheet.flatten(picture.props.style)).toMatchObject({ position: 'absolute', ...place });
  expect(StyleSheet.flatten(screen.getByTestId('companion-avatar', { includeHiddenElements: true }).props.style)).toMatchObject({ width: 44, height: 44, backgroundColor: backdrop });
});
