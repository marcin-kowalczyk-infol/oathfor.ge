<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260925180000 extends AbstractMigration
{
    public function getDescription(): string { return 'Persist activation reconciliation execution and fixed review clocks.'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE oath ADD activation_reconciled_at BIGINT DEFAULT NULL, ADD review_entered_at BIGINT DEFAULT NULL, ADD review_closes_at BIGINT DEFAULT NULL');
        $this->addSql('ALTER TABLE oath ADD CONSTRAINT oath_review_clock CHECK ((review_entered_at IS NULL AND review_closes_at IS NULL) OR (review_entered_at IS NOT NULL AND review_closes_at IS NOT NULL AND review_closes_at = review_entered_at + 259200))');
        $this->addSql("CREATE INDEX oath_due_activation ON oath (activation_at, id) WHERE state = 'scheduled'");
        $this->addSql("CREATE INDEX oath_due_cutoff ON oath (receipt_cutoff, id) WHERE state = 'active'");
    }
    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX oath_due_activation'); $this->addSql('DROP INDEX oath_due_cutoff');
        $this->addSql('ALTER TABLE oath DROP CONSTRAINT oath_review_clock, DROP activation_reconciled_at, DROP review_entered_at, DROP review_closes_at');
    }
}
