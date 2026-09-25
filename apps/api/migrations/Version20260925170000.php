<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260925170000 extends AbstractMigration
{
    public function getDescription(): string { return 'Keep authoritative Oath states and terminal timestamps consistent.'; }
    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE oath ADD CONSTRAINT oath_state_known CHECK (state IN ('scheduled', 'active', 'proof_pending', 'needs_more_evidence', 'review_pending', 'fulfilled', 'missed', 'unresolved', 'withdrawn'))");
        $this->addSql("ALTER TABLE oath ADD CONSTRAINT oath_terminal_time CHECK ((state IN ('fulfilled', 'missed', 'unresolved', 'withdrawn')) = (terminal_at IS NOT NULL))");
    }
    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE oath DROP CONSTRAINT oath_terminal_time');
        $this->addSql('ALTER TABLE oath DROP CONSTRAINT oath_state_known');
    }
}
