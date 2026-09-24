<?php

declare(strict_types=1);

namespace App\Controller;

use App\Identity\ProfileFailure;
use App\Identity\ProfileInput;
use App\Identity\ProfileService;
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class ProfileController
{
    public function __construct(private ProfileService $profiles, private SessionTokenExtractor $tokens)
    {
    }

    #[Route('/api/profile', name: 'profile_read', methods: ['GET'])]
    public function read(Request $request): JsonResponse
    {
        $stream = $request->getContent(true);
        if (0 !== $request->query->count() || '' !== stream_get_contents($stream, 1)) {
            return $this->error('invalid_request', 400);
        }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? ProfileFailure::Unauthenticated : $this->profiles->read($token));
    }

    #[Route('/api/profile', name: 'profile_patch', methods: ['PATCH'])]
    public function patch(Request $request): JsonResponse
    {
        $changes = $this->input($request);
        if ($changes instanceof JsonResponse) {
            return $changes;
        }
        $error = ProfileInput::validate($changes);
        if (null !== $error) {
            return $this->error($error, 400);
        }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? ProfileFailure::Unauthenticated : $this->profiles->patch($token, $changes));
    }

    #[Route('/api/onboarding/complete', name: 'onboarding_complete', methods: ['POST'])]
    public function complete(Request $request): JsonResponse
    {
        $input = $this->input($request);
        if ($input instanceof JsonResponse) {
            return $input;
        }
        if ([] !== $input) {
            return $this->error('invalid_request', 400);
        }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? ProfileFailure::Unauthenticated : $this->profiles->complete($token));
    }

    /** @return array<string, mixed>|JsonResponse */
    private function input(Request $request): array|JsonResponse
    {
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
        return get_object_vars($input);
    }

    /** @param array<string, mixed>|ProfileFailure $result */
    private function respond(array|ProfileFailure $result): JsonResponse
    {
        if (is_array($result)) {
            return new JsonResponse($result, headers: ['Cache-Control' => 'no-store']);
        }
        return match ($result) {
            ProfileFailure::Unauthenticated => $this->error('unauthenticated', 401),
            ProfileFailure::Unavailable => $this->error('temporarily_unavailable', 503),
            ProfileFailure::Incomplete => $this->error('onboarding_incomplete', 409),
        };
    }

    private function error(string $code, int $status): JsonResponse
    {
        return new JsonResponse(['error' => ['code' => $code]], $status, ['Cache-Control' => 'no-store']);
    }
}
