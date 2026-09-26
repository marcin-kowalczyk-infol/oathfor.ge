<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260926100000 extends AbstractMigration
{
    public function getDescription(): string { return 'Persist account-owned player characters and the active character pointer.'; }
    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE player_character (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE, slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3), creation_request_id UUID NOT NULL, name VARCHAR(20) NOT NULL CHECK (char_length(name) BETWEEN 2 AND 20), preset_id VARCHAR(64) NOT NULL, form VARCHAR(16) NOT NULL CHECK (form IN ('masculine', 'feminine', 'neutral')), created_at BIGINT NOT NULL, CONSTRAINT player_character_slot UNIQUE (account_id, slot), CONSTRAINT player_character_request UNIQUE (account_id, creation_request_id), CONSTRAINT player_character_owner UNIQUE (account_id, id))");
        $this->addSql('ALTER TABLE account ADD active_character_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE account ADD CONSTRAINT account_active_character FOREIGN KEY (id, active_character_id) REFERENCES player_character (account_id, id)');
    }
    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE account DROP CONSTRAINT account_active_character');
        $this->addSql('ALTER TABLE account DROP active_character_id');
        $this->addSql('DROP TABLE player_character');
    }
}
