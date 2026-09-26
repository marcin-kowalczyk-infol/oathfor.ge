<?php

declare(strict_types=1);
namespace App\Controller;

use App\Character\{CharacterFailure, CharacterInput, CharacterResult, CharacterService};
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\{JsonResponse, Request};
use Symfony\Component\Routing\Attribute\Route;

final class CharacterController
{
    public function __construct(private CharacterService $characters, private SessionTokenExtractor $tokens) {}
    #[Route('/api/characters', name: 'character_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        if (0 !== $request->query->count() || '' !== stream_get_contents($request->getContent(true), 1)) { return $this->respond(new CharacterFailure('invalid_request')); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new CharacterFailure('unauthenticated', 401) : $this->characters->list($token));
    }
    #[Route('/api/characters', name: 'character_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = stream_get_contents($request->getContent(true), 16385);
        if (false === $body || strlen($body) > 16384) { return $this->respond(new CharacterFailure('request_too_large', 413)); }
        if ('application/json' !== strtolower(trim(explode(';', $request->headers->get('Content-Type') ?? '')[0]))) { return $this->respond(new CharacterFailure('unsupported_media_type', 415)); }
        try { $data = json_decode($body, false, 8, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { return $this->respond(new CharacterFailure('invalid_request')); }
        if (!$data instanceof \stdClass || 0 !== $request->query->count()) { return $this->respond(new CharacterFailure('invalid_request')); }
        $input = CharacterInput::parse(get_object_vars($data));
        if ($input instanceof CharacterFailure) { return $this->respond($input); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new CharacterFailure('unauthenticated', 401) : $this->characters->create($token, $input));
    }
    /** @param array<string, mixed>|CharacterResult|CharacterFailure $result */
    private function respond(array|CharacterResult|CharacterFailure $result): JsonResponse
    {
        if ($result instanceof CharacterFailure) { return new JsonResponse($result->toArray(), $result->status, ['Cache-Control' => 'no-store']); }
        return $result instanceof CharacterResult ? new JsonResponse($result->body, $result->created ? 201 : 200, ['Cache-Control' => 'no-store']) : new JsonResponse($result, 200, ['Cache-Control' => 'no-store']);
    }
}
