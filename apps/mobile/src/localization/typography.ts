const shortWord = /(^|[\s („"«])([aiouwz]) +/gi;

// Units that follow a count in rendered copy. Whole words only, so "dniach" or "history" keep their space.
// The rate-limit waits count seconds ("za 5 sekund", "in 5 seconds"). No catalog uses a bare "s" as a unit, so it is not listed.
const units = ['XP', 'min', 'h', 'd', 'dzień', 'dnia', 'dni', 'minuta', 'minutę', 'minuty', 'minut', 'godzina', 'godzinę', 'godziny', 'godzin',
  'sekunda', 'sekundę', 'sekundy', 'sekund', 'day', 'days', 'hour', 'hours', 'minute', 'minutes', 'second', 'seconds'];
const numberUnit = new RegExp(`(^|[^\\p{L}\\p{N}_])(\\d+(?:[.,]\\d+)?) +(${units.join('|')})(?![\\p{L}\\p{N}_])`, 'gu');

/**
 * Polish typesetting keeps a single-letter word (a, i, o, u, w, z) with the word after it, so no line ends with one.
 * In every language a number keeps its unit (15 XP, 3 dni, 15 minutes) on the same line (MVP-22-B2),
 * and a middle-dot separator never ends a line (MVP-22-G24b). Other languages keep their single-letter words unbound.
 */
export function bindShortWords(text: string, language: string): string {
  const counted = bindSeparators(text).replace(numberUnit, '$1$2\u00a0$3');
  if (!language.startsWith('pl')) return counted;
  // Neighbouring short words share a space, so a second pass binds the one the first match consumed.
  let bound = counted;
  for (let previous = ''; previous !== bound;) {
    previous = bound;
    bound = bound.replace(shortWord, '$1$2\u00a0');
  }
  return bound;
}

const separator = / · /g;

/**
 * A middle-dot separator between segments ("15:32 · Warszawa") never ends a line. The space before the dot stays breakable
 * and the space after it becomes a no-break space, so a wrap moves the dot to the next line with its segment.
 * Every language, drawn text only. Spoken labels and hints keep the plain form (local decision, MVP-22-G24b).
 */
export function bindSeparators(text: string): string {
  return text.replace(separator, ' ·\u00a0');
}

/**
 * A short value with commas, such as "0 XP, bez straty", breaks only after a comma. The spaces inside each phrase become
 * no-break spaces, so a wrap keeps whole phrases on their lines (MVP-22-E3r2). A value without a comma keeps its spaces,
 * so a narrow cell still wraps it between words. Drawn text only, spoken labels keep the plain form.
 */
export function breakAfterCommas(text: string): string {
  return text.includes(', ') ? text.split(', ').map(phrase => phrase.replace(/ /g, '\u00a0')).join(', ') : text;
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

const drawnBinding = /[\u00a0\u2060]/g;

/**
 * Turns drawn bindings back to plain text for a spoken label. A no-break space becomes a space and a word joiner goes away.
 * Callers pass drawn prose, the label keeps the plain form (MVP-22-G24, G31).
 */
export function plainText(text: string): string {
  return text.replace(drawnBinding, character => character === '\u00a0' ? ' ' : '');
}
