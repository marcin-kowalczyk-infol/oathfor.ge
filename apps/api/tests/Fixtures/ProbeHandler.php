<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class ProbeHandler
{
    public function __invoke(ProbeMessage $message): void
    {
        if (!preg_match('/^[a-f0-9]{24}$/D', $message->id)) {
            throw new \InvalidArgumentException('Invalid synthetic ID.');
        }
        $path = dirname(__DIR__, 2).'/var/probe-'.$message->id;
        file_put_contents($path.'.attempts', "attempt\n", FILE_APPEND);
        if ($message->fail) {
            throw new \RuntimeException('SYNTHETIC_FAILURE');
        }
        file_put_contents($path.'.done', 'handled');
    }
}
