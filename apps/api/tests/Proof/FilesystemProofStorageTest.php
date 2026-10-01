<?php

declare(strict_types=1);

namespace App\Tests\Proof;

use App\Proof\FilesystemProofStorage;
use App\Tests\Fixtures\FixedClock;
use PHPUnit\Framework\TestCase;

final class FilesystemProofStorageTest extends TestCase
{
    private string $directory;
    private FixedClock $clock;
    private FilesystemProofStorage $storage;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/oathforge-proofs-'.bin2hex(random_bytes(8));
        $this->clock = new FixedClock();
        $this->storage = new FilesystemProofStorage($this->directory, $this->clock);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory.'/*/*') ?: [] as $path) {
            unlink($path);
        }
        foreach (glob($this->directory.'/*') ?: [] as $path) {
            rmdir($path);
        }
        if (is_dir($this->directory)) {
            rmdir($this->directory);
        }
    }

    public function testStagedObjectReadsBackExactBytesUnderRandomKey(): void
    {
        $bytes = "\xFF\xD8\xFF\x00synthetic\xFF\xD9";

        $key = $this->storage->stage($bytes);

        self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/', $key);
        self::assertNotSame($key, $this->storage->stage($bytes));
        self::assertSame($bytes, $this->storage->read($key));
    }

    public function testListsStagedObjectsStrictlyBeforeInstant(): void
    {
        $key = $this->storage->stage('synthetic');
        $this->clock->time += 10;
        $later = $this->storage->stage('synthetic later');

        self::assertSame([], $this->storage->listStagedBefore(1800000000));
        self::assertSame([$key], $this->storage->listStagedBefore(1800000001));
        $both = $this->storage->listStagedBefore(1800000011);
        sort($both);
        $expected = [$key, $later];
        sort($expected);
        self::assertSame($expected, $both);
    }

    public function testPromotedObjectLeavesStagingAndRepeatPromoteIsNoOp(): void
    {
        $key = $this->storage->stage('synthetic');

        $this->storage->promote($key);
        $this->storage->promote($key);

        self::assertSame([], $this->storage->listStagedBefore(1800000001));
        self::assertSame('synthetic', $this->storage->read($key));
    }

    public function testDeleteRemovesStagedAndPromotedObjectsAndToleratesMissing(): void
    {
        $staged = $this->storage->stage('staged');
        $promoted = $this->storage->stage('promoted');
        $this->storage->promote($promoted);

        $this->storage->delete($staged);
        $this->storage->delete($promoted);
        $this->storage->delete($promoted);

        self::assertSame([], $this->storage->listStagedBefore(1800000001));
        foreach ([$staged, $promoted] as $key) {
            try {
                $this->storage->read($key);
                self::fail('Deleted object is still readable');
            } catch (\RuntimeException $missing) {
                self::assertSame('Proof object not found', $missing->getMessage());
            }
        }
    }

    public function testRefusesKeysThatAreNotGeneratedHexNames(): void
    {
        $valid = $this->storage->stage('synthetic');
        $invalid = ['../staged/'.$valid, 'staged/'.$valid, '..', strtoupper($valid), $valid."\n", ''];
        foreach ($invalid as $key) {
            foreach (['read', 'promote', 'delete'] as $method) {
                try {
                    $this->storage->{$method}($key);
                    self::fail($method.' accepted '.json_encode($key));
                } catch (\InvalidArgumentException) {
                    $this->addToAssertionCount(1);
                }
            }
        }
        self::assertSame('synthetic', $this->storage->read($valid));
    }

    public function testCreatesPrivateDirectoriesAndFiles(): void
    {
        $this->storage->promote($this->storage->stage('promoted'));
        $this->storage->stage('staged');

        $paths = [$this->directory, ...(glob($this->directory.'/*') ?: []), ...(glob($this->directory.'/*/*') ?: [])];
        self::assertCount(5, $paths);
        foreach ($paths as $path) {
            self::assertSame(is_dir($path) ? 0700 : 0600, fileperms($path) & 0777, $path);
        }
    }

    public function testStagesThroughSymlinkedDirectoryWithTrailingSlash(): void
    {
        mkdir($this->directory, 0700);
        $link = $this->directory.'-link';
        symlink($this->directory, $link);
        try {
            $storage = new FilesystemProofStorage($link.'/', $this->clock);

            $key = $storage->stage('synthetic');
            $storage->promote($key);

            self::assertSame('synthetic', $storage->read($key));
        } finally {
            unlink($link);
        }
    }

    public function testDeleteStagedNeverRemovesAPromotedObject(): void
    {
        $promoted = $this->storage->stage('promoted');
        $this->storage->promote($promoted);
        $staged = $this->storage->stage('staged');

        $this->storage->deleteStaged($promoted);
        $this->storage->deleteStaged($staged);

        self::assertSame('promoted', $this->storage->read($promoted));
        self::assertSame([], $this->storage->listStagedBefore(1800000001));
        $this->expectException(\InvalidArgumentException::class);
        $this->storage->deleteStaged('../objects/'.$promoted);
    }
}
