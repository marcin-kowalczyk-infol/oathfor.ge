<?php

declare(strict_types=1);

namespace App\Controller;

use App\Identity\AccountUser;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class MeController
{
    #[Route('/api/me', name: 'account_me', methods: ['GET'])]
    public function __invoke(#[CurrentUser] AccountUser $account): JsonResponse
    {
        return new JsonResponse(['account' => $account->toArray()], headers: ['Cache-Control' => 'no-store']);
    }
}
