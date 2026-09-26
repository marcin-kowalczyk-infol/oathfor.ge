<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260926120000 extends AbstractMigration
{
    public function getDescription(): string { return 'Move gameplay pause from the account to each player character.'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE player_character ADD paused BOOLEAN NOT NULL DEFAULT FALSE');
        $this->addSql('UPDATE player_character c SET paused = TRUE FROM account a WHERE a.id = c.account_id AND a.gameplay_paused');
        $this->addSql('ALTER TABLE account DROP gameplay_paused');
    }
    public function down(Schema $schema): void
    {
        // Local test data only. An account counts as paused when any of its characters was paused.
        $this->addSql('ALTER TABLE account ADD gameplay_paused BOOLEAN NOT NULL DEFAULT FALSE');
        $this->addSql('UPDATE account a SET gameplay_paused = TRUE WHERE EXISTS (SELECT 1 FROM player_character c WHERE c.account_id = a.id AND c.paused)');
        $this->addSql('ALTER TABLE player_character DROP paused');
    }
}
