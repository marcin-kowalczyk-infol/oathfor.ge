<?php

declare(strict_types=1);

namespace App\Proof;

use App\Identity\Clock;

/**
 * Keeps proof objects on a private directory outside public/ (ADR 0008).
 * Staged and promoted objects live in two subdirectories. Writes go through a temporary file and rename.
 * A staged file's modification time is the Clock time of staging. A single API host is assumed.
 */
final class FilesystemProofStorage implements ProofStorage
{
    private const string STAGED = 'staged';
    private const string OBJECTS = 'objects';
    private const string KEY_PATTERN = '/^[0-9a-f]{32}$/D';

    private ?string $root = null;

    public function __construct(private string $directory, private Clock $clock)
    {
    }

    public function stage(string $bytes): string
    {
        $staged = $this->prepare(self::STAGED);
        $key = bin2hex(random_bytes(16));
        $temporary = @tempnam($staged, '.tmp-');
        if (false === $temporary || dirname($temporary) !== $staged) {
            if (false !== $temporary) {
                @unlink($temporary);
            }
            throw new \RuntimeException('Proof staging unavailable');
        }
        try {
            $handle = @fopen($temporary, 'wb');
            if (false === $handle) {
                throw new \RuntimeException('Proof staging unavailable');
            }
            try {
                $written = @fwrite($handle, $bytes);
                if (strlen($bytes) !== $written || !@fflush($handle) || !@fsync($handle)) {
                    throw new \RuntimeException('Proof staging unavailable');
                }
            } finally {
                fclose($handle);
            }
            if (!@chmod($temporary, 0600) || !@touch($temporary, $this->clock->now())
                || !@rename($temporary, $staged.'/'.$key)) {
                throw new \RuntimeException('Proof staging unavailable');
            }
        } finally {
            if (file_exists($temporary)) {
                @unlink($temporary);
            }
        }
        return $key;
    }

    public function promote(string $key): void
    {
        $this->assertKey($key);
        $target = $this->prepare(self::OBJECTS).'/'.$key;
        $source = $this->root().'/'.self::STAGED.'/'.$key;
        if (@rename($source, $target)) {
            return;
        }
        clearstatcache();
        if (!is_file($target)) {
            throw new \RuntimeException('Staged proof object not found');
        }
        // Already promoted, for example by a repeated delivery.
    }

    public function read(string $key): string
    {
        $this->assertKey($key);
        // Staged first: a concurrent promote moves the file towards the second location.
        foreach ([self::STAGED, self::OBJECTS] as $state) {
            $path = $this->root().'/'.$state.'/'.$key;
            if (is_file($path)) {
                $bytes = @file_get_contents($path);
                if (false !== $bytes) {
                    return $bytes;
                }
            }
        }
        throw new \RuntimeException('Proof object not found');
    }

    public function delete(string $key): void
    {
        $this->unlink(self::STAGED, $key);
        $this->unlink(self::OBJECTS, $key);
    }

    public function deleteStaged(string $key): void
    {
        $this->unlink(self::STAGED, $key);
    }

    public function listStagedBefore(int $instant): array
    {
        $staged = $this->root().'/'.self::STAGED;
        $names = is_dir($staged) ? @scandir($staged) : [];
        if (false === $names) {
            throw new \RuntimeException('Proof storage unavailable');
        }
        clearstatcache();
        $keys = [];
        foreach ($names as $name) {
            // Temporary files never match the key pattern, so they are never listed.
            if (1 !== preg_match(self::KEY_PATTERN, $name)) {
                continue;
            }
            $modified = @filemtime($staged.'/'.$name);
            if (false !== $modified && $modified < $instant) {
                $keys[] = $name;
            }
        }
        sort($keys);
        return $keys;
    }

    private function unlink(string $state, string $key): void
    {
        $this->assertKey($key);
        $path = $this->root().'/'.$state.'/'.$key;
        if (!@unlink($path) && file_exists($path)) {
            throw new \RuntimeException('Proof object deletion failed');
        }
    }

    private function assertKey(string $key): void
    {
        if (1 !== preg_match(self::KEY_PATTERN, $key)) {
            throw new \InvalidArgumentException('Invalid proof storage key');
        }
    }

    /** The resolved directory, so paths compare equal to what tempnam() returns. */
    private function root(): string
    {
        if (null === $this->root) {
            if (!is_dir($this->directory) && !@mkdir($this->directory, 0700, true) && !is_dir($this->directory)) {
                throw new \RuntimeException('Proof storage unavailable');
            }
            $resolved = realpath($this->directory);
            if (false === $resolved) {
                throw new \RuntimeException('Proof storage unavailable');
            }
            $this->root = $resolved;
        }
        return $this->root;
    }

    private function prepare(string $state): string
    {
        $path = $this->root().'/'.$state;
        if (!is_dir($path) && !@mkdir($path, 0700, true) && !is_dir($path)) {
            throw new \RuntimeException('Proof storage unavailable');
        }
        return $path;
    }
}
