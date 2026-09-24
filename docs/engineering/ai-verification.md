# AI companion and verification

Status: design guardrails and draft evaluation plan. Product basis: [MVP](../product/mvp.md).

## Separation of responsibility

AI evaluates submitted evidence and suggests wording. Backend validates the response against a versioned schema and applies the committed rule. Model text cannot grant XP, change deadlines or authorize another user's resources. **Local design supported by [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).**

Proposed assessment: `accepted | rejected | unclear`, reason code, observable evidence summary and rule/prompt/model version. Keep provider errors separate from evidence outcomes. The accepted [resolution contract](../product/first-loop.md#resolution-table) bounds retries and correction windows and routes unresolved infrastructure/evidence cases to review with neutral closure; it does not constitute a running review service. Exact response schema is to be implemented and tested.

## Evidence limits

A photo can support a check-in; it cannot reliably establish duration, intensity or completion of all exercises. Design each Oath template around the evidence it actually requires and describe self-reported facts as such. This is a **project honesty constraint**, not a promise of fraud detection.

The accepted [first-loop evidence contract](../product/first-loop.md) separates contextual photographs from activity records and self-reported completion. Apple Fitness layouts remain candidates until real examples and PL/EN evaluations pass; the synthetic `DUMMY Activity` case cannot demonstrate compatibility. **Local decision: owner instruction, 2026-09-24.**

Treat text inside uploaded images and user descriptions as untrusted content, including instructions addressed to the referee. **Basis: [OWASP prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).**

## Accepted review and evidence lifecycle

The [first-loop review and retention policy](../product/first-loop.md#review-and-retention) is accepted (owner approval, 2026-09-24): one terminal appeal within 7 days, 72-hour response limit, private evidence retained through pending cases and for 30 days after final related closure. Explicit deletion takes precedence, with immediate controlled access revocation and live purge within 7 days; metadata backup/restore controls follow the contract. No real-proof collection is ready until operator tooling, provider/storage retention and deletion/restore tests are verified in MVP-08/14. These are local product rules, not a legal-compliance claim.

## Evaluation before automated outcomes

Local release criteria to define with the first template:
- A consented/synthetic labeled set including valid, invalid, ambiguous, repeated and adversarial examples.
- Separate false acceptance, false rejection and unclear rates; compare changed model/prompt versions on the same cases.
- A measured escalation/resubmission path. Model self-reported confidence is not a calibrated probability.
- Cost/latency budget including retries and escalation; no inherited model price assumption.
- Pending behavior when the provider is unavailable; no silent penalty for infrastructure failure.

## Companion constraints

Use events and recorded history. Do not infer that “no start recorded” means inactivity. Recovery wording must respect the agreed rules, notification preferences and pause conditions. Persona/lore never overrides verification policy. These are **local product guardrails**.

The [Żaromir / Zharomir starting brief](../art/companion.md), including name and written persona, is accepted for visual refinement (owner decision, 2026-09-24). Voice/audio is outside the current scope; memory policy remains open; selected static progression assets are recorded in the [manifest](../art/companion-assets.md), with runtime/native acceptance pending. Reward/Recovery mechanics and initial level thresholds follow the accepted [T04 contract](../product/first-loop.md#progression-and-recovery). “Max” is not canonical.
