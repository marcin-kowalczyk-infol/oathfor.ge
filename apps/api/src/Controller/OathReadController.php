<?php

declare(strict_types=1);
namespace App\Controller;

use App\Oath\{OathFailure, OathListInput, OathReadService};
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\{JsonResponse, Request};
use Symfony\Component\Routing\Attribute\Route;

final class OathReadController
{
    public function __construct(private OathReadService $oaths, private SessionTokenExtractor $tokens) {}
    #[Route('/api/oaths/{id}', name: 'oath_detail', methods: ['GET'])]
    public function detail(Request $request, string $id): JsonResponse
    {
        if ('' !== (string) $request->server->get('QUERY_STRING', '') || '' !== stream_get_contents($request->getContent(true), 1)) { return $this->respond(new OathFailure('invalid_request')); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->oaths->detail($token, $id));
    }
    #[Route('/api/oaths', name: 'oath_list', methods: ['GET'])]
    public function listing(Request $request): JsonResponse
    {
        if ('' !== stream_get_contents($request->getContent(true), 1)) { return $this->respond(new OathFailure('invalid_request')); }
        $input = OathListInput::parse((string) $request->server->get('QUERY_STRING', ''));
        if ($input instanceof OathFailure) { return $this->respond($input); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->oaths->listing($token, $input));
    }
    /** @param array<string, mixed>|OathFailure $result */
    private function respond(array|OathFailure $result): JsonResponse { return new JsonResponse($result instanceof OathFailure ? $result->toArray() : $result, $result instanceof OathFailure ? $result->status : 200, ['Cache-Control' => 'no-store']); }
}
