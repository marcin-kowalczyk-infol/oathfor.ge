<?php

declare(strict_types=1);

namespace App\Tests\Oath;

use App\Oath\RuleCatalog;
use PHPUnit\Framework\TestCase;

final class RuleCatalogTest extends TestCase
{
    public function testRunningPreviewContainsBothEvidenceRoutesAndEquivalentRewardTerms(): void
    {
        $deadline = ['local' => '2026-09-24T20:00:00', 'timezone' => 'Europe/Warsaw', 'offset' => '+02:00', 'explicitOffset' => false, 'utc' => '2026-09-24T18:00:00Z', 'receiptCutoff' => '2026-09-24T18:15:00Z'];
        $snapshot = (new RuleCatalog())->snapshot('running', ['mode' => 'now', 'time' => null], $deadline);
        self::assertSame($deadline, $snapshot['deadline']);
        self::assertSame('workout_oath_v1', $snapshot['templateVersion']);
        self::assertSame('workout_rewards_v1', $snapshot['policyVersion']);
        self::assertSame(['photo', 'activity_record'], $snapshot['evidence']['alternatives']);
        self::assertTrue($snapshot['evidence']['declarationRequired']);
        self::assertSame(40, $snapshot['rewards']['photoTotal']);
        self::assertSame(50, $snapshot['rewards']['recordTotal']);
        self::assertSame(0, $snapshot['consequences']['existingXpLoss']);
        self::assertSame(15, $snapshot['recovery']['totalXp']);
        self::assertSame('Bieganie', $snapshot['copy']['pl']['activity']);
        self::assertSame('Running', $snapshot['copy']['en']['activity']);
        self::assertSame('I confirm that I completed the workout named in this Oath. The proof I submit is from that workout.', $snapshot['copy']['en']['declaration']);
        foreach (['pl', 'en'] as $locale) {
            self::assertStringContainsString('40', $snapshot['copy'][$locale]['sections']['rewards']);
            self::assertStringContainsString('50', $snapshot['copy'][$locale]['sections']['rewards']);
            self::assertStringContainsString('15', $snapshot['copy'][$locale]['sections']['recovery']);
        }
        $snapshot['rewards']['photoTotal'] = 999;
        self::assertSame(40, (new RuleCatalog())->snapshot('running', ['mode' => 'now', 'time' => null], $deadline)['rewards']['photoTotal']);
    }
}
