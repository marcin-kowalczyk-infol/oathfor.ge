<?php

declare(strict_types=1);

namespace App\Identity;

enum IdentityVerificationFailure
{
    case InvalidCredential;
    case Unavailable;
}
