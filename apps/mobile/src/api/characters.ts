import type { AuthFailure } from './auth';
import { createBoundedRequest, exact, type ClientOptions } from './request';
import { isUtcTime, isUuid } from './oathSchema';
import { isStoredCharacterName, validateCharacterName } from '../characters/name';

export type CharacterForm = 'masculine' | 'feminine' | 'neutral';
export type Character = { id: string; name: string; presetId: string; form: CharacterForm; createdAt: string };
export type CharacterList = { characters: Character[]; activeCharacterId: string | null; limit: 3; presets: string[]; serverTime: string };
export type CharacterCreation = { character: Character; activeCharacterId: string; serverTime: string };
export type CharacterCreationInput = { requestId: string; name: string; presetId: string; form: CharacterForm };
export type CharacterCode = 'invalid_request' | 'invalid_character_name' | 'invalid_preset' | 'character_limit_reached' | 'idempotency_conflict' | 'onboarding_incomplete' | 'not_found';
export type CharacterFailure = { kind: 'character_error'; code: CharacterCode };
export type CharacterResult<T> = { kind: 'success'; value: T } | AuthFailure | CharacterFailure;
/** 201 creates the character, 200 replays an earlier creation with the same request ID. */
export type CharacterCreationResult = { kind: 'success'; created: boolean; value: CharacterCreation } | AuthFailure | CharacterFailure;

const LIMIT = 3;
export function isPresetId(value: unknown): value is string { return typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value); }
export function isCharacterForm(value: unknown): value is CharacterForm { return value === 'masculine' || value === 'feminine' || value === 'neutral'; }
function isCharacter(value: unknown): value is Character {
  return exact(value, ['id', 'name', 'presetId', 'form', 'createdAt']) && isUuid(value.id) && isStoredCharacterName(value.name)
    && isPresetId(value.presetId) && isCharacterForm(value.form) && isUtcTime(value.createdAt);
}
// A stored presetId may be absent from the current catalog, so characters are not checked against presets.
function isCharacterList(value: unknown): value is CharacterList {
  if (!exact(value, ['characters', 'activeCharacterId', 'limit', 'presets', 'serverTime']) || value.limit !== LIMIT
    || !Array.isArray(value.characters) || value.characters.length > LIMIT || !value.characters.every(isCharacter)
    || !Array.isArray(value.presets) || !value.presets.every(isPresetId) || new Set(value.presets).size !== value.presets.length
    || !isUtcTime(value.serverTime)) return false;
  const ids = value.characters.map(character => character.id);
  return new Set(ids).size === ids.length && (value.activeCharacterId === null || ids.includes(value.activeCharacterId as string));
}
function isCreation(value: unknown): value is CharacterCreation {
  return exact(value, ['character', 'activeCharacterId', 'serverTime']) && isCharacter(value.character)
    && isUuid(value.activeCharacterId) && isUtcTime(value.serverTime);
}
function validInput(input: unknown): input is CharacterCreationInput {
  return exact(input, ['requestId', 'name', 'presetId', 'form']) && isUuid(input.requestId) && typeof input.name === 'string'
    && isPresetId(input.presetId) && isCharacterForm(input.form);
}

const errors: Record<string, Record<number, CharacterCode[]>> = {
  // A server 400 invalid_request is decisive, unlike the client-side { kind: 'invalid_request' } refusal before sending.
  '/api/characters': { 400: ['invalid_request', 'invalid_character_name', 'invalid_preset'], 409: ['character_limit_reached', 'idempotency_conflict', 'onboarding_incomplete'] },
  '/api/characters/active': { 404: ['not_found'] },
};

export function createCharacterClient(options: ClientOptions) {
  const request = createBoundedRequest<CharacterFailure>(options, (path, status, code) => typeof code === 'string' && (errors[path]?.[status] as string[] | undefined)?.includes(code) ? { kind: 'character_error', code: code as CharacterCode } : undefined);
  return {
    list: (token: string, signal?: AbortSignal): Promise<CharacterResult<CharacterList>> =>
      request('/api/characters', 'GET', 200, isCharacterList, undefined, token, signal),
    async create(token: string, input: CharacterCreationInput, signal?: AbortSignal): Promise<CharacterCreationResult> {
      const name = validInput(input) ? validateCharacterName(input.name) : undefined;
      if (!name?.valid) return { kind: 'invalid_request' };
      // The normalized name is sent so a stored retry replays byte-identical input.
      const body = { requestId: input.requestId, name: name.name, presetId: input.presetId, form: input.form };
      let created = false;
      const result = await request('/api/characters', 'POST', [200, 201], (value, status): value is CharacterCreation => {
        if (!isCreation(value) || value.character.name !== body.name || value.character.presetId !== body.presetId || value.character.form !== body.form
          || (status === 201 && value.activeCharacterId !== value.character.id)) return false;
        created = status === 201;
        return true;
      }, JSON.stringify(body), token, signal);
      return result.kind === 'success' ? { kind: 'success', created, value: result.value } : result;
    },
    activate(token: string, characterId: string, signal?: AbortSignal): Promise<CharacterResult<CharacterList>> {
      if (!isUuid(characterId)) return Promise.resolve({ kind: 'invalid_request' });
      return request('/api/characters/active', 'PUT', 200, (value): value is CharacterList => isCharacterList(value) && value.activeCharacterId === characterId,
        JSON.stringify({ characterId }), token, signal);
    },
  };
}
export type CharacterClient = ReturnType<typeof createCharacterClient>;
