<?php

declare(strict_types=1);

namespace App\Oath;

final class DeadlineResolver
{
    /** @param array<string, mixed> $input */
    public function resolve(array $input): ResolvedDeadline|TimeFailure
    {
        if (array_diff(array_keys($input), ['local', 'timezone', 'offset']) !== []
            || !is_string($input['local'] ?? null) || !is_string($input['timezone'] ?? null)
            || (array_key_exists('offset', $input) && !is_string($input['offset']))) {
            return new TimeFailure('invalid_request');
        }
        $local = $input['local'];
        if (1 !== preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\z/', $local)
            || str_starts_with($local, '0000')) {
            return new TimeFailure('invalid_local_time');
        }
        $utc = new \DateTimeZone('UTC');
        $wall = \DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s', $local, $utc);
        if (false === $wall || $wall->format('Y-m-d\TH:i:s') !== $local) {
            return new TimeFailure('invalid_local_time');
        }
        $zoneName = $input['timezone'];
        if (strlen($zoneName) > 128 || !in_array($zoneName, \DateTimeZone::listIdentifiers(\DateTimeZone::ALL), true)) {
            return new TimeFailure('invalid_timezone');
        }
        $offset = $input['offset'] ?? null;
        if (null !== $offset && ('-00:00' === $offset || 1 !== preg_match('/\A[+-](?:[01][0-9]|2[0-3]):[0-5][0-9]\z/', $offset))) {
            return new TimeFailure('invalid_offset');
        }
        $zone = new \DateTimeZone($zoneName);
        $timestamp = $wall->getTimestamp();
        // Enumerate offsets around the wall value, then round-trip each real candidate.
        // Two days cover IANA offsets and date-line jumps without assuming one-hour DST.
        $transitions = $zone->getTransitions($timestamp - 172800, $timestamp + 172800);
        $candidates = [];
        $hasUnsupportedOccurrence = false;
        foreach ($transitions as $transition) {
            $instant = (new \DateTimeImmutable('@'.($timestamp - $transition['offset'])))->setTimezone($utc);
            $candidate = $instant->setTimezone($zone);
            if ($candidate->format('Y-m-d\TH:i:s') === $local) {
                if (0 !== $transition['offset'] % 60) {
                    $hasUnsupportedOccurrence = true;
                    continue;
                }
                $candidates[$candidate->format('P')] = $instant;
            }
        }
        if ($hasUnsupportedOccurrence && (null === $offset || [] === $candidates)) {
            return new TimeFailure('unsupported_time_offset');
        }
        if ([] === $candidates) { return new TimeFailure('nonexistent_local_time'); }
        asort($candidates);
        if (null === $offset && count($candidates) > 1) {
            return new TimeFailure('ambiguous_local_time', array_keys($candidates));
        }
        $selected = $offset ?? array_key_first($candidates);
        if (!isset($candidates[$selected])) { return new TimeFailure('offset_mismatch'); }
        $instant = $candidates[$selected];
        $cutoff = $instant->add(new \DateInterval('PT15M'));
        foreach ([$instant, $cutoff] as $value) {
            if ((int) $value->format('Y') < 1 || (int) $value->format('Y') > 9999) {
                return new TimeFailure('invalid_local_time');
            }
        }
        return new ResolvedDeadline($local, $zoneName, $selected, null !== $offset, $instant, $cutoff);
    }
}
