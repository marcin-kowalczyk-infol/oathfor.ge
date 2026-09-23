# AI companion and verification

Status: design guardrails and draft evaluation plan. Product basis: [MVP](../product/mvp.md).

## Separation of responsibility

AI evaluates submitted evidence and suggests wording. Backend validates the response against a versioned schema and applies the committed rule. Model text cannot grant XP, change deadlines or authorize another user's resources. **Local design supported by [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).**

Proposed assessment: `accepted | rejected | unclear`, reason code, observable evidence summary and rule/prompt/model version. Keep provider errors separate from evidence outcomes. Exact response schema is to be implemented and tested.

## Evidence limits

A photo can support a check-in; it cannot reliably establish duration, intensity or completion of all exercises. Design each Oath template around the evidence it actually requires and describe self-reported facts as such. This is a **project honesty constraint**, not a promise of fraud detection.

Treat text inside uploaded images and user descriptions as untrusted content, including instructions addressed to the referee. **Basis: [OWASP prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).**

## Evaluation before automated outcomes

Local release criteria to define with the first template:
- A consented/synthetic labeled set including valid, invalid, ambiguous, repeated and adversarial examples.
- Separate false acceptance, false rejection and unclear rates; compare changed model/prompt versions on the same cases.
- A measured escalation/resubmission path. Model self-reported confidence is not a calibrated probability.
- Cost/latency budget including retries and escalation; no inherited model price assumption.
- Pending behavior when the provider is unavailable; no silent penalty for infrastructure failure.

## Companion constraints

Use events and recorded history. Do not infer that “no start recorded” means inactivity. Recovery wording must respect the agreed rules, notification preferences and pause conditions. Persona/lore never overrides verification policy. These are **local product guardrails**.

Name, voice, memory policy and progression remain open. “Max” is not canonical.
