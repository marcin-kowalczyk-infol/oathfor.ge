# ADR 0005: Oaths belong to player characters

Status: accepted by owner decision, 2026-09-26. Implemented in MVP-17-T02 to T05, 2026-09-26.

## Context

The owner wants several player characters per account, like save slots, each with its own Oaths, history and pause. [ADR 0004](0004-oath-acceptance-and-reconciliation.md) made Oaths account-owned and serialized every Oath write under the account row. Profile fields are all required for onboarding completion, so extending the profile would break completed accounts. See the [player character specification](../product/player-character.md).

## Decision

Characters are a separate server resource. Each Oath and preview carries a required character. The account stores one active character. List, detail and pause use the active character. Acceptance uses the character recorded on the preview, so a switch between preview and acceptance cannot move an Oath to another character. Pause state and its revision move from the account to the character.

Keep the account row as the serialization lock for character creation, switching and all Oath writes. This preserves ADR 0004 ordering with no new lock hierarchy. Onboarding completion stays unchanged. A missing active character is reported as `character_required`.

## Alternatives considered

- Character fields in the profile, required for completion. Rejected: completed accounts would become invalid and every profile client would change.
- Account-owned Oaths with a cosmetic character. Rejected by the owner, who wants separate paths per character.
- Character ID in every Oath URL. Not chosen: it changes every endpoint. The preview binding already protects acceptance.

## Consequences

Every Oath query gains a character filter and tests for foreign characters. A second device may show a stale active character until it reloads after a switch elsewhere. Each list reflects the server's active character at request time. Per-account serialization keeps character activity sequential, which is acceptable at MVP scale. Local test Oaths are removed in the migration because no production data exists.
