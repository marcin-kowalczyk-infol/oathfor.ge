# ADR 0004: Immutable Oath acceptance and durable reconciliation

Status: accepted local engineering decision, 2026-09-25; preview/acceptance/read/pause reconciliation implemented; downstream receipt/settlement integration and operational scheduling pending.

## Context

[First-loop rules](../product/first-loop.md) require accepted immutable rules, server-owned activation and cutoff handling, and serialization with pause and finalized receipts. A response can be lost after acceptance; a delayed worker must not move deadlines or assume healthy submission service. The [architecture](../engineering/architecture.md#reliability-rules) requires persisted deadlines and a selected reconciliation mechanism before implementation.

## Decision

Store owner-owned immutable rule previews, then atomically copy accepted rules into a commitment with unique owner/preview and owner/request identities. Identical retry returns the same commitment even after policy replacement; new acceptance of a replaced policy requires explicit review. Persist both Polish and English rule text alongside policy data so new templates cannot reinterpret old commitments.

Persist due UTC instants in PostgreSQL. One transition service is invoked by a bounded reconciliation command and protected reads/pause. Serialize account first, session when present, then affected Oaths in ID order; recheck authorization and clock after locks. The command is an eventual catch-up mechanism, not an exact-time availability promise. Deployment must separately schedule and monitor it. No new Scheduler dependency or queue-only timer is selected.

Until real availability evidence exists, missing-receipt cutoffs use unknown availability and enter review. MVP-07–10 must integrate receipt finalization, review clocks and settlement under the same boundary. MVP-05 does not manufacture healthy-service misses or terminal review decisions.

## Consequences

Lost responses are recoverable without duplicate commitments. Stored previews and bilingual snapshots require storage and account-deletion cleanup. Account serialization simplifies cross-Oath pause and receipt ordering at the cost of per-account concurrency. Read reconciliation can write due state and must use the same transaction tests as the command. An operational timer and downstream review/receipt integration remain acceptance gates.

The [API contract](../engineering/api-contract.md#original-oath-contract) defines endpoint behavior. These are local design choices under the existing product rules, the API contract records implemented endpoints separately from pending integrations and operational scheduling.
