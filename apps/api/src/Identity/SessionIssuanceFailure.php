<?php

declare(strict_types=1);

namespace App\Identity;

enum SessionIssuanceFailure
{
    case InvalidCredential;
    case ChallengeUnavailable;
    case Unavailable;
}
