<?php

declare(strict_types=1);
namespace App\Controller;

use App\Oath\OathFailure;
use App\Proof\{SubmissionInput, SubmissionResult, SubmissionService};
use App\Security\SessionTokenExtractor;
use Symfony\Component\HttpFoundation\{JsonResponse, Request};
use Symfony\Component\Routing\Attribute\Route;

final class ProofSubmissionController
{
    public function __construct(private SubmissionService $submissions, private SessionTokenExtractor $tokens) {}
    #[Route('/api/oaths/{id}/proofs', name: 'proof_submit', methods: ['POST'])]
    public function submit(Request $request, string $id): JsonResponse
    {
        if ('multipart/form-data' !== strtolower(trim(explode(';', $request->headers->get('Content-Type') ?? '')[0]))) { return $this->respond(new OathFailure('unsupported_media_type', 415)); }
        // Above post_max_size PHP discards every field, so the declared length is the only remaining signal.
        $limit = ini_parse_quantity((string) ini_get('post_max_size'));
        if ($limit > 0 && (int) $request->server->get('CONTENT_LENGTH', 0) > $limit) { return $this->respond(new OathFailure('request_too_large', 413)); }
        $fields = $request->request->all();
        $files = $request->files->all();
        if (0 !== $request->query->count() || [] !== array_diff(array_keys($fields), ['submissionId', 'mode', 'declaration']) || [] !== array_diff(array_keys($files), ['image'])) { return $this->respond(new OathFailure('invalid_request')); }
        foreach ($fields as $value) { if (!is_string($value)) { return $this->respond(new OathFailure('invalid_request')); } }
        $input = SubmissionInput::parse($fields, $files['image'] ?? null);
        if ($input instanceof OathFailure) { return $this->respond($input); }
        $token = $this->tokens->extractAccessToken($request);
        return $this->respond(null === $token ? new OathFailure('unauthenticated', 401) : $this->submissions->submit($token, $id, $input));
    }
    private function respond(SubmissionResult|OathFailure $result): JsonResponse { return new JsonResponse($result instanceof OathFailure ? $result->toArray() : $result->body, $result instanceof OathFailure ? $result->status : 201, ['Cache-Control' => 'no-store']); }
}
