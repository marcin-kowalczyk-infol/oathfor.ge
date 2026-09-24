<?php

declare(strict_types=1);

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;

final class SessionAuthenticationFailure implements AuthenticationFailureHandlerInterface, AuthenticationEntryPointInterface
{
    public function start(Request $request, ?AuthenticationException $authException = null): JsonResponse
    {
        return self::response();
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        return self::response($exception instanceof SessionAuthenticationUnavailable);
    }

    public static function response(bool $unavailable = false): JsonResponse
    {
        return new JsonResponse(['error' => ['code' => $unavailable ? 'temporarily_unavailable' : 'unauthenticated']], $unavailable ? 503 : 401, ['Cache-Control' => 'no-store']);
    }
}
