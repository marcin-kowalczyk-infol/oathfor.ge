<?php

declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261001100000 extends AbstractMigration
{
    public function getDescription(): string { return 'Record proof submissions bound to the owning account, character and Oath.'; }
    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE proof_submission (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL, character_id UUID NOT NULL, oath_id UUID NOT NULL, submission_id UUID NOT NULL, revision SMALLINT NOT NULL CHECK (revision >= 1), mode VARCHAR(16) NOT NULL CHECK (mode IN ('photo', 'activity_record')), declaration_confirmed BOOLEAN NOT NULL CHECK (declaration_confirmed), content_sha256 CHAR(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'), storage_key CHAR(32) NOT NULL CHECK (storage_key ~ '^[0-9a-f]{32}$'), received_at BIGINT NOT NULL, assessment_status VARCHAR(16) NOT NULL CHECK (assessment_status IN ('queued')), created_at BIGINT NOT NULL, CONSTRAINT proof_submission_request UNIQUE (account_id, submission_id), CONSTRAINT proof_submission_revision UNIQUE (oath_id, revision), CONSTRAINT proof_submission_storage_key UNIQUE (storage_key), CONSTRAINT proof_submission_character FOREIGN KEY (account_id, character_id) REFERENCES player_character (account_id, id) ON DELETE CASCADE, CONSTRAINT proof_submission_oath FOREIGN KEY (account_id, oath_id) REFERENCES oath (account_id, id) ON DELETE CASCADE)");
    }
    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE proof_submission');
    }
}
