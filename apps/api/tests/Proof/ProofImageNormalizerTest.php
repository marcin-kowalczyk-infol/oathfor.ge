<?php

declare(strict_types=1);

namespace App\Tests\Proof;

use App\Proof\ProofImageFailure;
use App\Proof\ProofImageNormalizer;
use PHPUnit\Framework\TestCase;

final class ProofImageNormalizerTest extends TestCase
{
    public function testReencodesJpegWithoutExifAndKeepsDimensions(): void
    {
        $tiff = "MM\x00\x2A\x00\x00\x00\x08\x00\x00\x00\x00\x00\x00";
        $app1 = "\xFF\xE1".pack('n', 2 + 6 + strlen($tiff))."Exif\x00\x00".$tiff;
        $source = $this->jpeg(1200, 2600);
        $withExif = substr($source, 0, 2).$app1.substr($source, 2);
        self::assertContains(0xE1, $this->markers($withExif));

        $image = (new ProofImageNormalizer())->normalize($withExif);

        $decoded = imagecreatefromstring($image->bytes);
        self::assertNotFalse($decoded);
        self::assertSame([1200, 2600], [imagesx($decoded), imagesy($decoded)]);
        self::assertSame([1200, 2600], [$image->width, $image->height]);
        self::assertNotContains(0xE1, $this->markers($image->bytes));
        self::assertStringNotContainsString("Exif\x00\x00", $image->bytes);
    }

    public function testRefusesPngBySignature(): void
    {
        $image = imagecreatetruecolor(10, 10);
        $stream = fopen('php://memory', 'w+b');
        self::assertNotFalse($stream);
        imagepng($image, $stream);
        rewind($stream);

        $this->assertRefused('unsupported_type', (string) stream_get_contents($stream));
    }

    public function testRefusesBodyOverTenMebibytesBeforeReadingIt(): void
    {
        $this->assertRefused('too_large', "\xFF\xD8\xFF".str_repeat("\x00", 10 * 1024 * 1024 + 1 - 3));
        // Exactly 10 MiB passes the size limit and fails later as unreadable.
        $this->assertRefused('unreadable_image', "\xFF\xD8\xFF".str_repeat("\x00", 10 * 1024 * 1024 - 3));
    }

    public function testRefusesOversizedHeaderWithoutDecoding(): void
    {
        // SOI and a baseline SOF0 frame header for 3000 x 2000 with no image data.
        // Decoding this would be unreadable, so too_many_pixels proves the header check ran first.
        $header = "\xFF\xD8\xFF\xC0".pack('n', 17)."\x08".pack('n', 2000).pack('n', 3000)."\x03\x01\x22\x00\x02\x11\x01\x03\x11\x01";

        $this->assertRefused('too_many_pixels', $header);
    }

    public function testRefusesJpegTruncatedInsideImageData(): void
    {
        $jpeg = $this->jpeg(1200, 2600);

        $this->assertRefused('unreadable_image', substr($jpeg, 0, intdiv(strlen($jpeg), 2)));
    }

    public function testRefusesScanHeaderLongerThanTheBody(): void
    {
        $frame = "\xFF\xC0".pack('n', 11)."\x08".pack('n', 8).pack('n', 8)."\x01\x01\x11\x00";

        $this->assertRefused('unreadable_image', "\xFF\xD8".$frame."\xFF\xDA".pack('n', 12)."\x01\x01");
    }

    public function testAcceptsProgressiveJpegButRefusesExcessiveScanCount(): void
    {
        $progressive = $this->jpeg(64, 64, true);
        self::assertGreaterThan(1, substr_count($progressive, "\xFF\xDA"));
        $normalized = (new ProofImageNormalizer())->normalize($progressive);
        self::assertSame([64, 64], [$normalized->width, $normalized->height]);

        $lastScan = strrpos($progressive, "\xFF\xDA");
        $end = strrpos($progressive, "\xFF\xD9");
        self::assertNotFalse($lastScan);
        self::assertNotFalse($end);
        $scan = substr($progressive, $lastScan, $end - $lastScan);
        $manyScans = substr($progressive, 0, $end).str_repeat($scan, 300)."\xFF\xD9";

        $this->assertRefused('unreadable_image', $manyScans);
    }

    public function testLongEdgeLimitIsInclusiveAt2880(): void
    {
        $header = "\xFF\xD8\xFF\xC0".pack('n', 11)."\x08".pack('n', 1).pack('n', 2881)."\x01\x01\x11\x00";
        $this->assertRefused('too_many_pixels', $header);

        $normalized = (new ProofImageNormalizer())->normalize($this->jpeg(2880, 10));
        self::assertSame([2880, 10], [$normalized->width, $normalized->height]);
    }

    private function assertRefused(string $code, string $bytes): void
    {
        try {
            (new ProofImageNormalizer())->normalize($bytes);
            self::fail('Expected '.$code);
        } catch (ProofImageFailure $failure) {
            self::assertSame($code, $failure->failureCode);
        }
    }

    /**
     * @param positive-int $width
     * @param positive-int $height
     */
    private function jpeg(int $width, int $height, bool $progressive = false): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefilledrectangle($image, 0, 0, intdiv($width, 2), intdiv($height, 2), 0x8A4B2C);
        imageinterlace($image, $progressive);
        $stream = fopen('php://memory', 'w+b');
        self::assertNotFalse($stream);
        imagejpeg($image, $stream, 85);
        rewind($stream);
        return (string) stream_get_contents($stream);
    }

    /** @return list<int> marker codes of the header segments before the first scan */
    private function markers(string $jpeg): array
    {
        $markers = [];
        for ($offset = 2; $offset + 4 <= strlen($jpeg) && "\xFF" === $jpeg[$offset]; $offset += 2 + $length) {
            $markers[] = $marker = ord($jpeg[$offset + 1]);
            if (0xDA === $marker) {
                break;
            }
            $length = unpack('n', $jpeg, $offset + 2)[1] ?? 0;
        }
        return $markers;
    }
}
