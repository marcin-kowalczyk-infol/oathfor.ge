<?php

declare(strict_types=1);

namespace App\Identity;

use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class AppleJwksFetcher
{
    public function __construct(private HttpClientInterface $httpClient)
    {
    }

    /** @return array<string, mixed> */
    public function fetch(): array
    {
        $response = null;
        try {
            $response = $this->httpClient->request('GET', 'https://appleid.apple.com/auth/keys', [
                'timeout' => 2.0, 'max_duration' => 5.0, 'max_redirects' => 0,
                'verify_peer' => true, 'verify_host' => true, 'buffer' => false,
            ]);
            if (200 !== $response->getStatusCode()) {
                throw new AppleKeysUnavailable();
            }
            $body = '';
            foreach ($this->httpClient->stream($response, 2.0) as $chunk) {
                if ($chunk->isTimeout()) {
                    throw new AppleKeysUnavailable();
                }
                $content = $chunk->getContent();
                if (strlen($body) + strlen($content) > 65536) {
                    throw new AppleKeysUnavailable();
                }
                $body .= $content;
            }
            $snapshot = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($snapshot) || array_is_list($snapshot)) {
                throw new AppleKeysUnavailable();
            }
            return $snapshot;
        } catch (ExceptionInterface | \JsonException) {
            throw new AppleKeysUnavailable();
        } finally {
            $response?->cancel();
        }
    }
}
