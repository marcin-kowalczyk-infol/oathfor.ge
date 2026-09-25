# Creating and tracking original Oaths

Status: accepted creation choices; implementation contract recorded 2026-09-25, strict deadline resolution and immutable preview endpoints are implemented; atomic explicit commitment creation is implemented; owner-only detail/Today/history queries are implemented; durable activation and unknown-availability cutoff transitions are implemented. Pause and mobile commitment screens remain pending. Sources: owner decisions D05-01/D05-02 (2026-09-25), [first-loop rules](first-loop.md), [onboarding handoff](onboarding.md). API representation and serialization below are local engineering decisions for MVP-05, not additional workout requirements.

## Choices and explicit acceptance

A server-complete solo account selects one activity, activation now or at a future local date/time, and a separately selected, strictly later completion deadline. No recurrence, concurrent-Oath quota, scheduling horizon, duration or intensity minimum is introduced.

| Stable ID / choice | Polish | English |
| --- | --- | --- |
| `running` | Bieganie | Running |
| `strength_training` | Trening siłowy | Strength training |
| `mobility` | Mobilność | Mobility |
| `now` | Teraz | Now |
| `scheduled` | W wybranym terminie | At a chosen time |
| Completion deadline | Ukończ trening do | Complete your workout by |
| First receipt cutoff | Prześlij kompletny dowód do | Submit complete evidence by |
| Confirmation | Przyjmuję zasady i składam Przysięgę | I accept the rules and make this Oath |

The preview shows the activity, activation choice, completion deadline D, receipt cutoff S=D+15 minutes, committed timezone and explicit offset for repeated local times. It shows both evidence alternatives, required completion declaration, evidence limitations, 40/50 total XP policy, no existing-XP loss for a miss, separate 15 XP Recovery rules, and pause/withdrawal consequences. Use the complete accepted [bilingual copy and rules](first-loop.md#bilingual-implementation-copy-handoff), with versioned equivalent Polish and English text retained in the snapshot. A later language change selects the stored translation; it cannot load revised policy text for an old commitment.

A preview creates no commitment and activates nothing. Only explicit confirmation of that preview creates an original Oath. Accepting `now` means the server time sampled after transaction locks and authorization checks; the preview says this rather than promising the device's current instant. D must still be later at confirmation. For a future start that has arrived during confirmation, return a recoverable conflict: preserve the old preview, create nothing and ask the player to select/review a new start. Do not convert it to `now`, move D or silently activate a backdated commitment.

A lost confirmation response is reconciled with the same preview and retry identity. Existing success wins over later policy changes, pause or elapsed times, subject to current authentication; replay returns the original commitment and its current authoritative state. A new confirmation against a superseded policy requires a fresh preview and explicit acceptance. Two distinct previews may create two distinct commitments; a retry of one preview cannot.

## Time and immutability

Use the [strict local-time API contract](../engineering/api-contract.md#original-oath-contract). Reject nonexistent local times and ask for an explicit valid offset when the selected time occurs twice. Preserve resolved UTC instants, IANA identifier, original local input and resolved offset. Account/device timezone or locale changes cannot move those instants. `now` preserves the selected deadline zone and the corresponding server activation local value/offset.

The accepted snapshot contains the template/catalog version, activity, activation, D/S, both evidence contracts, reward and consequence amounts/conditions, correction/review/appeal/Recovery/pause policies, and bilingual rule text. Rule edits are not supported; a changed promise requires a new acceptance. History and detail use this snapshot even after a template is retired. No proof, XP, Recovery creation or supported Apple Fitness layout is implemented by this epic contract.

## Today, detail, history and pause

Today includes all nonterminal commitments, including future scheduled and overdue pending work. Sort by D then ID; use sections for future scheduled, current scheduled/active and pending evidence/review. Group dates in each commitment's stored zone and label that zone; never hide overdue work just because the current device date changed. Empty, loading, failure and retry states are explicit. Backend responses alone determine state; a device countdown cannot declare failure.

Detail exposes only the authenticated owner's immutable rules and current state. History includes terminal originals (`fulfilled`, `missed`, `unresolved`, `withdrawn`) ordered by terminal timestamp then ID descending. Separate linked Recovery and amendments remain later integration work; never replace the original miss with a fabricated success or infer awarded XP from a policy amount.

Pause is global and needs explicit confirmation of the current affected list. Reconcile elapsed cutoffs before classifying commitments for withdrawal. Scheduled/active commitments without finalized proof at or before S become withdrawn; overdue no-proof cases follow the existing service-availability review rules. Pending evidence/review keeps its clocks. Resume only clears pause. Paused accounts can read/reconcile existing commitments but cannot create new ones. [First-loop pause rules](first-loop.md#pause-and-alternatives) govern later receipt, outcome and notification races.

## Durable reconciliation and acceptance limits

The mechanism is recorded in [ADR 0004](../decisions/0004-oath-acceptance-and-reconciliation.md). Persist activation and cutoff instants in PostgreSQL. Select a bounded `app:oath:reconcile --limit=100` command plus reconciliation during protected reads and pause/confirmation transactions. A deployment timer must eventually invoke the command; Messenger timers alone are not durable authority. Serialize by account, then session when present, then Oaths in ID order. Sample authoritative time after locks; recheck state and authorization there. Repeat runs have no duplicate transition effects.

When a scheduled commitment is already overdue, reconcile activation then cutoff in the same transaction. Availability remains `unknown` until a real evidence-backed availability subsystem exists: after S route missing-receipt cases to `review_pending` with `service_availability_unknown`, never `missed` merely because this server is responding. Persist review entry and closure instants for the MVP-08/09 review owner. That owner must evaluate elapsed timers before decisions; this slice must not invent terminal resolution or rewards. A late reconciliation does not move D/S or backdate a receipt.

The command, reads and pause share one domain transition service. Receipt finalization and downstream settlement must join the same serialization boundary in MVP-07–10. Full receipt/pause, healthy-service misses, review closure and Recovery acceptance remain pending until those implementations exist. Operational scheduling and signed iOS PL/EN VoiceOver/Dynamic Type acceptance also remain release gates.
