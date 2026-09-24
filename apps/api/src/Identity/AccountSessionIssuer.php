<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class AccountSessionIssuer
{
    public function __construct(private Connection $connection, private Clock $clock, private RandomSource $random, private ProviderTokenCipher $cipher)
    {
    }

    /** The caller must roll back its transaction on any failure. */
    public function issue(AppleAuthorization $authorization, int $challengeExpiresAt): IssuedAppSession
    {
        if (!$this->connection->isTransactionActive()) {
            throw new \LogicException('Session issuance requires a caller-owned transaction.');
        }
        if ($authorization->identity->issuer !== 'https://appleid.apple.com' || '' === trim($authorization->identity->subject) || strlen($authorization->identity->subject) > 255) {
            throw new SessionIssuanceException(SessionIssuanceFailure::InvalidCredential);
        }
        $now = $this->clock->now();
        $identity = $this->connection->fetchAssociative('SELECT id, account_id FROM provider_identity WHERE issuer = ? AND subject = ?', [$authorization->identity->issuer, $authorization->identity->subject]);
        if (false === $identity) {
            $candidateAccount = $this->connection->fetchOne('INSERT INTO account (created_at) VALUES (?) RETURNING id', [$now]);
            $identity = $this->connection->fetchAssociative('INSERT INTO provider_identity (account_id, issuer, subject) VALUES (?, ?, ?) ON CONFLICT (issuer, subject) DO NOTHING RETURNING id, account_id', [$candidateAccount, $authorization->identity->issuer, $authorization->identity->subject]);
            if (false === $identity) {
                $this->connection->executeStatement('DELETE FROM account WHERE id = ?', [$candidateAccount]);
                $identity = $this->connection->fetchAssociative('SELECT id, account_id FROM provider_identity WHERE issuer = ? AND subject = ?', [$authorization->identity->issuer, $authorization->identity->subject]);
            }
        }
        if (false === $identity) {
            throw new SessionIssuanceException(SessionIssuanceFailure::Unavailable);
        }
        $accountId = $identity['account_id'];
        $identityId = $identity['id'];
        $account = $this->connection->fetchAssociative('SELECT status, onboarding_status FROM account WHERE id = ? FOR UPDATE', [$accountId]);
        if (false === $account) {
            throw new SessionIssuanceException(SessionIssuanceFailure::Unavailable);
        }
        if ($account['status'] !== 'active') {
            throw new SessionIssuanceException(SessionIssuanceFailure::InvalidCredential);
        }
        if ($this->clock->now() >= $challengeExpiresAt) {
            throw new SessionIssuanceException(SessionIssuanceFailure::ChallengeUnavailable);
        }
        $envelope = $this->cipher->encrypt($authorization->refreshToken, $identityId);
        if ($envelope instanceof ProviderTokenFailure) {
            throw new SessionIssuanceException(SessionIssuanceFailure::Unavailable);
        }
        $this->connection->executeStatement('UPDATE provider_identity SET refresh_envelope = ? WHERE id = ?', [json_encode($envelope, JSON_THROW_ON_ERROR), $identityId]);
        $token = rtrim(strtr(base64_encode($this->random->bytes(32)), '+/', '-_'), '=');
        $now = $this->clock->now();
        if ($now >= $challengeExpiresAt) {
            throw new SessionIssuanceException(SessionIssuanceFailure::ChallengeUnavailable);
        }
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', $token), 'account_id' => $accountId, 'issued_at' => $now, 'expires_at' => $now + 2592000]);
        return new IssuedAppSession(new AccountUser($accountId, $account['onboarding_status']), $token, $now + 2592000);
    }
}
