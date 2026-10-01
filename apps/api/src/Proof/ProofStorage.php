<?php

declare(strict_types=1);

namespace App\Proof;

/**
 * Private proof object storage (ADR 0008). Keys are generated here, never taken from client input.
 * Any key that is not 32 lowercase hex characters is refused with \InvalidArgumentException.
 */
interface ProofStorage
{
    /** Stores bytes as a staged object and returns its new random 128-bit hex key. */
    public function stage(string $bytes): string;

    /** Moves a staged object to permanent storage. Repeating it for a promoted key is a no-op. */
    public function promote(string $key): void;

    /** Returns the exact stored bytes of a staged or promoted object. */
    public function read(string $key): string;

    /** Removes the object in either state. A missing object is a no-op. */
    public function delete(string $key): void;

    /** Removes only the staged copy, so a key promoted meanwhile is never lost. A missing copy is a no-op. */
    public function deleteStaged(string $key): void;

    /**
     * Keys of objects still staged at a time strictly before $instant (Unix seconds).
     *
     * @return list<string>
     */
    public function listStagedBefore(int $instant): array;

    /**
     * Removes at most $limit leftover partial writes last modified strictly before $instant (Unix seconds).
     * They never carry a key, so no row can reference them. Staged and promoted objects are never touched.
     *
     * @return array{removed: int, failed: int}
     */
    public function purgeTemporaryBefore(int $instant, int $limit): array;
}
