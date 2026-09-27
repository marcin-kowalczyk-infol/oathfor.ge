<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260927100000 extends AbstractMigration
{
    public function getDescription(): string { return 'Add the chosen thin or heavy build to each player character.'; }
    public function up(Schema $schema): void
    {
        // Existing characters become thin. The default exists only to fill them and is dropped at once.
        $this->addSql("ALTER TABLE player_character ADD build VARCHAR(16) NOT NULL DEFAULT 'thin'");
        $this->addSql('ALTER TABLE player_character ALTER build DROP DEFAULT');
        $this->addSql("ALTER TABLE player_character ADD CONSTRAINT player_character_build CHECK (build IN ('thin', 'heavy'))");
    }
    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE player_character DROP CONSTRAINT player_character_build, DROP build');
    }
}
