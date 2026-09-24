<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class IdentityMaintenance
{
    public function __construct(private Connection $connection, private Clock $clock, private ProviderTokenCipher $cipher, private ProviderMaintenanceClient $provider) {}

    public function run(int $limit = 100): int
    {
        if ($limit < 1 || $limit > 1000 || $this->connection->isTransactionActive()) {
            throw new \LogicException('Maintenance requires a bounded batch outside a transaction.');
        }
        $now = $this->clock->now();
        $ids = $this->connection->fetchFirstColumn("SELECT p.id FROM provider_identity p JOIN account a ON a.id = p.account_id WHERE p.refresh_envelope IS NOT NULL AND ((a.status <> 'active' AND a.deletion_requested_at IS NOT NULL AND (a.deletion_requested_at <= ? OR (p.revocation_status = 'pending' AND p.revocation_due_at <= ?))) OR (a.status = 'active' AND p.validation_due_at <= ? AND EXISTS (SELECT 1 FROM app_session s WHERE s.account_id = a.id AND s.revoked_at IS NULL AND s.expires_at > ?))) ORDER BY a.deletion_requested_at NULLS LAST, p.id LIMIT ".$limit, [$now - 604800, $now, $now, $now]);
        $processed = 0;
        foreach ($ids as $id) {
            $claim = $this->connection->transactional(function () use ($id): ?array {
                $row = $this->lock($id);
                $now = $this->clock->now();
                if (null === $row || null === $row['refresh_envelope']) { return null; }
                if ($this->purgeIfExpired($row, $now)) {
                    $row['mode'] = 'purged';
                    return $row;
                }
                if ($row['status'] !== 'active') {
                    if (null === $row['deletion_requested_at'] || $row['revocation_status'] !== 'pending' || null === $row['revocation_due_at'] || $row['revocation_due_at'] > $now) { return null; }
                    $row['mode'] = 'revoke';
                } else {
                    if (null === $row['validation_due_at'] || $row['validation_due_at'] > $now || !$this->connection->fetchOne('SELECT 1 FROM app_session WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1', [$row['account_id'], $now])) { return null; }
                    $row['mode'] = 'refresh';
                }
                $claim = $this->connection->fetchOne('SELECT gen_random_uuid()');
                $column = $row['mode'] === 'revoke' ? 'revocation_due_at' : 'validation_due_at';
                $delay = $row['mode'] === 'revoke' ? 900 : 86400;
                $this->connection->executeStatement('UPDATE provider_identity SET '.$column.' = ?, maintenance_claim = ? WHERE id = ?', [$now + $delay, $claim, $id]);
                $row['maintenance_claim'] = $claim;
                return $row;
            });
            if (null === $claim) { continue; }
            ++$processed;
            if ($claim['mode'] === 'purged') { continue; }
            $token = $this->decrypt($claim);
            $result = null === $token ? ProviderMaintenanceFailure::Unavailable : ($claim['mode'] === 'revoke' ? $this->provider->revoke($token) : $this->provider->refresh($token, new VerifiedAppleIdentity($claim['issuer'], $claim['subject'])));
            $this->connection->transactional(function () use ($claim, $result): void {
                $row = $this->lock($claim['id']);
                if (null !== $row && $this->purgeIfExpired($row, $this->clock->now())) { return; }
                if (null === $row || $row['status'] !== $claim['status'] || $row['credential_generation'] !== $claim['credential_generation'] || $row['maintenance_claim'] !== $claim['maintenance_claim']) { return; }
                $outcome = 'unavailable';
                if ($claim['mode'] === 'revoke') {
                    if (true === $result) {
                        $this->connection->executeStatement("UPDATE provider_identity SET refresh_envelope = NULL, revocation_status = 'confirmed', revocation_due_at = NULL WHERE id = ?", [$row['id']]);
                        $outcome = 'revoked';
                    }
                } elseif ($result === ProviderMaintenanceFailure::InvalidGrant) {
                    $this->connection->executeStatement('UPDATE app_session SET revoked_at = COALESCE(revoked_at, ?) WHERE account_id = ?', [$this->clock->now(), $row['account_id']]);
                    $outcome = 'invalid_grant';
                } elseif ($result instanceof ProviderRefreshResult) {
                    $outcome = 'valid';
                    if (null !== $result->refreshToken) {
                        $envelope = $this->cipher->encrypt($result->refreshToken, $row['id']);
                        if ($envelope instanceof ProviderTokenFailure) {
                            $outcome = 'unavailable';
                        } else {
                            $this->connection->executeStatement('UPDATE provider_identity SET refresh_envelope = ?, credential_generation = credential_generation + 1 WHERE id = ?', [json_encode($envelope, JSON_THROW_ON_ERROR), $row['id']]);
                        }
                    }
                }
                $this->connection->executeStatement('UPDATE provider_identity SET maintenance_claim = NULL, maintenance_outcome = ? WHERE id = ?', [$outcome, $row['id']]);
            });
        }
        return $processed;
    }

    /** @param array<string, mixed> $row */
    private function purgeIfExpired(array $row, int $now): bool
    {
        if ($row['status'] === 'active' || null === $row['deletion_requested_at'] || $now < $row['deletion_requested_at'] + 604800 || null === $row['refresh_envelope']) { return false; }
        $this->connection->executeStatement("UPDATE provider_identity SET refresh_envelope = NULL, revocation_status = 'unresolved', revocation_due_at = NULL, maintenance_claim = NULL, maintenance_outcome = 'revocation_unresolved' WHERE id = ?", [$row['id']]);
        return true;
    }

    /**
     * Account lock always precedes identity lock.
     * @return array<string, mixed>|null
     */
    private function lock(string $id): ?array
    {
        $accountId = $this->connection->fetchOne('SELECT account_id FROM provider_identity WHERE id = ?', [$id]);
        if (false === $accountId) { return null; }
        $account = $this->connection->fetchAssociative('SELECT status, deletion_requested_at FROM account WHERE id = ? FOR UPDATE', [$accountId]);
        if (false === $account) { return null; }
        $identity = $this->connection->fetchAssociative('SELECT * FROM provider_identity WHERE id = ? FOR UPDATE', [$id]);
        return false === $identity ? null : array_merge($identity, $account);
    }

    /** @param array<string, mixed> $row */
    private function decrypt(array $row): ?string
    {
        try {
            $data = json_decode($row['refresh_envelope'], true, 8, JSON_THROW_ON_ERROR);
            if (!is_array($data) || !is_int($data['version'] ?? null) || !is_string($data['keyId'] ?? null) || !is_string($data['nonce'] ?? null) || !is_string($data['ciphertext'] ?? null)) { return null; }
            $token = $this->cipher->decrypt(new EncryptedProviderToken($data['version'], $data['keyId'], $data['nonce'], $data['ciphertext']), $row['id']);
            return is_string($token) ? $token : null;
        } catch (\JsonException) { return null; }
    }
}
