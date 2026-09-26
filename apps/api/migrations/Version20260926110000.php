<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260926110000 extends AbstractMigration
{
    public function getDescription(): string { return 'Bind Oath previews and Oaths to one player character of the same account.'; }
    public function up(Schema $schema): void
    {
        // Local test data only. Immediate checks leave no pending trigger events before the ALTER statements.
        $this->addSql('SET CONSTRAINTS oath_preview_commitment IMMEDIATE');
        $this->addSql('DELETE FROM oath_acceptance_request');
        $this->addSql('UPDATE oath_preview SET oath_id = NULL');
        $this->addSql('DELETE FROM oath');
        $this->addSql('DELETE FROM oath_preview');
        $this->addSql('ALTER TABLE oath_preview ADD character_id UUID NOT NULL');
        $this->addSql('ALTER TABLE oath_preview ADD CONSTRAINT oath_preview_character FOREIGN KEY (account_id, character_id) REFERENCES player_character (account_id, id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE oath_preview ADD CONSTRAINT oath_preview_owner_character UNIQUE (account_id, id, character_id)');
        $this->addSql('ALTER TABLE oath ADD character_id UUID NOT NULL');
        $this->addSql('ALTER TABLE oath ADD CONSTRAINT oath_character FOREIGN KEY (account_id, character_id) REFERENCES player_character (account_id, id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE oath ADD CONSTRAINT oath_preview_character_binding FOREIGN KEY (account_id, preview_id, character_id) REFERENCES oath_preview (account_id, id, character_id) ON DELETE CASCADE');
        $this->addSql('DROP INDEX oath_today_order');
        $this->addSql('DROP INDEX oath_history_order');
        $this->addSql('CREATE INDEX oath_today_order ON oath (character_id, deadline, id)');
        $this->addSql('CREATE INDEX oath_history_order ON oath (character_id, terminal_at DESC, id DESC)');
    }
    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX oath_today_order');
        $this->addSql('DROP INDEX oath_history_order');
        $this->addSql('ALTER TABLE oath DROP CONSTRAINT oath_preview_character_binding, DROP CONSTRAINT oath_character, DROP character_id');
        $this->addSql('ALTER TABLE oath_preview DROP CONSTRAINT oath_preview_owner_character, DROP CONSTRAINT oath_preview_character, DROP character_id');
        $this->addSql('CREATE INDEX oath_today_order ON oath (account_id, deadline, id)');
        $this->addSql('CREATE INDEX oath_history_order ON oath (account_id, terminal_at DESC, id DESC)');
    }
}
