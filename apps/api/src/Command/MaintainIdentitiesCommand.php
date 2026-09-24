<?php

declare(strict_types=1);

namespace App\Command;

use App\Identity\IdentityMaintenance;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\{InputInterface, InputOption};
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:identity:maintain', description: 'Process a bounded batch of due provider validation, revocation and credential purge work.')]
final class MaintainIdentitiesCommand extends Command
{
    public function __construct(private IdentityMaintenance $maintenance) { parent::__construct(); }
    protected function configure(): void { $this->addOption('limit', null, InputOption::VALUE_REQUIRED, 'Maximum candidates (1..1000).', '100'); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $limit = $input->getOption('limit');
        if (!is_string($limit) || 1 !== preg_match('/^[1-9][0-9]{0,3}$/D', $limit) || (int) $limit > 1000) {
            $output->writeln('INVALID_LIMIT');
            return Command::INVALID;
        }
        try {
            $processed = $this->maintenance->run((int) $limit);
        } catch (\Doctrine\DBAL\Exception) {
            $output->writeln('MAINTENANCE_UNAVAILABLE');
            return Command::FAILURE;
        }
        $output->writeln('MAINTENANCE_PROCESSED '.$processed);
        return Command::SUCCESS;
    }
}
