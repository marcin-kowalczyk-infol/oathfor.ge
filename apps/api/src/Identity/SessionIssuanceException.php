<?php

declare(strict_types=1);

namespace App\Identity;

final class SessionIssuanceException extends \RuntimeException
{
    public function __construct(public readonly SessionIssuanceFailure $reason)
    {
        parent::__construct('Session issuance failed.');
    }
}
