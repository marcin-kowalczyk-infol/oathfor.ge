<?php

declare(strict_types=1);
namespace App\Character;

/** Name rule from the player character contract. Normalizer comes from the declared symfony/polyfill-intl-normalizer when ext-intl is absent. */
final class CharacterName
{
    private const WHITESPACE = '[\p{Z}\t\n\x{0B}\f\r\x{85}]';
    public static function normalize(string $name): ?string
    {
        $trimmed = preg_replace('/\A'.self::WHITESPACE.'+|'.self::WHITESPACE.'+\z/u', '', $name);
        $normalized = null === $trimmed ? false : \Normalizer::normalize($trimmed, \Normalizer::FORM_C);
        if (!is_string($normalized)) { return null; }
        $length = iconv_strlen($normalized, 'UTF-8');
        if (false === $length || $length < 2 || $length > 20) { return null; }
        return 1 === preg_match('/\A\p{L}\p{M}*(?:[ \'’-]?\p{L}\p{M}*)*\z/u', $normalized) ? $normalized : null;
    }
}
