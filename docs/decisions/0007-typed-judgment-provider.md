# ADR 0007: Typed judgment provider for the AI referee

Status: processor accepted, layer proposed, 2026-09-28. The owner approved TypeSafe as a data processor on 2026-09-28. The pipeline design below remains a proposal until the evaluation gate passes. Nothing here is implemented.

## Context

MVP-08 needs evidence assessments that end in `accepted`, `rejected` or `unclear` under the accepted [first-loop rules](../product/first-loop.md). The [AI policy](../engineering/ai-verification.md) forbids model text from changing rules or state and requires an evaluation gate before automated outcomes. A single vision model that reads the image and decides the verdict mixes transcription, rule judgment and date logic in one free-form answer.

TypeSafe Jev returns typed answers: Choice, Noul and Score, with probabilities. It takes text only and has no image input. It reads dates as text, is weak at math and can be steered by adversarial state. English is its primary language. **Sources: [API](https://docs.typesafe.ai/api.md), [models](https://docs.typesafe.ai/models.md), [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md), reviewed 2026-09-28.**

## Decision

Proposed: add Jev as a typed judgment layer after evidence transcription, for the activity-record route only. The [pipeline and routing](../engineering/ai-verification.md#proposed-typed-judgment-layer-typesafe-jev) define the detail:

- Code runs hard checks first: ownership, receipt window, claim link, size and format.
- The existing planned vision provider transcribes the image into untrusted text. Jev never sees the image.
- Code over-finds candidate spans. Jev picks one or `none` and answers one Noul per rule criterion. Code normalizes the picked span, resolves the T02 offset and compares with `D`.
- Thresholds are placeholders set by evaluation per pinned model version. Low confidence or conflicting answers become `unclear`, never a miss.
- Provider errors stay infrastructure outcomes under the accepted T03 retry and review schedule.
- The key stays server-side in `TYPESAFE_API_KEY`. The audit record stores versions and typed answers, never proof text in logs.

Processor approval is an accepted owner decision, 2026-09-28. The context-photo route has a [proposed design](../engineering/ai-verification.md#proposed-context-photo-route) awaiting owner choice. The model upgrade procedure remains open.

## Consequences

Jev can only select among code-found spans, so it cannot invent a timestamp. Date comparison and arithmetic stay testable in code. Typed probabilities give the evaluation a direct threshold to tune.

Proof text would reach a second processor next to the vision provider. TypeSafe offers zero data retention only on enterprise plans and states it does not train on customer data. The owner approved this processor on 2026-09-28. Real player proofs still wait for a passed evaluation gate. Two provider calls per attempt add latency and failure points within the 15-minute escalation limit. Polish accuracy is unproven. The listed price ($0.042 per million input tokens, reviewed 2026-09-28) is not a verified budget.

The owner resolved the companion conflict on 2026-09-28: live model wording is allowed for reminders, upcoming deadline notifications and motivating messages. See the [companion brief](../art/companion.md#persona-and-authority).

If rejected, the referee keeps the single-provider plan in the [architecture](../engineering/architecture.md#boundaries). The AI policy section would then be marked as a rejected proposal.
