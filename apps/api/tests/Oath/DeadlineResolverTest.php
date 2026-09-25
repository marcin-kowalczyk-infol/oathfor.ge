<?php

declare(strict_types=1);

namespace App\Tests\Oath;

use App\Oath\DeadlineResolver;
use App\Oath\TimeFailure;
use App\Oath\ResolvedDeadline;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class DeadlineResolverTest extends TestCase
{
    public function testNonexistentWarsawTimeIsRejectedWithoutShifting(): void
    {
        $result = (new DeadlineResolver())->resolve(['local' => '2026-03-29T02:30:00', 'timezone' => 'Europe/Warsaw']);
        self::assertInstanceOf(TimeFailure::class, $result);
        self::assertSame('nonexistent_local_time', $result->code);
    }

    public function testOrdinaryDeadlineRetainsCommittedZoneAndElapsedReceiptWindow(): void
    {
        $input = ['local' => '2026-09-24T20:00:00', 'timezone' => 'Europe/Warsaw'];
        $result = (new DeadlineResolver())->resolve($input);
        self::assertInstanceOf(ResolvedDeadline::class, $result);
        $input['timezone'] = 'UTC';
        self::assertSame([
            'local' => '2026-09-24T20:00:00', 'timezone' => 'Europe/Warsaw',
            'offset' => '+02:00', 'explicitOffset' => false, 'utc' => '2026-09-24T18:00:00Z',
            'receiptCutoff' => '2026-09-24T18:15:00Z',
        ], $result->toArray());
    }

    public function testRepeatedTimeRequiresExplicitOccurrence(): void
    {
        $result = (new DeadlineResolver())->resolve(['local' => '2026-10-25T02:30:00', 'timezone' => 'Europe/Warsaw']);
        self::assertInstanceOf(TimeFailure::class, $result);
        self::assertSame('ambiguous_local_time', $result->code);
        self::assertSame(['+02:00', '+01:00'], $result->validOffsets);
    }

    #[DataProvider('occurrences')]
    public function testExplicitOccurrencesAndUtc(string $local, string $zone, string $offset, string $utc, string $cutoff): void
    {
        $result = (new DeadlineResolver())->resolve(['local' => $local, 'timezone' => $zone, 'offset' => $offset]);
        self::assertInstanceOf(ResolvedDeadline::class, $result);
        self::assertSame($utc, $result->toArray()['utc']);
        self::assertSame($cutoff, $result->toArray()['receiptCutoff']);
        self::assertTrue($result->toArray()['explicitOffset']);
    }

    /** @return iterable<string, array{string, string, string, string, string}> */
    public static function occurrences(): iterable
    {
        yield 'first occurrence' => ['2026-10-25T02:30:00', 'Europe/Warsaw', '+02:00', '2026-10-25T00:30:00Z', '2026-10-25T00:45:00Z'];
        yield 'second occurrence' => ['2026-10-25T02:30:00', 'Europe/Warsaw', '+01:00', '2026-10-25T01:30:00Z', '2026-10-25T01:45:00Z'];
        yield 'receipt across DST change' => ['2026-10-25T02:55:00', 'Europe/Warsaw', '+02:00', '2026-10-25T00:55:00Z', '2026-10-25T01:10:00Z'];
        yield 'explicit supported historical occurrence' => ['1911-03-10T23:55:00', 'Europe/Paris', '+00:00', '1911-03-10T23:55:00Z', '1911-03-11T00:10:00Z'];
        yield 'UTC' => ['2026-09-24T20:00:00', 'UTC', '+00:00', '2026-09-24T20:00:00Z', '2026-09-24T20:15:00Z'];
    }

    /** @param array<string, mixed> $input */
    #[DataProvider('invalidInputs')]
    public function testInvalidInputIsNotNormalized(array $input, string $code): void
    {
        $result = (new DeadlineResolver())->resolve($input);
        self::assertInstanceOf(TimeFailure::class, $result);
        self::assertSame($code, $result->code);
    }

    /** @return iterable<string, array{array<string, mixed>, string}> */
    public static function invalidInputs(): iterable
    {
        $base = ['local' => '2026-09-24T20:00:00', 'timezone' => 'Europe/Warsaw'];
        yield 'unknown field' => [$base + ['utc' => '2026-09-24T00:00:00Z'], 'invalid_request'];
        yield 'missing field' => [['local' => $base['local']], 'invalid_request'];
        yield 'wrong type' => [array_replace($base, ['local' => 123]), 'invalid_request'];
        yield 'invalid calendar' => [array_replace($base, ['local' => '2026-02-30T20:00:00']), 'invalid_local_time'];
        yield 'space separator' => [array_replace($base, ['local' => '2026-09-24 20:00:00']), 'invalid_local_time'];
        yield 'normalized hour' => [array_replace($base, ['local' => '2026-09-24T24:00:00']), 'invalid_local_time'];
        yield 'year zero' => [array_replace($base, ['local' => '0000-09-24T20:00:00']), 'invalid_local_time'];
        yield 'unsupported zone' => [array_replace($base, ['timezone' => '+02:00']), 'invalid_timezone'];
        yield 'offset syntax' => [$base + ['offset' => '+0200'], 'invalid_offset'];
        yield 'negative zero' => [$base + ['offset' => '-00:00'], 'invalid_offset'];
        yield 'wrong valid-format offset' => [$base + ['offset' => '+01:00'], 'offset_mismatch'];
        yield 'historic seconds' => [array_replace($base, ['local' => '1900-01-01T12:00:00', 'timezone' => 'Europe/Paris']), 'unsupported_time_offset'];
        yield 'cutoff beyond wire range' => [['local' => '9999-12-31T23:55:00', 'timezone' => 'UTC'], 'invalid_local_time'];
    }
}
