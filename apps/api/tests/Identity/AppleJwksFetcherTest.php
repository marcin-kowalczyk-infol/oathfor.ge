<?php

declare(strict_types=1);

namespace App\Tests\Identity;

use App\Identity\AppleJwksFetcher;
use App\Identity\AppleKeysUnavailable;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AppleJwksFetcherTest extends TestCase
{
    public function testOnlyTrustedUrlWithBoundedTlsRequestAndNoRedirects(): void
    {
        $response = new MockResponse('{"keys":[]}');
        $client = new MockHttpClient(function (string $method, string $url, array $options) use ($response): MockResponse {
            self::assertSame('GET', $method);
            self::assertSame('https://appleid.apple.com/auth/keys', $url);
            self::assertSame(2.0, $options['timeout']);
            self::assertSame(5.0, $options['max_duration']);
            self::assertSame(0, $options['max_redirects']);
            self::assertTrue($options['verify_peer']);
            self::assertTrue($options['verify_host']);
            self::assertFalse($options['buffer']);
            return $response;
        });
        self::assertSame(['keys' => []], (new AppleJwksFetcher($client))->fetch());
        self::assertSame(1, $client->getRequestsCount());
    }

    public function testResponseSizeStatusMalformedAndTimeoutFailuresAreUnavailable(): void
    {
        $responses = [
            'oversized' => new MockResponse(str_repeat('x', 65537)),
            'redirect' => new MockResponse('', ['http_code' => 302, 'response_headers' => ['location: https://attacker.invalid']]),
            'server failure' => new MockResponse('', ['http_code' => 503]),
            'malformed' => new MockResponse('{'),
            'scalar' => new MockResponse('null'),
            'idle timeout' => new MockResponse((function (): \Generator { yield ''; })()),
        ];
        foreach ($responses as $name => $response) {
            $client = new MockHttpClient($response);
            try {
                (new AppleJwksFetcher($client))->fetch();
                self::fail('Accepted '.$name);
            } catch (AppleKeysUnavailable $failure) {
                self::assertSame('', $failure->getMessage());
                self::assertSame(1, $client->getRequestsCount());
            }
        }
        $body = '{"keys":[]}'.str_repeat(' ', 65536 - strlen('{"keys":[]}'));
        self::assertSame(['keys' => []], (new AppleJwksFetcher(new MockHttpClient(new MockResponse($body))))->fetch());
    }
}
