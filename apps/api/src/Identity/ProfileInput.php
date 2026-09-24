<?php

declare(strict_types=1);

namespace App\Identity;

final class ProfileInput
{
    /** @param array<string, mixed> $changes */
    public static function validate(array $changes): ?string
    {
        if ([] === $changes) {
            return 'invalid_request';
        }
        $allowed = ['locale', 'timezone', 'intention', 'companionIntroduced', 'notificationPreference'];
        foreach ($changes as $field => $value) {
            if (!in_array($field, $allowed, true)
                || ('companionIntroduced' === $field ? true !== $value : !is_string($value))) {
                return 'invalid_request';
            }
        }
        foreach ($changes as $field => $value) {
            if ('locale' === $field && !in_array($value, ['pl', 'en'], true)) {
                return 'invalid_locale';
            }
            if ('intention' === $field && 'regular_activity' !== $value) {
                return 'invalid_intention';
            }
            if ('notificationPreference' === $field && !in_array($value, ['enabled', 'disabled'], true)) {
                return 'invalid_notification_preference';
            }
            if ('timezone' === $field && (!is_string($value) || !self::validTimezone($value))) {
                return 'invalid_timezone';
            }
        }
        return null;
    }

    private static function validTimezone(string $timezone): bool
    {
        if (1 !== preg_match('/\A[\x00-\x7F]{1,128}\z/', $timezone)
            || !in_array($timezone, ['UTC', ...\DateTimeZone::listIdentifiers(\DateTimeZone::ALL)], true)) {
            return false;
        }
        try {
            new \DateTimeZone($timezone);
            return true;
        } catch (\DateInvalidTimeZoneException) {
            return false;
        }
    }
}
