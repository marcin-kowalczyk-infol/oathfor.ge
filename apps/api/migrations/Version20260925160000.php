<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260925160000 extends AbstractMigration
{
    public function getDescription(): string { return 'Persist original Oath commitments and owner-scoped acceptance retry identities.'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE oath_preview ADD CONSTRAINT oath_preview_owner_id UNIQUE (account_id, id)');
        $this->addSql("CREATE TABLE oath (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE, preview_id UUID NOT NULL, snapshot TEXT NOT NULL, state VARCHAR(32) NOT NULL, activation_at BIGINT NOT NULL, deadline BIGINT NOT NULL, receipt_cutoff BIGINT NOT NULL, created_at BIGINT NOT NULL, activated_at BIGINT DEFAULT NULL, terminal_at BIGINT DEFAULT NULL, reason VARCHAR(64) DEFAULT NULL, UNIQUE (account_id, preview_id), UNIQUE (account_id, id), FOREIGN KEY (account_id, preview_id) REFERENCES oath_preview(account_id, id) ON DELETE CASCADE)");
        $this->addSql('CREATE TABLE oath_acceptance_request (account_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE, request_id UUID NOT NULL, preview_id UUID NOT NULL, oath_id UUID NOT NULL, PRIMARY KEY (account_id, request_id), FOREIGN KEY (account_id, preview_id) REFERENCES oath_preview(account_id, id) ON DELETE CASCADE, FOREIGN KEY (account_id, oath_id) REFERENCES oath(account_id, id) ON DELETE CASCADE)');
        $this->addSql('ALTER TABLE oath_preview ADD CONSTRAINT oath_preview_commitment FOREIGN KEY (account_id, oath_id) REFERENCES oath(account_id, id) DEFERRABLE INITIALLY DEFERRED');
        $this->addSql('CREATE INDEX oath_today_order ON oath (account_id, deadline, id)');
        $this->addSql('CREATE INDEX oath_history_order ON oath (account_id, terminal_at DESC, id DESC)');
    }
    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE oath_preview DROP CONSTRAINT oath_preview_commitment');
        $this->addSql('DROP TABLE oath_acceptance_request');
        $this->addSql('DROP TABLE oath');
        $this->addSql('ALTER TABLE oath_preview DROP CONSTRAINT oath_preview_owner_id');
    }
}
