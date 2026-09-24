<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class ProfileService
{
    private const COLUMNS = ['locale' => 'locale', 'timezone' => 'timezone', 'intention' => 'intention', 'companionIntroduced' => 'companion_introduced', 'notificationPreference' => 'notification_preference'];
    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private Clock $clock) {}

    /**
     * @phpstan-impure
     * @return array<string, mixed>|ProfileFailure
     */
    public function read(#[\SensitiveParameter] string $bearer): array|ProfileFailure { return $this->access($bearer, []); }

    /**
     * @phpstan-impure
     * @param array<string, mixed> $changes Validated partial choices.
     * @return array<string, mixed>|ProfileFailure
     */
    public function patch(#[\SensitiveParameter] string $bearer, array $changes): array|ProfileFailure
    {
        if (null !== ProfileInput::validate($changes)) { throw new \LogicException('Profile changes must be validated.'); }
        return $this->access($bearer, $changes);
    }

    /**
     * @phpstan-impure
     * @return array<string, mixed>|ProfileFailure
     */
    public function complete(#[\SensitiveParameter] string $bearer): array|ProfileFailure { return $this->access($bearer, [], true); }

    /**
     * @param array<string, mixed> $changes
     * @return array<string, mixed>|ProfileFailure
     */
    private function access(#[\SensitiveParameter] string $bearer, array $changes, bool $complete = false): array|ProfileFailure
    {
        try {
            $account = $this->sessions->findActive($bearer);
            if (null === $account) { return ProfileFailure::Unauthenticated; }
            return $this->connection->transactional(function () use ($account, $bearer, $changes, $complete): array|ProfileFailure {
                $row = $this->connection->fetchAssociative('SELECT status, onboarding_status FROM account WHERE id = ? FOR UPDATE', [$account->id]);
                $session = $this->connection->fetchAssociative('SELECT expires_at, revoked_at FROM app_session WHERE token_digest = ? AND account_id = ? FOR UPDATE', [hash('sha256', $bearer), $account->id]);
                if (false === $row || $row['status'] !== 'active' || false === $session || null !== $session['revoked_at'] || $this->clock->now() >= $session['expires_at']) { return ProfileFailure::Unauthenticated; }
                if ([] !== $changes) {
                    $this->connection->executeStatement('INSERT INTO account_profile (account_id) VALUES (?) ON CONFLICT (account_id) DO NOTHING', [$account->id]);
                    foreach ($changes as $field => $value) {
                        $column = self::COLUMNS[$field] ?? throw new \LogicException('Profile changes must be validated.');
                        $this->connection->executeStatement('UPDATE account_profile SET '.$column.' = ? WHERE account_id = ?', [$value, $account->id], ['companionIntroduced' === $field ? \Doctrine\DBAL\ParameterType::BOOLEAN : \Doctrine\DBAL\ParameterType::STRING, \Doctrine\DBAL\ParameterType::STRING]);
                    }
                }
                $profile = $this->connection->fetchAssociative('SELECT locale, timezone, intention, companion_introduced, notification_preference FROM account_profile WHERE account_id = ?', [$account->id]);
                $result = $this->defaults();
                if (false !== $profile) {
                    foreach (self::COLUMNS as $field => $column) { $result['profile'][$field] = $profile[$column]; }
                }
                $result['onboardingStatus'] = $row['onboarding_status'];
                if ($complete && $row['onboarding_status'] !== 'complete') {
                    if (null !== ProfileInput::validate($result['profile'])) { return ProfileFailure::Incomplete; }
                    $this->connection->executeStatement("UPDATE account SET onboarding_status = 'complete' WHERE id = ?", [$account->id]);
                    $result['onboardingStatus'] = 'complete';
                }
                return $result;
            });
        } catch (\Doctrine\DBAL\Exception) { return ProfileFailure::Unavailable; }
    }

    /** @return array{profile: array<string, mixed>, onboardingStatus: string} */
    private function defaults(): array { return ['profile' => ['locale' => null, 'timezone' => null, 'intention' => null, 'companionIntroduced' => false, 'notificationPreference' => null], 'onboardingStatus' => 'pending']; }
}
