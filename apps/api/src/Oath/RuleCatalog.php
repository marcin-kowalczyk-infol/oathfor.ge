<?php

declare(strict_types=1);

namespace App\Oath;

final class RuleCatalog
{
    public const TEMPLATE_VERSION = 'workout_oath_v1';
    public const POLICY_VERSION = 'workout_rewards_v1';
    public const ACTIVITIES = ['running', 'strength_training', 'mobility'];

    /**
     * @param array<string, mixed> $activation
     * @param array<string, mixed> $deadline
     * @return array<string, mixed>
     */
    public function snapshot(string $activity, array $activation, array $deadline): array
    {
        if (!in_array($activity, self::ACTIVITIES, true)) { throw new \InvalidArgumentException('Unsupported activity.'); }
        $json = file_get_contents(__DIR__.'/../../resources/oath/workout_oath_v1.json');
        if (false === $json) { throw new \LogicException('Rule catalog unavailable.'); }
        /** @var array<string, mixed> $rules */
        $rules = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        $rules['activity'] = $activity;
        $rules['activation'] = $activation;
        $rules['deadline'] = $deadline;
        foreach (['pl', 'en'] as $locale) {
            $rules['copy'][$locale]['activity'] = $rules['copy'][$locale]['activities'][$activity];
            unset($rules['copy'][$locale]['activities']);
        }
        return $rules;
    }
}
