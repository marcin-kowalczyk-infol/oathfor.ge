<?php

declare(strict_types=1);

namespace App\Identity;

enum ProfileFailure
{
    case Unauthenticated;
    case Unavailable;
    case Incomplete;
}
