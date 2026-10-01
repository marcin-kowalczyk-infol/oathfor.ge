<?php

declare(strict_types=1);

namespace App\Proof;

/**
 * Accepts one JPEG proof and rewrites it with GD so no client metadata survives (ADR 0008).
 */
final class ProofImageNormalizer
{
    /** ADR 0008: 10 MB, counted as 10 MiB = 10,485,760 bytes. */
    public const int MAX_BYTES = 10 * 1024 * 1024;
    public const int MAX_LONG_EDGE = 2880;
    /** Does not bind while MAX_LONG_EDGE is 2880 (2880 x 2880 is 8,294,400), kept as the ADR limit. */
    public const int MAX_PIXELS = 9_000_000;
    public const int QUALITY = 85;
    /** Local bound: a standard progressive JPEG uses about 10 scans, thousands of tiny scans only cost CPU. */
    public const int MAX_SCANS = 32;

    /** @throws ProofImageFailure */
    public function normalize(string $bytes): NormalizedProofImage
    {
        if (strlen($bytes) > self::MAX_BYTES) {
            throw ProofImageFailure::tooLarge();
        }
        if (!str_starts_with($bytes, "\xFF\xD8\xFF")) {
            throw ProofImageFailure::unsupportedType();
        }
        // Reads only the frame header, so an oversized image is never decoded.
        $header = @getimagesizefromstring($bytes);
        if (false === $header || IMAGETYPE_JPEG !== $header[2] || $header[0] < 1 || $header[1] < 1) {
            throw ProofImageFailure::unreadableImage();
        }
        [$width, $height] = $header;
        if (max($width, $height) > self::MAX_LONG_EDGE || $width * $height > self::MAX_PIXELS) {
            throw ProofImageFailure::tooManyPixels();
        }
        // GD pads a truncated scan with grey instead of failing, so require a complete stream.
        if (!$this->reachesEndOfImage($bytes)) {
            throw ProofImageFailure::unreadableImage();
        }
        $image = @imagecreatefromstring($bytes);
        if (false === $image || imagesx($image) !== $width || imagesy($image) !== $height) {
            throw ProofImageFailure::unreadableImage();
        }
        $stream = fopen('php://memory', 'w+b');
        if (false === $stream) {
            throw new \RuntimeException('Proof image buffer unavailable');
        }
        try {
            if (!imagejpeg($image, $stream, self::QUALITY) || !rewind($stream)) {
                throw new \RuntimeException('Proof image encoding failed');
            }
            $normalized = stream_get_contents($stream);
            if (false === $normalized || '' === $normalized) {
                throw new \RuntimeException('Proof image encoding failed');
            }
            return new NormalizedProofImage($normalized, $width, $height);
        } finally {
            fclose($stream);
        }
    }

    /** Walks the marker structure from SOI and returns true only when an EOI marker is reached. */
    private function reachesEndOfImage(string $bytes): bool
    {
        $length = strlen($bytes);
        $offset = 2;
        $scans = 0;
        while ($offset + 1 < $length) {
            if ("\xFF" !== $bytes[$offset]) {
                return false;
            }
            $marker = ord($bytes[$offset + 1]);
            if (0xFF === $marker) {
                ++$offset; // Fill byte before a marker.
                continue;
            }
            if (0xD9 === $marker) {
                return true;
            }
            if (0x01 === $marker || ($marker >= 0xD0 && $marker <= 0xD7)) {
                $offset += 2; // Markers without a length field.
                continue;
            }
            if ($offset + 4 > $length) {
                return false;
            }
            $segment = unpack('n', $bytes, $offset + 2)[1] ?? 0;
            if (!is_int($segment) || $segment < 2) {
                return false;
            }
            $offset += 2 + $segment;
            if ($offset > $length) {
                return false;
            }
            if (0xDA !== $marker) {
                continue;
            }
            if (++$scans > self::MAX_SCANS) {
                return false;
            }
            // Entropy-coded data ends at the first 0xFF that is not stuffing (00) or a restart marker.
            while (true) {
                $candidate = strpos($bytes, "\xFF", $offset);
                if (false === $candidate || $candidate + 1 >= $length) {
                    return false;
                }
                $next = ord($bytes[$candidate + 1]);
                if (0x00 === $next || ($next >= 0xD0 && $next <= 0xD7)) {
                    $offset = $candidate + 2;
                    continue;
                }
                $offset = $candidate;
                break;
            }
        }
        return false;
    }
}
