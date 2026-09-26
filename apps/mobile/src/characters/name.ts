// Mirrors apps/api/src/Character/CharacterName.php. String.prototype.trim differs from the server:
// it keeps U+0085 and removes U+FEFF, so trimming uses the explicit Unicode White_Space class.
const whitespace = '[\\p{Z}\\t\\n\\v\\f\\r\\u0085]';
const outerWhitespace = new RegExp(`^${whitespace}+|${whitespace}+$`, 'gu');
const allowed = /^[\p{L}\p{M} '\u2019-]*$/u;
const pattern = /^\p{L}\p{M}*(?:[ '\u2019-]?\p{L}\p{M}*)*$/u;

export const CHARACTER_NAME_MIN = 2;
export const CHARACTER_NAME_MAX = 20;
export type CharacterNameReason = 'too_short' | 'too_long' | 'invalid_character' | 'separator';
export type CharacterNameCheck = { valid: true; name: string } | { valid: false; reason: CharacterNameReason };

export function normalizeCharacterName(input: string): string {
  return input.replace(outerWhitespace, '').normalize('NFC');
}

export function validateCharacterName(input: string): CharacterNameCheck {
  const name = normalizeCharacterName(input);
  const length = [...name].length;
  if (!allowed.test(name) || /^\p{M}/u.test(name)) return { valid: false, reason: 'invalid_character' };
  if (length > CHARACTER_NAME_MAX) return { valid: false, reason: 'too_long' };
  if (length < CHARACTER_NAME_MIN) return { valid: false, reason: 'too_short' };
  if (!pattern.test(name)) return { valid: false, reason: 'separator' };
  return { valid: true, name };
}

/**
 * Structural check for a name returned by the server. The full rule gates only what the client sends,
 * so a server with a newer Unicode table cannot make stored characters unreadable.
 */
export function isStoredCharacterName(value: unknown): value is string {
  if (typeof value !== 'string' || value.replace(outerWhitespace, '') !== value || /\p{Cc}/u.test(value)) return false;
  const length = [...value].length;
  return length >= 1 && length <= CHARACTER_NAME_MAX;
}
