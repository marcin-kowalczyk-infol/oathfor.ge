const shortWord = /(^|[\s („"«])([aiouwz]) +/gi;

/**
 * Polish typesetting keeps a single-letter word (a, i, o, u, w, z) with the word after it, so no line ends with one.
 * Other languages are returned unchanged.
 */
export function bindShortWords(text: string, language: string): string {
  if (!language.startsWith('pl')) return text;
  // Neighbouring short words share a space, so a second pass binds the one the first match consumed.
  let bound = text;
  for (let previous = ''; previous !== bound;) {
    previous = bound;
    bound = bound.replace(shortWord, '$1$2 ');
  }
  return bound;
}

const slashBetweenLetters = /(\p{L})\/(?=\p{L})/gu;

/**
 * A slash between letters, as in the IANA zone Europe/Warsaw, gets a word joiner after it, so the line never breaks there.
 * Only for drawn text. Spoken labels and hints keep the plain form.
 */
export function keepSlashJoined(text: string): string {
  return text.replace(slashBetweenLetters, `$1/${WORD_JOINER}`);
}
const WORD_JOINER = '\u2060';
