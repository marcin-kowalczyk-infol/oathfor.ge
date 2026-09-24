<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260924195000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Store one-use Apple login challenges and atomic authentication minute counters.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE login_challenge (id VARCHAR(43) PRIMARY KEY, nonce_digest CHAR(64) NOT NULL, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, consumed_at BIGINT DEFAULT NULL)');
        $this->addSql('CREATE INDEX login_challenge_expiry ON login_challenge (expires_at)');
        $this->addSql('CREATE TABLE auth_rate_bucket (route VARCHAR(64) NOT NULL, bucket VARCHAR(64) NOT NULL, minute BIGINT NOT NULL, attempts BIGINT NOT NULL, PRIMARY KEY (route, bucket, minute))');
        $this->addSql('CREATE INDEX auth_rate_bucket_minute ON auth_rate_bucket (minute)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE auth_rate_bucket');
        $this->addSql('DROP TABLE login_challenge');
    }
}
