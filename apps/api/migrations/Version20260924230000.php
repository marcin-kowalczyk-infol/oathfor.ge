<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260924230000 extends AbstractMigration
{
    public function getDescription(): string { return 'Persist explicitly confirmed account onboarding profile choices.'; }
    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE account_profile (account_id UUID PRIMARY KEY REFERENCES account(id), locale VARCHAR(2) DEFAULT NULL CHECK (locale IN ('pl', 'en')), timezone VARCHAR(128) DEFAULT NULL, intention VARCHAR(32) DEFAULT NULL CHECK (intention = 'regular_activity'), companion_introduced BOOLEAN NOT NULL DEFAULT FALSE, notification_preference VARCHAR(8) DEFAULT NULL CHECK (notification_preference IN ('enabled', 'disabled')))");
    }
    public function down(Schema $schema): void { $this->addSql('DROP TABLE account_profile'); }
}
