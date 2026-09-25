<?php

declare(strict_types=1);
namespace App\Controller;

use App\Oath\{DeadlineResolver, OathFailure, PreviewInput, PreviewService};
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\{JsonResponse, Request};
use Symfony\Component\Routing\Attribute\Route;

final class OathPreviewController
{
    public function __construct(private PreviewService $previews, private DeadlineResolver $resolver, private SessionTokenExtractor $tokens) {}
    #[Route('/api/oath-previews', name: 'oath_preview_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = stream_get_contents($request->getContent(true), 16385);
        if (false === $body || strlen($body) > 16384) { return $this->respond(new OathFailure('request_too_large', 413)); }
        if ('application/json' !== strtolower(trim(explode(';', $request->headers->get('Content-Type') ?? '')[0]))) { return $this->respond(new OathFailure('unsupported_media_type', 415)); }
        try { $data = json_decode($body, false, 8, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { return $this->respond(new OathFailure('invalid_request')); }
        if (!$data instanceof \stdClass || 0 !== $request->query->count()) { return $this->respond(new OathFailure('invalid_request')); }
        $input = PreviewInput::parse(get_object_vars($data), $this->resolver);
        if ($input instanceof OathFailure) { return $this->respond($input); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->previews->create($token, $input), 201);
    }
    #[Route('/api/oath-previews/{id}', name: 'oath_preview_read', methods: ['GET'])]
    public function read(Request $request, string $id): JsonResponse
    {
        if (0 !== $request->query->count() || '' !== stream_get_contents($request->getContent(true), 1)) { return $this->respond(new OathFailure('invalid_request')); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->previews->read($token, $id));
    }
    /** @param array<string, mixed>|OathFailure $result */
    private function respond(array|OathFailure $result, int $status = 200): JsonResponse { return new JsonResponse($result instanceof OathFailure ? $result->toArray() : $result, $result instanceof OathFailure ? $result->status : $status, ['Cache-Control' => 'no-store']); }
}
