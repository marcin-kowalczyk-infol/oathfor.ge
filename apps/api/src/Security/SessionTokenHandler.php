<?php

declare(strict_types=1);

namespace App\Security;

use App\Identity\AppSessionRepository;
use Doctrine\DBAL\Exception;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

final class SessionTokenHandler implements AccessTokenHandlerInterface
{
    public function __construct(private readonly AppSessionRepository $sessions)
    {
    }

    public function getUserBadgeFrom(#[\SensitiveParameter] string $accessToken): UserBadge
    {
        try {
            $account = $this->sessions->findActive($accessToken);
        } catch (Exception) {
            // Do not chain database exceptions: security logging must never expose SQL or credentials.
            throw new SessionAuthenticationUnavailable();
        }
        if (null === $account) {
            throw new BadCredentialsException('Invalid session.');
        }
        return new UserBadge($account->id, static fn () => $account);
    }
}
