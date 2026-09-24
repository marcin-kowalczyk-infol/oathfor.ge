<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260924220000 extends AbstractMigration
{
    public function getDescription(): string { return 'Persist guarded provider maintenance reservations and deletion revocation deadlines.'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE account ADD deletion_requested_at BIGINT DEFAULT NULL');
        $this->addSql("ALTER TABLE provider_identity ADD credential_generation BIGINT NOT NULL DEFAULT 0, ADD validation_due_at BIGINT DEFAULT NULL, ADD revocation_due_at BIGINT DEFAULT NULL, ADD maintenance_claim UUID DEFAULT NULL, ADD revocation_status VARCHAR(16) NOT NULL DEFAULT 'none' CHECK (revocation_status IN ('none', 'pending', 'confirmed', 'unresolved')), ADD maintenance_outcome VARCHAR(32) DEFAULT NULL CHECK (maintenance_outcome IN ('valid', 'invalid_grant', 'unavailable', 'revoked', 'revocation_unresolved', 'legacy_deletion_unknown'))");
        $this->addSql('UPDATE provider_identity p SET validation_due_at = COALESCE((SELECT MAX(s.issued_at) FROM app_session s WHERE s.account_id = a.id), a.created_at) + 86400 FROM account a WHERE a.id = p.account_id AND p.refresh_envelope IS NOT NULL');
        // Earlier schema retained no deletion timestamp; account creation is a conservative lower bound, not a recovered request time.
        $this->addSql("UPDATE account SET deletion_requested_at = created_at WHERE status IN ('deleting', 'deleted')");
        $this->addSql("UPDATE provider_identity p SET revocation_status = 'pending', revocation_due_at = 0, validation_due_at = NULL, maintenance_outcome = 'legacy_deletion_unknown' FROM account a WHERE a.id = p.account_id AND a.deletion_requested_at IS NOT NULL AND p.refresh_envelope IS NOT NULL");
        $this->addSql('CREATE INDEX provider_identity_validation_due ON provider_identity (validation_due_at)');
        $this->addSql('CREATE INDEX provider_identity_revocation_due ON provider_identity (revocation_due_at)');
    }
    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX provider_identity_validation_due');
        $this->addSql('DROP INDEX provider_identity_revocation_due');
        $this->addSql('ALTER TABLE provider_identity DROP credential_generation, DROP validation_due_at, DROP revocation_due_at, DROP maintenance_claim, DROP revocation_status, DROP maintenance_outcome');
        $this->addSql('ALTER TABLE account DROP deletion_requested_at');
    }
}
