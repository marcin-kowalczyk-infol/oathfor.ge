<?php

declare(strict_types=1);

namespace App\Security;

use Symfony\Component\Security\Core\Exception\AuthenticationException;

final class SessionAuthenticationUnavailable extends AuthenticationException
{
    public function __construct()
    {
        parent::__construct('Session authentication is temporarily unavailable.');
    }
}
