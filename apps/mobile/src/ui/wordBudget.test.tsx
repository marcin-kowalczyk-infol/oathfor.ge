import { View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Disclosure } from './Disclosure';
import { Text } from './Text';
import { visibleWords } from './wordBudget';
import { LocalizationProvider } from '../localization/LocalizationProvider';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

// Counting rules of docs/product/engagement.md E1 (D-E4): a word is a drawn token with at least one letter.
const measure = () => visibleWords(screen.root!);

describe('visibleWords', () => {
  test('numbers, dates and times do not count', async () => {
    await render(<Text>Prześlij dowód do czw 29 paź 02:30</Text>);
    expect(measure()).toEqual({ count: 5, words: ['Prześlij', 'dowód', 'do', 'czw', 'paź'] });
  });

  test('a duration counts its unit letters only', async () => {
    await render(<Text>2 d 5 h</Text>);
    expect(measure().count).toBe(2);
  });

  test('symbols do not count and non-breaking spaces still split words', async () => {
    await render(<View><Text>·</Text><Text>✓ Zapisano</Text><Text>{'i w domu'}</Text></View>);
    expect(measure().words).toEqual(['Zapisano', 'i', 'w', 'domu']);
  });

  // MVP-22-E1.R: the "Now" medallion draws ϟ, a Greek letter used as a pictogram. Only Latin letters, Polish ones included, make a word.
  test('a token without a Latin letter is a symbol, not a word', async () => {
    await render(<View><Text>ϟ</Text><Text>◷ Później</Text><Text>Żółć ąę</Text></View>);
    expect(measure().words).toEqual(['Później', 'Żółć', 'ąę']);
  });

  test('a nested span joins its parent text without splitting a word', async () => {
    await render(<Text>Dzień <Text>7</Text> z <Text>30</Text>, Przy<Text>sięga</Text></Text>);
    expect(measure().words).toEqual(['Dzień', 'z', 'Przysięga']);
  });

  test('every drawn text of the tree counts, buttons and links included', async () => {
    await render(<LocalizationProvider initialLocale="pl"><View><Text>Złóż Przysięgę</Text><Disclosure label="Pełne zasady"><Text>Ukryte</Text></Disclosure></View></LocalizationProvider>);
    expect(measure().words).toEqual(['Złóż', 'Przysięgę', 'Pełne', 'zasady']);
  });

  test('accessibility labels and hints never count', async () => {
    await render(<View accessibilityLabel="Długa etykieta dla czytnika ekranu"><Text accessibilityLabel="Też niewidoczna" accessibilityHint="Podpowiedź">Pauza</Text></View>);
    expect(measure()).toEqual({ count: 1, words: ['Pauza'] });
  });

  test('a closed fold costs nothing and an opened one counts its children', async () => {
    await render(<LocalizationProvider initialLocale="pl"><Disclosure label="Szczegóły"><Text>Pauza nie przesuwa terminu.</Text></Disclosure></LocalizationProvider>);
    expect(measure().count).toBe(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Szczegóły' }));
    expect(measure()).toEqual({ count: 5, words: ['Szczegóły', 'Pauza', 'nie', 'przesuwa', 'terminu.'] });
  });

  describe('exempt text', () => {
    test('an icon label of up to three words costs nothing', async () => {
      await render(<View><Text budget="icon">Okno na dowód</Text><Text>Termin</Text></View>);
      expect(measure()).toEqual({ count: 1, words: ['Termin'] });
    });

    test('an icon label of four words fails and names the text', async () => {
      await render(<Text budget="icon">Okno na dowód przez</Text>);
      expect(measure).toThrow('icon label has 4 words, at most 3: "Okno na dowód przez"');
    });

    test.each(['error', 'declaration', 'rules'] as const)('a %s text costs nothing', async budget => {
      await render(<View><Text budget={budget}>Nie udało się wysłać dowodu, spróbuj ponownie za chwilę.</Text><Text>Wróć</Text></View>);
      expect(measure()).toEqual({ count: 1, words: ['Wróć'] });
    });

    // MVP-22-E1.R: an exemption covers its own strings only. A counted text nested in it is still counted, so a mark cannot hide it.
    test('an unmarked text nested inside an exempt text still counts', async () => {
      await render(<Text budget="declaration">Codziennie przejdę <Text>dziesięć tysięcy</Text> kroków <Text budget="declaration">bez wyjątku</Text></Text>);
      expect(measure().words).toEqual(['dziesięć', 'tysięcy']);
    });

    test('an exempt span inside a counted text costs nothing', async () => {
      await render(<Text>Ślubuję: <Text budget="declaration">Codziennie przejdę dziesięć tysięcy kroków</Text></Text>);
      expect(measure().words).toEqual(['Ślubuję:']);
    });
  });

  test('the budget mark leaves accessibility props and the host tree unchanged', async () => {
    const tree = (budget?: 'icon') => <View><Text budget={budget} accessibilityRole="header" accessibilityLabel="Termin" testID="label">Termin</Text></View>;
    await render(tree());
    const plain = screen.getByTestId('label');
    const shape = { parent: plain.parent?.children.length, children: plain.children, label: plain.props.accessibilityLabel, role: plain.props.accessibilityRole, accessible: plain.props.accessible, hidden: plain.props.accessibilityElementsHidden };
    await render(tree('icon'));
    const marked = screen.getByTestId('label');
    expect({ parent: marked.parent?.children.length, children: marked.children, label: marked.props.accessibilityLabel, role: marked.props.accessibilityRole, accessible: marked.props.accessible, hidden: marked.props.accessibilityElementsHidden }).toEqual(shape);
    expect(marked.parent?.type).toBe(plain.parent?.type);
  });
});
