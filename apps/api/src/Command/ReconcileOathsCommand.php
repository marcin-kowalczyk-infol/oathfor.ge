<?php

declare(strict_types=1);
namespace App\Command;

use App\Oath\OathReconciler;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\{InputInterface, InputOption};
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:oath:reconcile', description: 'Reconcile a bounded batch of due Oath activation and unknown-availability cutoffs.')]
final class ReconcileOathsCommand extends Command
{
    public function __construct(private OathReconciler $reconciler) { parent::__construct(); }
    protected function configure(): void { $this->addOption('limit', null, InputOption::VALUE_REQUIRED, 'Maximum selected Oath rows (1..1000).', '100'); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $limit = $input->getOption('limit');
        if (!is_string($limit) || 1 !== preg_match('/\A[1-9][0-9]{0,3}\z/', $limit) || (int) $limit > 1000) { $output->writeln('INVALID_LIMIT'); return Command::INVALID; }
        try { $counts = $this->reconciler->run((int) $limit); }
        catch (\Doctrine\DBAL\Exception) { $output->writeln('RECONCILIATION_UNAVAILABLE'); return Command::FAILURE; }
        $output->writeln('OATHS_SELECTED '.$counts['selected'].' ACTIVATED '.$counts['activated'].' REVIEW '.$counts['review']);
        return Command::SUCCESS;
    }
}
