<?php

declare(strict_types=1);

namespace App\Identity;

enum ProviderTokenFailure
{
    case Invalid;
    case Unavailable;
}
