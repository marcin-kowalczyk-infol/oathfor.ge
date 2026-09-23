<?php

declare(strict_types=1);

namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:check-database', description: 'Check a synthetic database transaction without retaining data.')]
final class CheckDatabaseCommand extends Command
{
    public function __construct(private readonly Connection $connection)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        try {
            $this->connection->beginTransaction();
            $this->connection->executeStatement('CREATE TEMPORARY TABLE oathforge_probe (value VARCHAR(32)) ON COMMIT DROP');
            $this->connection->insert('oathforge_probe', ['value' => 'synthetic']);
            $value = $this->connection->fetchOne('SELECT value FROM oathforge_probe');
            $this->connection->rollBack();

            if ($value !== 'synthetic') {
                throw new \RuntimeException('Unexpected synthetic result.');
            }
        } catch (\Throwable) {
            // Closing also abandons an interrupted transaction without logging its DSN.
            $this->connection->close();
            $output->writeln('DATABASE_UNAVAILABLE');

            return Command::FAILURE;
        }

        $output->writeln('DATABASE_OK');

        return Command::SUCCESS;
    }
}
