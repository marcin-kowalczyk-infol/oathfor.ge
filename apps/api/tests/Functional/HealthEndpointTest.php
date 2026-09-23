<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class HealthEndpointTest extends WebTestCase
{
    public function testPublicLivenessReturnsOnlyStatusWithoutInfrastructure(): void
    {
        $client = self::createClient();
        $client->request('GET', '/api/health');

        self::assertResponseStatusCodeSame(200);
        self::assertResponseHeaderSame('content-type', 'application/json');
        self::assertSame(
            ['status' => 'ok'],
            json_decode((string) $client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR),
        );
    }
}
