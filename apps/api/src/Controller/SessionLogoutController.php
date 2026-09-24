<?php

declare(strict_types=1);

namespace App\Controller;

use App\Identity\AppSessionRepository;
use App\Security\SessionAuthenticationFailure;
use App\Security\SessionTokenExtractor;
use Doctrine\DBAL\Exception;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class SessionLogoutController
{
    #[Route('/api/auth/session', name: 'session_logout', methods: ['DELETE'])]
    public function __invoke(Request $request, SessionTokenExtractor $extractor, AppSessionRepository $sessions): Response
    {
        $token = $extractor->extractAccessToken($request);
        if (null === $token) {
            return SessionAuthenticationFailure::response();
        }
        try {
            $sessions->revoke($token);
        } catch (Exception) {
            return SessionAuthenticationFailure::response(true);
        }
        return new Response(status: 204, headers: ['Cache-Control' => 'no-store']);
    }
}
