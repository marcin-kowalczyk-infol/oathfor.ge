<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260924210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Persist accounts, unique provider identities and fixed-expiry opaque sessions.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE account (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleting', 'deleted')), onboarding_status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'complete')), created_at BIGINT NOT NULL)");
        $this->addSql('CREATE TABLE provider_identity (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES account(id), issuer VARCHAR(255) NOT NULL, subject VARCHAR(255) NOT NULL, refresh_envelope JSONB DEFAULT NULL, UNIQUE (issuer, subject))');
        $this->addSql('CREATE INDEX provider_identity_account ON provider_identity (account_id)');
        $this->addSql('CREATE TABLE app_session (token_digest CHAR(64) PRIMARY KEY, account_id UUID NOT NULL REFERENCES account(id), issued_at BIGINT NOT NULL, expires_at BIGINT NOT NULL CHECK (expires_at = issued_at + 2592000), revoked_at BIGINT DEFAULT NULL)');
        $this->addSql('CREATE INDEX app_session_account ON app_session (account_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE app_session');
        $this->addSql('DROP TABLE provider_identity');
        $this->addSql('DROP TABLE account');
    }
}
