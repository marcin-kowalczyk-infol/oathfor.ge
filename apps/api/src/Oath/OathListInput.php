<?php

declare(strict_types=1);
namespace App\Oath;

final readonly class OathListInput
{
    private function __construct(public string $view, public int $limit, public ?string $cursor) {}
    public static function parse(string $query): self|OathFailure
    {
        $values = [];
        if (strlen($query) > 2048) { return new OathFailure('invalid_request'); }
        foreach ('' === $query ? [] : explode('&', $query) as $part) {
            $pair = explode('=', $part, 2);
            $key = urldecode($pair[0]);
            if (count($pair) !== 2 || !in_array($key, ['view', 'limit', 'cursor'], true) || isset($values[$key])) { return new OathFailure('invalid_request'); }
            $values[$key] = urldecode($pair[1]);
        }
        $view = $values['view'] ?? 'today';
        $limit = $values['limit'] ?? '20';
        $cursor = $values['cursor'] ?? null;
        if (!in_array($view, ['today', 'history'], true) || 1 !== preg_match('/\A(?:[1-9][0-9]?|100)\z/', $limit) || (null !== $cursor && ('' === $cursor || strlen($cursor) > 1024))) { return new OathFailure('invalid_request'); }
        return new self($view, (int) $limit, $cursor);
    }
}
