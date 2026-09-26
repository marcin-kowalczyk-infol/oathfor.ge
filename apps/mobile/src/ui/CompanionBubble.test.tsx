import { render, screen } from '@testing-library/react-native';
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
