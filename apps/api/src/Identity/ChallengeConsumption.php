<?php

declare(strict_types=1);

namespace App\Identity;

enum ChallengeConsumption
{
    case Consumed;
    case Unavailable;
    case InvalidNonce;
}
