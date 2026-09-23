# MVP and loop specification

Status: draft for refinement; not a final release commitment. Product source: [ADR 0001](../decisions/0001-project-foundation.md).

## Accepted language scope

Polish and English are required across the MVP player experience. Copy may be adapted naturally in each language, but mechanics and acceptance conditions must remain equivalent. Slavic-inspired terminology follows the [language and naming rules](glossary.md#language-and-naming-rules). **Local decision: owner instruction, 2026-09-23.** Localization is not implemented yet.

## Accepted progression direction

**Local decision: owner approval, 2026-09-23.** Reward fulfillment of the committed Oath with base XP plus one capped evidence-tier bonus. Use the highest qualifying tier, not the number of submitted files: a context photo and an activity-result record have separate criteria. Neither tier proves authenticity or independently establishes workout quality.

- Additional images of the same activity do not stack bonuses. An accepted upgrade awards only the difference; repeated processing cannot award it again.
- Define minimum fulfillment evidence separately from bonus eligibility. Failure to qualify for a higher bonus does not invalidate an otherwise fulfilled Oath.
- Defer calorie, step and distance-to-XP conversions. Initial progression rewards fulfillment and supporting evidence, without direct activity-provider integrations.
- Each level requires more XP than the previous level, with a gentle initial curve. Each level gives a small character unlock; milestone levels provide larger visual changes. Show the next unlock before it is earned.
- Exact XP values, thresholds, unlock catalog, upgrade window and cross-Oath activity-reuse rules remain to be specified. The example of 30 base XP plus a 10 or 20 XP bonus is a balancing proposal, not a frozen rule.

This extends the initial single-upgrade production scope into small per-level unlocks, not a new full character design for every level. Implementation belongs to MVP-03/09; policy definition belongs to MVP-01. No progression runtime or artwork unlocks exist yet.

## Proposed smallest complete loop

| Step | Player/system action | Acceptance example |
| --- | --- | --- |
| Commit | Choose a concrete activity, deadline and proof requirement | Player sees the rule, consequence and recovery option before confirming |
| Activate | Backend activates the scheduled Oath | Repeated job delivery does not create duplicate Oaths |
| Intervene | Companion reacts before the deadline | Message says “no start recorded,” not “you are not training” |
| Submit | Player uploads proof privately | Retry does not create duplicate rewards |
| Verify | AI returns accepted, rejected or unclear evidence assessment | Unclear evidence offers a defined next step |
| Resolve | Backend applies the rule and reward/consequence | Concurrent callbacks cannot settle the same result twice |
| Recover | Player takes a linked Recovery Quest | Original failure remains visible; recovery earns its own defined outcome |
| Team progress | Eligible results contribute to squad objective | Joining a squad is optional for first-use value |

## Proposed state model

`scheduled → active → proof_pending → fulfilled`

Alternative routes:
- `active → missed → recovery_available → recovered`
- `proof_pending → needs_more_evidence → proof_pending`
- Rejected evidence may permit resubmission under the original deadline/grace policy; otherwise it resolves as missed.
- Provider errors remain pending/retryable, with an operational escalation path.

Names and time policies must be finalized before implementation. A timely submitted proof is not failed merely because the queue completes after the deadline.

## Domain guardrails

These are project design rules, not externally demonstrated behavioral claims:
- Backend is authoritative for state, deadlines, XP and eligibility.
- Snapshot the agreed rule before activation. A minimum alternative must be pre-agreed; Recovery Quest is a separate post-failure path.
- Do not erase all accumulated progression for one missed Oath.
- No real-money penalties in the initial scope.
- AI recommendations cannot change entitlement or reward records directly.
- Show distinct fulfilled, missed and recovered history.
- No automatic sharing of proof images to squad members.
- Do not turn illness/injury disclosures into pressure to exercise; define pause handling during specification.

Basis: project intent in [ADR 0001](../decisions/0001-project-foundation.md). Reliability implementation: [Messenger idempotency](https://symfony.com/doc/7.4/messenger.html#writing-idempotent-handlers).

## Proposed screens

Onboarding → Today/Oath detail → Capture proof → Pending/result → Recovery → Squad/progress. Settings must include notification preferences and data/account controls.

## Deferred scope

Calorie counting, workout programming, open-ended chatbot, voice, GPS/Health/Strava integrations, PvP, public feed, marketplace and complex equipment systems. Changes are possible but must explicitly revise scope.
