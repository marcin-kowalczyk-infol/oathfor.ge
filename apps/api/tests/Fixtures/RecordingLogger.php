<?php

declare(strict_types=1);
namespace App\Tests\Fixtures;

use Psr\Log\{AbstractLogger, LoggerInterface};

/** Test-only decorator of the framework logger. It keeps every record so tests can check what was logged, then forwards it. */
final class RecordingLogger extends AbstractLogger
{
    /** @var list<array{mixed, string, array<mixed>}> */
    public array $records = [];

    public function __construct(private LoggerInterface $inner) {}

    /** @param array<mixed> $context */
    public function log($level, string|\Stringable $message, array $context = []): void
    {
        $this->records[] = [$level, (string) $message, $context];
        $this->inner->log($level, $message, $context);
    }
}
