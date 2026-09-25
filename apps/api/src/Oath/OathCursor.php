<?php

declare(strict_types=1);
namespace App\Oath;

final class OathCursor
{
    public static function encode(string $owner, string $view, int $key, string $id): string
    {
        return rtrim(strtr(base64_encode(json_encode(['v' => 1, 'owner' => $owner, 'view' => $view, 'key' => $key, 'id' => $id], JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    }
    /** @return array{key: int, id: string}|OathFailure */
    public static function decode(string $cursor, string $owner, string $view): array|OathFailure
    {
        if (strlen($cursor) > 1024 || 1 !== preg_match('/\A[A-Za-z0-9_-]+\z/', $cursor)) { return new OathFailure('invalid_request'); }
        $json = base64_decode(strtr($cursor, '-_', '+/'), true);
        if (false === $json) { return new OathFailure('invalid_request'); }
        try { $data = json_decode($json, true, 4, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { return new OathFailure('invalid_request'); }
        if (!is_array($data) || array_keys($data) !== ['v', 'owner', 'view', 'key', 'id'] || 1 !== $data['v'] || $owner !== $data['owner'] || $view !== $data['view'] || !is_int($data['key']) || !is_string($data['id']) || 1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $data['id']) || self::encode($owner, $view, $data['key'], $data['id']) !== $cursor) { return new OathFailure('invalid_request'); }
        return ['key' => $data['key'], 'id' => $data['id']];
    }
}
