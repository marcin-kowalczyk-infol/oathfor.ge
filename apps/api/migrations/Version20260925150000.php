<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260925150000 extends AbstractMigration
{
    public function getDescription(): string { return 'Persist owner-owned immutable Oath previews and gameplay pause state.'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE account ADD gameplay_paused BOOLEAN NOT NULL DEFAULT FALSE');
        $this->addSql('CREATE TABLE oath_preview (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE, snapshot TEXT NOT NULL, created_at BIGINT NOT NULL, oath_id UUID DEFAULT NULL)');
        $this->addSql('CREATE INDEX oath_preview_owner ON oath_preview (account_id)');
    }
    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE oath_preview');
        $this->addSql('ALTER TABLE account DROP gameplay_paused');
    }
}
