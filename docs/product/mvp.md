# MVP and loop specification

Status: draft for refinement; not a final release commitment. Product source: [ADR 0001](../decisions/0001-project-foundation.md).

## Accepted platform scope

**Local decision: owner instruction, 2026-09-24.** The MVP targets iOS only. Android delivery and acceptance are deferred; existing Android scaffold/export evidence does not imply a release commitment. iOS scope does not select a workout app, watch or screenshot layout.

## Accepted language scope

Polish and English are required across the MVP player experience. Copy may be adapted naturally in each language, but mechanics and acceptance conditions must remain equivalent. Slavic-inspired terminology follows the [language and naming rules](glossary.md#language-and-naming-rules). **Local decision: owner instruction, 2026-09-23.** The diagnostic shell has centralized Polish/English copy; product localization is not implemented. Follow the [translation storage contract](glossary.md#translation-storage-and-runtime-contract).

## Accepted first Oath evidence contract

**Owner decision, 2026-09-24:** [Trial of the Spark / Próba Iskry](first-loop.md) is the initiation task. Completion is declared by the player and supported by contextual photo or activity record, selected at submission under precommitted alternatives. Images do not independently prove completion. Apple Fitness workout details are an evaluation candidate; real PL/EN layouts remain unverified. The [time policy](first-loop.md#time-policy) is accepted: finish by the committed deadline and complete first receipt within 15 minutes, with inclusive boundaries and immutable timezone rules. The [resolution policy](first-loop.md#resolution-table) is accepted, including two corrections in a single 24-hour window, bounded provider retries, review and neutral unresolved closure. The [progression and Recovery contract](first-loop.md#progression-and-recovery) specifies accepted initial rewards, bonus upgrades, activity reuse and five-level thresholds.

## Accepted progression direction

**Local decision: owner approval, 2026-09-23.** Reward fulfillment of the committed Oath with base XP plus one capped evidence-tier bonus. Use the highest qualifying tier, not the number of submitted files: a context photo and an activity-result record have separate criteria. Neither tier proves authenticity or independently establishes workout quality.

- Additional images of the same activity do not stack bonuses. An accepted upgrade awards only the difference; repeated processing cannot award it again.
- Define minimum fulfillment evidence separately from bonus eligibility. Failure to qualify for a higher bonus does not invalidate an otherwise fulfilled Oath.
- Defer calorie, step and distance-to-XP conversions. Initial progression rewards fulfillment and supporting evidence, without direct activity-provider integrations.
- Each level requires more XP than the previous level, with a gentle initial curve. Each level gives a small character unlock; milestone levels provide larger visual changes. Show the next unlock before it is earned.
- **Owner approval, 2026-09-24:** initial values are 30 base XP plus highest 10/20 evidence bonus; one delta-only upgrade within 24 hours; no activity reuse between commitments. Levels 1–5 use total thresholds 0/100/250/450/700. The [full contract](first-loop.md#progression-and-recovery) defines one 15 XP Recovery and exact windows; real unlock artwork remains pending.

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

## Accepted first-loop state policy

[The first-loop resolution table](first-loop.md#resolution-table) is authoritative for MVP-01 (owner approval, 2026-09-24). Normal evidence progression is `scheduled → active → proof_pending → fulfilled`. Corrections use `needs_more_evidence`; operational escalation uses `review_pending`. Terminal outcomes are `fulfilled`, `missed`, neutral `unresolved`, and voluntary `withdrawn` under the accepted [pause policy](first-loop.md#pause-and-alternatives) (owner approval, 2026-09-24).

A rejected/unclear assessment does not itself mean a miss. Timely proof retains eligibility during delayed analysis. Provider/operator non-response follows the bounded review policy and may close neutrally without XP, a miss or Recovery eligibility. Recovery is the separate post-miss flow specified in T04, preserving the original miss. These are accepted specifications, not implemented product states.

## Domain guardrails

These are project design rules, not externally demonstrated behavioral claims:
- Backend is authoritative for state, deadlines, XP and eligibility.
- Snapshot the agreed rule before activation. A minimum alternative must be pre-agreed; Recovery Quest is a separate post-failure path.
- Do not erase all accumulated progression for one missed Oath.
- No real-money penalties in the initial scope.
- AI recommendations cannot change entitlement or reward records directly.
- Show distinct fulfilled, missed and recovered history.
- No automatic sharing of proof images to squad members.
- Do not turn illness/injury disclosures into pressure to exercise. The accepted pause policy withdraws eligible commitments without proof, preserves pending evidence, suppresses reminders and does not require medical documentation. Minimum Quest is deferred beyond the first loop (owner approval, 2026-09-24).

Basis: project intent in [ADR 0001](../decisions/0001-project-foundation.md). Reliability implementation: [Messenger idempotency](https://symfony.com/doc/7.4/messenger.html#writing-idempotent-handlers).

## Proposed screens

Onboarding → Today/Oath detail → Capture proof → Pending/result → Recovery → Squad/progress. Settings must include notification preferences and data/account controls.

## Deferred scope

Calorie counting, workout programming, open-ended chatbot, voice, GPS/Health/Strava integrations, PvP, public feed, marketplace and complex equipment systems. Changes are possible but must explicitly revise scope.
