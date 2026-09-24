<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class AppleLoginService
{
    public function __construct(private Connection $connection, private LoginChallengeRepository $challenges, private AppleIdentityVerifier $verifier, private AppleAuthorizationExchange $exchange, private AccountSessionIssuer $sessions) {}

    public function login(string $challengeId, #[\SensitiveParameter] string $identityToken, #[\SensitiveParameter] string $authorizationCode): IssuedAppSession|AppleLoginFailure
    {
        try {
            $challenge = $this->challenges->findLive($challengeId);
            if (null === $challenge) {
                return AppleLoginFailure::ChallengeUnavailable;
            }
            $identity = $this->verifier->verify($identityToken, $challenge->nonceDigest);
            if ($identity instanceof IdentityVerificationFailure) {
                return $identity === IdentityVerificationFailure::InvalidCredential ? AppleLoginFailure::InvalidCredential : AppleLoginFailure::Unavailable;
            }
            $authorization = $this->exchange->exchange($authorizationCode, $identity, $challenge->nonceDigest);
            if ($authorization instanceof IdentityVerificationFailure) {
                return $authorization === IdentityVerificationFailure::InvalidCredential ? AppleLoginFailure::InvalidCredential : AppleLoginFailure::Unavailable;
            }
            return $this->connection->transactional(function () use ($challenge, $authorization): IssuedAppSession {
                $consumed = $this->challenges->consumeMatchingNonceDigest($challenge->id, $challenge->nonceDigest);
                if (ChallengeConsumption::Consumed !== $consumed) {
                    throw new SessionIssuanceException($consumed === ChallengeConsumption::InvalidNonce ? SessionIssuanceFailure::InvalidCredential : SessionIssuanceFailure::ChallengeUnavailable);
                }
                return $this->sessions->issue($authorization, $challenge->expiresAt);
            });
        } catch (SessionIssuanceException $failure) {
            return match ($failure->reason) {
                SessionIssuanceFailure::InvalidCredential => AppleLoginFailure::InvalidCredential,
                SessionIssuanceFailure::ChallengeUnavailable => AppleLoginFailure::ChallengeUnavailable,
                SessionIssuanceFailure::Unavailable => AppleLoginFailure::Unavailable,
            };
        } catch (\Doctrine\DBAL\Exception | \Random\RandomException) {
            return AppleLoginFailure::Unavailable;
        }
    }
}
