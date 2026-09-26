import { isStoredCharacterName, normalizeCharacterName, validateCharacterName } from './name';

// Same vectors as apps/api/tests/Character/CharacterNameTest.php, plus astral letters counted as code points.
const valid: [string, string, string][] = [
  ['plain', 'Mira', 'Mira'],
  ['polish letter', 'Żaneta', 'Żaneta'],
  ['hyphen', 'Anne-Marie', 'Anne-Marie'],
  ['ascii apostrophe', "O'Brien", "O'Brien"],
  ['typographic apostrophe', 'O\u2019Brien', 'O\u2019Brien'],
  ['space', 'Jan Kowalski', 'Jan Kowalski'],
  ['outer spaces', '  Mira  ', 'Mira'],
  ['outer unicode whitespace', '\u00A0\u3000Mira\t\u2029', 'Mira'],
  ['next line control', '\u0085Mira', 'Mira'],
  ['nfd to nfc', 'Zoe\u0301', 'Zo\u00E9'],
  ['two letters', 'Al', 'Al'],
  ['twenty letters', 'a'.repeat(20), 'a'.repeat(20)],
  ['mark after separator letter', 'Ana-E\u0301va', 'Ana-\u00C9va'],
  ['two astral letters', '\u{10400}\u{10401}', '\u{10400}\u{10401}'],
  ['twenty astral letters', '\u{10400}'.repeat(20), '\u{10400}'.repeat(20)],
  ['vertical tab and form feed trimmed', '\u000B\u000CMira\r\n', 'Mira'],
];

const invalid: [string, string, string][] = [
  ['single letter', 'A', 'too_short'],
  ['double space', 'Anna  Maria', 'separator'],
  ['trailing hyphen', 'Anna-', 'separator'],
  ['leading hyphen', '-Anna', 'separator'],
  ['digits', 'R2D2', 'invalid_character'],
  ['twenty one letters', 'a'.repeat(21), 'too_long'],
  ['emoji', 'Mira\u{1F600}', 'invalid_character'],
  ['double hyphen', 'Anna--Maria', 'separator'],
  ['empty', '', 'too_short'],
  ['only spaces', '   ', 'too_short'],
  ['mixed separators', 'Anna -Maria', 'separator'],
  ['inner tab', 'Anna\tMaria', 'invalid_character'],
  ['leading mark', '\u0301Anna', 'invalid_character'],
  ['other apostrophe', 'O`Brien', 'invalid_character'],
  ['dot', 'J. Doe', 'invalid_character'],
  ['byte order mark', '\uFEFFMira', 'invalid_character'],
  ['single astral letter', '\u{10400}', 'too_short'],
  ['twenty one astral letters', '\u{10400}'.repeat(21), 'too_long'],
];

test.each(valid)('accepts %s and returns the stored form', (_label, input, expected) => {
  expect(validateCharacterName(input)).toEqual({ valid: true, name: expected });
  expect(normalizeCharacterName(input)).toBe(expected);
  expect(isStoredCharacterName(expected)).toBe(true);
});

test.each(invalid)('rejects %s with a specific reason', (_label, input, reason) => {
  expect(validateCharacterName(input)).toEqual({ valid: false, reason });
});

test('trims exactly Unicode White_Space, unlike String.prototype.trim', () => {
  expect(normalizeCharacterName('\u0085Mira\u0085')).toBe('Mira');
  expect(normalizeCharacterName('\uFEFFMira')).toBe('\uFEFFMira');
  expect(normalizeCharacterName('\u2028Mira\u205F')).toBe('Mira');
});

test('stored names are checked structurally so a newer server Unicode table cannot lock the player out', () => {
  // U+3F000 is unassigned in every Unicode version the client may ship, standing in for a letter added later.
  const newer = 'Mira\u{3F000}';
  expect(validateCharacterName(newer).valid).toBe(false);
  expect(isStoredCharacterName(newer)).toBe(true);
  expect(isStoredCharacterName('A')).toBe(true);
  expect(isStoredCharacterName('Zoe\u0301')).toBe(true);
  expect(isStoredCharacterName('\u{10400}'.repeat(20))).toBe(true);
  for (const value of ['', ' Mira', 'Mira\u0085', '\u00A0Mira', 'a'.repeat(21), '\u{10400}'.repeat(21), 'Mi\u0000ra', 'Mi\nra', 'Mira\u007F', 42, null]) {
    expect(isStoredCharacterName(value)).toBe(false);
  }
});
