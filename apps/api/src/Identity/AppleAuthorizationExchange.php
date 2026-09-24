<?php

declare(strict_types=1);

namespace App\Identity;

use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class AppleAuthorizationExchange
{
    public function __construct(private AppleClientSecretSigner $signer, private AppleIdentityVerifier $verifier, private HttpClientInterface $httpClient)
    {
    }

    /** Native identity and nonce digest must come from verified server-side boundaries. */
    public function exchange(#[\SensitiveParameter] string $authorizationCode, VerifiedAppleIdentity $nativeIdentity, string $expectedNonceDigest): AppleAuthorization|IdentityVerificationFailure
    {
        if ('' === trim($authorizationCode) || strlen($authorizationCode) > 2048
            || $nativeIdentity->issuer !== 'https://appleid.apple.com' || '' === trim($nativeIdentity->subject) || strlen($nativeIdentity->subject) > 255
            || 1 !== preg_match('/^[a-f0-9]{64}$/D', $expectedNonceDigest)) {
            return IdentityVerificationFailure::InvalidCredential;
        }
        $secret = $this->signer->sign();
        if ($secret instanceof IdentityVerificationFailure) {
            return $secret;
        }
        $response = null;
        try {
            $response = $this->httpClient->request('POST', 'https://appleid.apple.com/auth/token', [
                'timeout' => 2.0, 'max_duration' => 5.0, 'max_redirects' => 0,
                'verify_peer' => true, 'verify_host' => true, 'buffer' => false,
                'headers' => ['Content-Type' => 'application/x-www-form-urlencoded'],
                'body' => ['client_id' => $secret->clientId, 'client_secret' => $secret->token, 'code' => $authorizationCode, 'grant_type' => 'authorization_code'],
            ]);
            $status = $response->getStatusCode();
            if (!in_array($status, [200, 400], true)) {
                return IdentityVerificationFailure::Unavailable;
            }
            $body = '';
            foreach ($this->httpClient->stream($response, 2.0) as $chunk) {
                if ($chunk->isTimeout()) {
                    return IdentityVerificationFailure::Unavailable;
                }
                $content = $chunk->getContent();
                if (strlen($body) + strlen($content) > 65536) {
                    return IdentityVerificationFailure::Unavailable;
                }
                $body .= $content;
            }
            $data = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($data) || array_is_list($data)) {
                return IdentityVerificationFailure::Unavailable;
            }
            if (400 === $status) {
                return ($data['error'] ?? null) === 'invalid_grant' ? IdentityVerificationFailure::InvalidCredential : IdentityVerificationFailure::Unavailable;
            }
            if (array_key_exists('error', $data) || !is_string($data['id_token'] ?? null) || '' === trim($data['id_token'])
                || !is_string($data['refresh_token'] ?? null) || '' === trim($data['refresh_token'])) {
                return IdentityVerificationFailure::Unavailable;
            }
            $identity = $this->verifier->verify($data['id_token'], $expectedNonceDigest);
            if ($identity instanceof IdentityVerificationFailure) {
                return $identity;
            }
            if ($identity->issuer !== $nativeIdentity->issuer || $identity->subject !== $nativeIdentity->subject) {
                return IdentityVerificationFailure::InvalidCredential;
            }
            return new AppleAuthorization($identity, $data['refresh_token']);
        } catch (ExceptionInterface | \JsonException) {
            return IdentityVerificationFailure::Unavailable;
        } finally {
            $response?->cancel();
        }
    }
}
