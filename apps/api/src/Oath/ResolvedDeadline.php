<?php

declare(strict_types=1);

namespace App\Oath;

final readonly class ResolvedDeadline
{
    public function __construct(
        public string $local,
        public string $timezone,
        public string $offset,
        public bool $explicitOffset,
        public \DateTimeImmutable $instant,
        public \DateTimeImmutable $receiptCutoff,
    ) {}

    /** @return array{local: string, timezone: string, offset: string, explicitOffset: bool, utc: string, receiptCutoff: string} */
    public function toArray(): array
    {
        return [
            'local' => $this->local, 'timezone' => $this->timezone, 'offset' => $this->offset,
            'explicitOffset' => $this->explicitOffset, 'utc' => $this->instant->format('Y-m-d\TH:i:s\Z'),
            'receiptCutoff' => $this->receiptCutoff->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
