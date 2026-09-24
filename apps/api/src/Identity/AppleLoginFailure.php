<?php

declare(strict_types=1);

namespace App\Identity;

enum AppleLoginFailure
{
    case InvalidCredential;
    case ChallengeUnavailable;
    case Unavailable;
}
