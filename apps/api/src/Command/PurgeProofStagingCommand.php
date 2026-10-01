<?php

declare(strict_types=1);
namespace App\Command;

use App\Identity\Clock;
use App\Proof\ProofStorage;
use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\{InputInterface, InputOption};
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:proof:purge-staging', description: 'Delete a bounded batch of unfinalized staged proof objects older than 24 hours.')]
final class PurgeProofStagingCommand extends Command
{
    private const int RETENTION = 86400;
    public function __construct(private ProofStorage $storage, private Connection $connection, private Clock $clock) { parent::__construct(); }
    protected function configure(): void { $this->addOption('limit', null, InputOption::VALUE_REQUIRED, 'Maximum selected staged objects (1..1000).', '100'); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $limit = $input->getOption('limit');
        if (!is_string($limit) || 1 !== preg_match('/\A[1-9][0-9]{0,3}\z/', $limit) || (int) $limit > 1000) { $output->writeln('INVALID_LIMIT'); return Command::INVALID; }
        // Strictly before now - 24 h, so an object staged at T stays at T + 24 h and goes at T + 24 h + 1 s.
        $before = $this->clock->now() - self::RETENTION;
        $keys = $referenced = $failed = [];
        $deleted = 0;
        $temporary = ['removed' => 0, 'failed' => 0];
        $unavailable = false;
        try {
            $keys = array_slice($this->storage->listStagedBefore($before), 0, (int) $limit);
            foreach ($keys as $key) {
                // Defense in depth: a row's object is promoted before commit, but a referenced key is never deleted.
                if (false !== $this->connection->fetchOne('SELECT 1 FROM proof_submission WHERE storage_key = ?', [$key])) { $referenced[] = $key; continue; }
                // A failed key is reported and retried on the next run. It never stops the rest of the batch.
                try { $this->storage->deleteStaged($key); ++$deleted; }
                catch (\RuntimeException) { $failed[] = $key; }
            }
        } catch (\Doctrine\DBAL\Exception|\RuntimeException) {
            // Without a working listing or reference check no further key is deleted. What was done so far is still reported.
            $unavailable = true;
        }
        // Temporary files need no reference check, so they get their own pass. It throws only before removing anything.
        try { $temporary = $this->storage->purgeTemporaryBefore($before, (int) $limit); }
        catch (\RuntimeException) { $unavailable = true; }
        $output->writeln('STAGED_SELECTED '.count($keys).' DELETED '.$deleted.' REFERENCED '.count($referenced).' FAILED '.count($failed).' TEMPORARY_REMOVED '.$temporary['removed'].' TEMPORARY_FAILED '.$temporary['failed']);
        foreach ($referenced as $key) { $output->writeln('REFERENCED_KEY '.$key); }
        foreach ($failed as $key) { $output->writeln('FAILED_KEY '.$key); }
        if ($unavailable) { $output->writeln('STAGING_PURGE_UNAVAILABLE'); }
        // A referenced staged key means a committed row points at an unpromoted object. It stays, and the run fails so an operator looks.
        $clean = !$unavailable && [] === $referenced && [] === $failed && 0 === $temporary['failed'];
        return $clean ? Command::SUCCESS : Command::FAILURE;
    }
}
