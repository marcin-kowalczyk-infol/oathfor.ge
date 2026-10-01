<?php

declare(strict_types=1);
namespace App\Controller;

use App\Oath\OathFailure;
use App\Proof\ProofReadService;
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\{JsonResponse, Request, Response};
use Symfony\Component\Routing\Attribute\Route;

final class ProofImageController
{
    public function __construct(private ProofReadService $proofs, private SessionTokenExtractor $tokens) {}
    #[Route('/api/oaths/{id}/proofs/{submissionId}/image', name: 'proof_image', methods: ['GET'])]
    public function image(Request $request, string $id, string $submissionId): Response
    {
        if ('' !== (string) $request->server->get('QUERY_STRING', '') || '' !== stream_get_contents($request->getContent(true), 1)) { return $this->failure(new OathFailure('invalid_request')); }
        $token = $this->tokens->extractAccessToken($request);
        $result = null === $token ? new OathFailure('unauthenticated', 401) : $this->proofs->image($token, $id, $submissionId);
        if ($result instanceof OathFailure) { return $this->failure($result); }
        // A private proof must never be kept by a shared or local cache, or sniffed into another type.
        return new Response($result, 200, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
    private function failure(OathFailure $failure): JsonResponse { return new JsonResponse($failure->toArray(), $failure->status, ['Cache-Control' => 'no-store']); }
}
