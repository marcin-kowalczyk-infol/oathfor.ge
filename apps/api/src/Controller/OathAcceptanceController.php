<?php

declare(strict_types=1);
namespace App\Controller;

use App\Oath\{AcceptanceInput, AcceptanceResult, AcceptanceService, OathFailure};
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\{JsonResponse, Request};
use Symfony\Component\Routing\Attribute\Route;

final class OathAcceptanceController
{
    public function __construct(private AcceptanceService $acceptance, private SessionTokenExtractor $tokens) {}
    #[Route('/api/oaths', name: 'oath_accept', methods: ['POST'])]
    public function accept(Request $request): JsonResponse
    {
        $body = stream_get_contents($request->getContent(true), 16385);
        if (false === $body || strlen($body) > 16384) { return $this->respond(new OathFailure('request_too_large', 413)); }
        if ('application/json' !== strtolower(trim(explode(';', $request->headers->get('Content-Type') ?? '')[0]))) { return $this->respond(new OathFailure('unsupported_media_type', 415)); }
        try { $data = json_decode($body, false, 8, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { return $this->respond(new OathFailure('invalid_request')); }
        if (!$data instanceof \stdClass || 0 !== $request->query->count()) { return $this->respond(new OathFailure('invalid_request')); }
        $input = AcceptanceInput::parse(get_object_vars($data));
        if ($input instanceof OathFailure) { return $this->respond($input); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->acceptance->accept($token, $input));
    }
    private function respond(AcceptanceResult|OathFailure $result): JsonResponse { return new JsonResponse($result instanceof OathFailure ? $result->toArray() : $result->body, $result instanceof OathFailure ? $result->status : ($result->created ? 201 : 200), ['Cache-Control' => 'no-store']); }
}
