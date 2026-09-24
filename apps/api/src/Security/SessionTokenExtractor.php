<?php

declare(strict_types=1);

namespace App\Security;

use App\Identity\AppSessionRepository;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Http\AccessToken\AccessTokenExtractorInterface;

final class SessionTokenExtractor implements AccessTokenExtractorInterface
{
    public function extractAccessToken(Request $request): ?string
    {
        $headers = $request->headers->all('Authorization');
        if (1 !== count($headers) || !is_string($headers[0]) || 1 !== preg_match('/\ABearer ([A-Za-z0-9_-]{43})\z/i', $headers[0], $matches)) {
            return null;
        }
        return AppSessionRepository::isValidToken($matches[1]) ? $matches[1] : null;
    }
}
