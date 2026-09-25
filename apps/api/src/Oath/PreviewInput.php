<?php

declare(strict_types=1);
namespace App\Oath;

final readonly class PreviewInput
{
    private function __construct(public string $activity, public ?ResolvedDeadline $activation, public ResolvedDeadline $deadline) {}

    /** @param array<string, mixed> $input */
    public static function parse(array $input, DeadlineResolver $resolver): self|OathFailure
    {
        if (array_diff(array_keys($input), ['activity', 'activation', 'deadline']) !== [] || !is_string($input['activity'] ?? null)
            || !($input['activation'] ?? null) instanceof \stdClass || !($input['deadline'] ?? null) instanceof \stdClass) { return new OathFailure('invalid_request'); }
        if (!in_array($input['activity'], ['running', 'strength_training', 'mobility'], true)) { return new OathFailure('invalid_activity'); }
        $activation = get_object_vars($input['activation']);
        if (!in_array($activation['mode'] ?? null, ['now', 'scheduled'], true)
            || array_diff(array_keys($activation), 'now' === $activation['mode'] ? ['mode'] : ['mode', 'time']) !== []) { return new OathFailure('invalid_request'); }
        $start = null;
        if ('scheduled' === $activation['mode']) {
            if (!($activation['time'] ?? null) instanceof \stdClass) { return new OathFailure('invalid_request'); }
            $start = $resolver->resolve(get_object_vars($activation['time']));
            if ($start instanceof TimeFailure) { return self::failure($start, 'activation'); }
        }
        $deadline = $resolver->resolve(get_object_vars($input['deadline']));
        if ($deadline instanceof TimeFailure) { return self::failure($deadline, 'deadline'); }
        return new self($input['activity'], $start, $deadline);
    }
    public function timingFailure(int $now): ?OathFailure
    {
        if (null !== $this->activation && $this->activation->instant->getTimestamp() <= $now) { return new OathFailure('activation_elapsed', 409); }
        if ($this->deadline->instant->getTimestamp() <= ($this->activation?->instant->getTimestamp() ?? $now)) { return new OathFailure('deadline_not_after_activation', 409); }
        return null;
    }
    private static function failure(TimeFailure $failure, string $field): OathFailure { return new OathFailure($failure->code, 400, 'invalid_request' === $failure->code ? null : $field, $failure->validOffsets); }
}
