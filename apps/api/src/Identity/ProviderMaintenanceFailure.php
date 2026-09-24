<?php

declare(strict_types=1);

namespace App\Identity;

enum ProviderMaintenanceFailure
{
    case InvalidGrant;
    case Unavailable;
}
