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
