<?php

declare(strict_types=1);

namespace App\Controller;

use App\Identity\AppleLoginFailure;
use App\Identity\AppleLoginService;
use App\Identity\AuthenticationRateLimiter;
use App\Identity\IssuedAppSession;
use Doctrine\DBAL\Exception;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class AppleExchangeController
{
    #[Route('/api/auth/apple/exchange', name: 'apple_exchange', methods: ['POST'])]
    public function __invoke(Request $request, AppleLoginService $login, AuthenticationRateLimiter $limiter): JsonResponse
    {
        try {
            $retry = $limiter->attempt('apple_exchange', $request->getClientIp() ?? 'unknown');
            if ($retry > 0) {
                $response = $this->error('rate_limited', 429);
                $response->headers->set('Retry-After', (string) $retry);
                return $response;
            }
            $stream = $request->getContent(true);
            $body = stream_get_contents($stream, 16385);
            if (false === $body || strlen($body) > 16384) {
                return $this->error('request_too_large', 413);
            }
            if ('application/json' !== strtolower(trim(explode(';', $request->headers->get('Content-Type') ?? '')[0]))) {
                return $this->error('unsupported_media_type', 415);
            }
            try {
                $input = json_decode($body, false, 8, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                return $this->error('invalid_request', 400);
            }
            if (!$input instanceof \stdClass || 0 !== $request->query->count()) {
                return $this->error('invalid_request', 400);
            }
            $fields = get_object_vars($input);
            if (3 !== count($fields)
                || !isset($fields['challengeId'], $fields['identityToken'], $fields['authorizationCode'])
                || !is_string($fields['challengeId']) || 1 !== preg_match('/\A[A-Za-z0-9_-]{43}\z/', $fields['challengeId'])
                || !is_string($fields['identityToken']) || '' === trim($fields['identityToken']) || strlen($fields['identityToken']) > 12288
                || !is_string($fields['authorizationCode']) || '' === trim($fields['authorizationCode']) || strlen($fields['authorizationCode']) > 2048
            ) {
                return $this->error('invalid_request', 400);
            }
            $result = $login->login($fields['challengeId'], $fields['identityToken'], $fields['authorizationCode']);
            if ($result instanceof IssuedAppSession) {
                return new JsonResponse($result->toResponse(), headers: ['Cache-Control' => 'no-store']);
            }
            return match ($result) {
                AppleLoginFailure::InvalidCredential => $this->error('invalid_credential', 401),
                AppleLoginFailure::ChallengeUnavailable => $this->error('challenge_unavailable', 409),
                AppleLoginFailure::Unavailable => $this->error('temporarily_unavailable', 503),
            };
        } catch (Exception) {
            return $this->error('temporarily_unavailable', 503);
        }
    }

    private function error(string $code, int $status): JsonResponse
    {
        return new JsonResponse(['error' => ['code' => $code]], $status, ['Cache-Control' => 'no-store']);
    }
}
