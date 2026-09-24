<?php

declare(strict_types=1);

namespace App\Identity;

use Firebase\JWT\Key;

/** @phpstan-type Snapshot array{fetchedAt: ?int, attemptedAt: ?int, succeeded: bool, jwks: ?array<string, mixed>} */
final class CachedAppleSigningKeys implements AppleSigningKeySource
{
    public function __construct(private AppleJwksFetcher $fetcher, private AppleJwksParser $parser, private Clock $clock, private string $directory)
    {
    }

    /** @phpstan-impure */
    public function find(string $kid): Key|IdentityVerificationFailure
    {
        try {
            $this->prepareDirectory();
            $state = $this->read();
            $known = $this->known($state, $kid);
            if (null !== $known) {
                return $known;
            }
            $lock = @fopen($this->directory.'/refresh.lock', 'c+b');
            if (false === $lock) {
                throw new AppleKeysUnavailable();
            }
            try {
                if (!@flock($lock, LOCK_EX | LOCK_NB)) {
                    return IdentityVerificationFailure::Unavailable;
                }
                // Another process may have completed a refresh since our first read.
                $state = $this->read();
                $known = $this->known($state, $kid);
                if (null !== $known) {
                    return $known;
                }
                $now = $this->clock->now();
                if (null !== $state['attemptedAt'] && $now < $state['attemptedAt'] + 60) {
                    return $state['succeeded'] && $this->fresh($state) ? IdentityVerificationFailure::InvalidCredential : IdentityVerificationFailure::Unavailable;
                }
                // Persist cooldown before network work, including a failed/crashed fetch.
                $state['attemptedAt'] = $now;
                $state['succeeded'] = false;
                $this->write($state);
                $jwks = $this->fetcher->fetch();
                $keys = $this->parser->parse($jwks);
                $state['jwks'] = $jwks;
                $state['fetchedAt'] = $this->clock->now();
                $state['succeeded'] = true;
                $this->write($state);
                return $keys[$kid] ?? IdentityVerificationFailure::InvalidCredential;
            } finally {
                @flock($lock, LOCK_UN);
                fclose($lock);
            }
        } catch (AppleKeysUnavailable) {
            return IdentityVerificationFailure::Unavailable;
        }
    }

    private function prepareDirectory(): void
    {
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0700, true) && !is_dir($this->directory)) {
            throw new AppleKeysUnavailable();
        }
    }

    /** @param Snapshot $state */
    private function fresh(array $state): bool
    {
        $now = $this->clock->now();
        return null !== $state['fetchedAt'] && $state['fetchedAt'] <= $now && $now < $state['fetchedAt'] + 21600;
    }

    /** @param Snapshot $state */
    private function known(array $state, string $kid): ?Key
    {
        return $this->fresh($state) && null !== $state['jwks'] ? ($this->parser->parse($state['jwks'])[$kid] ?? null) : null;
    }

    /** @return Snapshot */
    private function read(): array
    {
        $path = $this->directory.'/snapshot.json';
        if (!file_exists($path)) {
            return ['fetchedAt' => null, 'attemptedAt' => null, 'succeeded' => false, 'jwks' => null];
        }
        $raw = @file_get_contents($path, length: 131073);
        if (false === $raw || strlen($raw) > 131072) {
            throw new AppleKeysUnavailable();
        }
        try {
            $state = json_decode($raw, true, 20, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new AppleKeysUnavailable();
        }
        if (!is_array($state) || !array_key_exists('fetchedAt', $state) || !array_key_exists('attemptedAt', $state)
            || !array_key_exists('jwks', $state) || !is_bool($state['succeeded'] ?? null)
            || !(null === $state['fetchedAt'] || is_int($state['fetchedAt']))
            || !(null === $state['attemptedAt'] || is_int($state['attemptedAt']))
            || !(null === $state['jwks'] || is_array($state['jwks']))) {
            throw new AppleKeysUnavailable();
        }
        if (null !== $state['jwks']) {
            $this->parser->parse($state['jwks']);
        }
        return ['fetchedAt' => $state['fetchedAt'], 'attemptedAt' => $state['attemptedAt'], 'succeeded' => $state['succeeded'], 'jwks' => $state['jwks']];
    }

    /** @param Snapshot $state */
    private function write(array $state): void
    {
        $temporary = @tempnam($this->directory, 'snapshot-');
        if (false === $temporary || dirname($temporary) !== $this->directory) {
            if (false !== $temporary) { @unlink($temporary); }
            throw new AppleKeysUnavailable();
        }
        try {
            $json = json_encode($state, JSON_THROW_ON_ERROR);
            if (strlen($json) !== @file_put_contents($temporary, $json) || !@rename($temporary, $this->directory.'/snapshot.json')) {
                throw new AppleKeysUnavailable();
            }
        } finally {
            if (file_exists($temporary)) { @unlink($temporary); }
        }
    }
}
