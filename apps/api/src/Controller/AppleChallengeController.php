<?php

declare(strict_types=1);

namespace App\Controller;

use App\Identity\AuthenticationRateLimiter;
use App\Identity\ChallengeUnavailable;
use App\Identity\LoginChallengeService;
use Doctrine\DBAL\Exception;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class AppleChallengeController
{
    #[Route('/api/auth/apple/challenges', name: 'apple_challenge', methods: ['POST'])]
    public function __invoke(Request $request, LoginChallengeService $service, AuthenticationRateLimiter $limiter): JsonResponse
    {
        try {
            $retry = $limiter->attempt('apple_challenge', $request->getClientIp() ?? 'unknown');
            if ($retry > 0) {
                $response = $this->error('rate_limited', 429);
                $response->headers->set('Retry-After', (string) $retry);
                return $response;
            }
            // Read at most the limit + one byte, before attempting JSON parsing.
            $stream = $request->getContent(true);
            $body = stream_get_contents($stream, 16385);
            if (false === $body || strlen($body) > 16384) {
                return $this->error('request_too_large', 413);
            }
            if ('application/json' !== strtolower(trim(explode(';', ($request->headers->get('Content-Type') ?? ''))[0]))) {
                return $this->error('unsupported_media_type', 415);
            }
            try {
                $input = json_decode($body, false, 8, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                return $this->error('invalid_request', 400);
            }
            if (!$input instanceof \stdClass || [] !== get_object_vars($input) || 0 !== $request->query->count()) {
                return $this->error('invalid_request', 400);
            }
            return new JsonResponse($service->issue(), 201, ['Cache-Control' => 'no-store']);
        } catch (Exception | ChallengeUnavailable | \Random\RandomException) {
            return $this->error('temporarily_unavailable', 503);
        }
    }

    private function error(string $code, int $status): JsonResponse
    {
        return new JsonResponse(['error' => ['code' => $code]], $status, ['Cache-Control' => 'no-store']);
    }
}
