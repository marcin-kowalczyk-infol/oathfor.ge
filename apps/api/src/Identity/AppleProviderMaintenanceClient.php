<?php

declare(strict_types=1);

namespace App\Identity;

use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class AppleProviderMaintenanceClient implements ProviderMaintenanceClient
{
    public function __construct(private AppleClientSecretSigner $signer, private AppleIdentityVerifier $verifier, private HttpClientInterface $httpClient)
    {
    }

    public function refresh(#[\SensitiveParameter] string $refreshToken, VerifiedAppleIdentity $storedIdentity): ProviderRefreshResult|ProviderMaintenanceFailure
    {
        if ($storedIdentity->issuer !== 'https://appleid.apple.com' || '' === trim($storedIdentity->subject) || strlen($storedIdentity->subject) > 255) {
            return ProviderMaintenanceFailure::Unavailable;
        }
        $response = $this->request($refreshToken, false);
        if (null === $response) {
            return ProviderMaintenanceFailure::Unavailable;
        }
        [$status, $body] = $response;
        if (!in_array($status, [200, 400], true)) {
            return ProviderMaintenanceFailure::Unavailable;
        }
        try {
            $data = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return ProviderMaintenanceFailure::Unavailable;
        }
        if (!is_array($data) || array_is_list($data)) {
            return ProviderMaintenanceFailure::Unavailable;
        }
        if (400 === $status) {
            return ($data['error'] ?? null) === 'invalid_grant' ? ProviderMaintenanceFailure::InvalidGrant : ProviderMaintenanceFailure::Unavailable;
        }
        if (array_key_exists('error', $data) || !is_string($data['id_token'] ?? null) || '' === trim($data['id_token'])
            || (array_key_exists('refresh_token', $data) && (!is_string($data['refresh_token']) || '' === trim($data['refresh_token'])))) {
            return ProviderMaintenanceFailure::Unavailable;
        }
        if ($this->verifier->verifyRefresh($data['id_token'], $storedIdentity) instanceof IdentityVerificationFailure) {
            return ProviderMaintenanceFailure::Unavailable;
        }
        return new ProviderRefreshResult($data['refresh_token'] ?? null);
    }

    public function revoke(#[\SensitiveParameter] string $refreshToken): bool
    {
        $response = $this->request($refreshToken, true);
        return null !== $response && 200 === $response[0];
    }

    /** @return array{int, string}|null */
    private function request(#[\SensitiveParameter] string $refreshToken, bool $revoke): ?array
    {
        if ('' === trim($refreshToken)) {
            return null;
        }
        $secret = $this->signer->sign();
        if ($secret instanceof IdentityVerificationFailure) {
            return null;
        }
        $response = null;
        try {
            $response = $this->httpClient->request('POST', $revoke ? 'https://appleid.apple.com/auth/revoke' : 'https://appleid.apple.com/auth/token', [
                'timeout' => 2.0, 'max_duration' => 5.0, 'max_redirects' => 0,
                'verify_peer' => true, 'verify_host' => true, 'buffer' => false,
                'headers' => ['Content-Type' => 'application/x-www-form-urlencoded'],
                'body' => ['client_id' => $secret->clientId, 'client_secret' => $secret->token] + ($revoke
                    ? ['token' => $refreshToken, 'token_type_hint' => 'refresh_token']
                    : ['refresh_token' => $refreshToken, 'grant_type' => 'refresh_token']),
            ]);
            $status = $response->getStatusCode();
            if (!in_array($status, [200, 400], true)) {
                return [$status, ''];
            }
            $body = '';
            foreach ($this->httpClient->stream($response, 2.0) as $chunk) {
                if ($chunk->isTimeout()) {
                    return null;
                }
                $content = $chunk->getContent();
                if (strlen($body) + strlen($content) > 65536) {
                    return null;
                }
                $body .= $content;
            }
            return [$status, $body];
        } catch (ExceptionInterface) {
            return null;
        } finally {
            $response?->cancel();
        }
    }
}
