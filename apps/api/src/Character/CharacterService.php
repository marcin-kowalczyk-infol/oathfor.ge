<?php

declare(strict_types=1);
namespace App\Character;

use App\Identity\{AppSessionRepository, Clock};
use Doctrine\DBAL\Connection;

final class CharacterService
{
    public const LIMIT = 3;
    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private Clock $clock, private PresetCatalog $presets) {}

    /**
     * @phpstan-impure
     * @return array<string, mixed>|CharacterFailure
     */
    public function list(#[\SensitiveParameter] string $bearer): array|CharacterFailure
    {
        $result = $this->locked($bearer, fn (string $accountId, array $account, int $now): array => $this->listing($accountId, $account['active_character_id'], $now));
        return $result instanceof CharacterResult ? $result->body : $result;
    }

    /**
     * Makes an own character active. Writes only account.active_character_id, and nothing when it is already active.
     * @phpstan-impure
     * @return array<string, mixed>|CharacterFailure
     */
    public function activate(#[\SensitiveParameter] string $bearer, SwitchInput $input): array|CharacterFailure
    {
        $result = $this->locked($bearer, function (string $accountId, array $account, int $now) use ($input): array|CharacterFailure {
            if (false === $this->connection->fetchOne('SELECT id FROM player_character WHERE account_id = ? AND id = ?', [$accountId, $input->characterId])) { return new CharacterFailure('not_found', 404); }
            if ($account['active_character_id'] !== $input->characterId) { $this->connection->executeStatement('UPDATE account SET active_character_id = ? WHERE id = ?', [$input->characterId, $accountId]); }
            return $this->listing($accountId, $input->characterId, $now);
        });
        return $result instanceof CharacterResult ? $result->body : $result;
    }

    /** @phpstan-impure */
    public function create(#[\SensitiveParameter] string $bearer, CharacterInput $input): CharacterResult|CharacterFailure
    {
        return $this->locked($bearer, function (string $accountId, array $account, int $now) use ($input): CharacterResult|CharacterFailure {
            $existing = $this->connection->fetchAssociative('SELECT id, name, preset_id, form, created_at FROM player_character WHERE account_id = ? AND creation_request_id = ?', [$accountId, $input->requestId]);
            if (false !== $existing) {
                if ([$existing['name'], $existing['preset_id'], $existing['form']] !== [$input->name, $input->presetId, $input->form]) { return new CharacterFailure('idempotency_conflict', 409); }
                return new CharacterResult(['character' => self::character($existing), 'activeCharacterId' => $account['active_character_id'], 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now)], false);
            }
            if (!$this->presets->contains($input->presetId)) { return new CharacterFailure('invalid_preset'); }
            if ('complete' !== $account['onboarding_status']) { return new CharacterFailure('onboarding_incomplete', 409); }
            $count = (int) $this->connection->fetchOne('SELECT COUNT(*) FROM player_character WHERE account_id = ?', [$accountId]);
            if ($count >= self::LIMIT) { return new CharacterFailure('character_limit_reached', 409); }
            $row = $this->connection->fetchAssociative('INSERT INTO player_character (account_id, slot, creation_request_id, name, preset_id, form, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, name, preset_id, form, created_at', [$accountId, $count + 1, $input->requestId, $input->name, $input->presetId, $input->form, $now]);
            if (false === $row) { throw new \LogicException('Created character missing.'); }
            $this->connection->executeStatement('UPDATE account SET active_character_id = ? WHERE id = ?', [$row['id'], $accountId]);
            return new CharacterResult(['character' => self::character($row), 'activeCharacterId' => $row['id'], 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now)], true);
        });
    }

    /**
     * Locks the account, then the session, and rechecks authorization at the fresh clock time.
     * @param \Closure(string, array<string, mixed>, int): (array<string, mixed>|CharacterResult|CharacterFailure) $operation
     */
    private function locked(#[\SensitiveParameter] string $bearer, \Closure $operation): CharacterResult|CharacterFailure
    {
        try {
            $user = $this->sessions->findActive($bearer);
            if (null === $user) { return new CharacterFailure('unauthenticated', 401); }
            return $this->connection->transactional(function () use ($user, $bearer, $operation): CharacterResult|CharacterFailure {
                $account = $this->connection->fetchAssociative('SELECT status, onboarding_status, active_character_id FROM account WHERE id = ? FOR UPDATE', [$user->id]);
                $session = $this->connection->fetchAssociative('SELECT expires_at, revoked_at FROM app_session WHERE token_digest = ? AND account_id = ? FOR UPDATE', [hash('sha256', $bearer), $user->id]);
                $now = $this->clock->now();
                if (false === $account || 'active' !== $account['status'] || false === $session || null !== $session['revoked_at'] || $now >= $session['expires_at']) { return new CharacterFailure('unauthenticated', 401); }
                $result = $operation($user->id, $account, $now);
                return is_array($result) ? new CharacterResult($result, false) : $result;
            });
        } catch (\Doctrine\DBAL\Exception) { return new CharacterFailure('temporarily_unavailable', 503); }
    }

    /** @return array<string, mixed> */
    private function listing(string $accountId, ?string $activeId, int $now): array
    {
        $rows = $this->connection->fetchAllAssociative('SELECT id, name, preset_id, form, created_at FROM player_character WHERE account_id = ? ORDER BY slot', [$accountId]);
        return ['characters' => array_map(self::character(...), $rows), 'activeCharacterId' => $activeId, 'limit' => self::LIMIT, 'presets' => $this->presets->ids(), 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now)];
    }

    /**
     * @param array<string, mixed> $row
     * @return array{id: string, name: string, presetId: string, form: string, createdAt: string}
     */
    private static function character(array $row): array
    {
        return ['id' => $row['id'], 'name' => $row['name'], 'presetId' => $row['preset_id'], 'form' => $row['form'], 'createdAt' => gmdate('Y-m-d\TH:i:s\Z', (int) $row['created_at'])];
    }
}
