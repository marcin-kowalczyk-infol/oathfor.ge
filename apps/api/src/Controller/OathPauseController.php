<?php

declare(strict_types=1);
namespace App\Controller;

use App\Oath\{OathFailure, PauseInput, PauseService};
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\{JsonResponse, Request};
use Symfony\Component\Routing\Attribute\Route;

final class OathPauseController
{
    public function __construct(private PauseService $pause, private SessionTokenExtractor $tokens) {}
    #[Route('/api/oath-pause', name: 'oath_pause_preview', methods: ['GET'])]
    public function preview(Request $request): JsonResponse
    {
        if (0 !== $request->query->count() || '' !== stream_get_contents($request->getContent(true), 1)) { return $this->respond(new OathFailure('invalid_request')); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->pause->access($token));
    }
    #[Route('/api/oath-pause', name: 'oath_pause_update', methods: ['POST'])]
    public function update(Request $request): JsonResponse
    {
        $body = stream_get_contents($request->getContent(true), 16385);
        if (false === $body || strlen($body) > 16384) { return $this->respond(new OathFailure('request_too_large', 413)); }
        if ('application/json' !== strtolower(trim(explode(';', $request->headers->get('Content-Type') ?? '')[0]))) { return $this->respond(new OathFailure('unsupported_media_type', 415)); }
        try { $data = json_decode($body, false, 8, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { return $this->respond(new OathFailure('invalid_request')); }
        if (!$data instanceof \stdClass || 0 !== $request->query->count()) { return $this->respond(new OathFailure('invalid_request')); }
        $input = PauseInput::parse(get_object_vars($data));
        if ($input instanceof OathFailure) { return $this->respond($input); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->pause->access($token, $input));
    }
    /** @param array<string, mixed>|OathFailure $result */
    private function respond(array|OathFailure $result): JsonResponse { return new JsonResponse($result instanceof OathFailure ? $result->toArray() : $result, $result instanceof OathFailure ? $result->status : 200, ['Cache-Control' => 'no-store']); }
}
