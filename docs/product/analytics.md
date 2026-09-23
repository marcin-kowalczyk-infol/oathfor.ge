# Analytics specification

Status: draft instrumentation plan; no analytics provider selected. Source: [product brief](brief.md).

## Proposed event catalog

`onboarding_completed`, `oath_committed`, `oath_activated`, `intervention_scheduled`, `intervention_sent`, `proof_submitted`, `verification_completed`, `oath_fulfilled`, `oath_missed`, `recovery_started`, `recovery_completed`, `squad_created`, `invite_accepted`, `entitlement_changed`.

Record an event ID, occurrence time, pseudonymous actor ID, Oath ID when needed, schema version and experiment assignment. Server-authoritative outcomes must come from backend state, not client success screens. Notification sent is not notification delivered or read. These are **local measurement conventions**.

## Draft metrics

| Metric | Definition to freeze before launch |
| --- | --- |
| Activation | New accounts completing their first valid Oath within the chosen window |
| D7 / D30 retention | Same signup cohort performing a qualifying core action on the named day; specify timezone and exact-day vs window |
| Verified Oaths / WAU | Fulfilled Oaths divided by users with a qualifying core action that week; report cohort and total too |
| Recovery conversion | Completed recoveries / eligible missed Oaths; also show recovery uptake |
| Completion after intervention | Eligible intervened Oaths later fulfilled / eligible intervened Oaths |
| Invite conversion | Unique accepted invitees / unique delivered invitations, when delivery is observable |

Completion after intervention is descriptive, not causal attribution. To estimate AI impact, predefine eligibility and randomized comparison with ordinary reminders; account for squad spillover, time windows and sample uncertainty. Alpha samples establish feasibility, not definitive effect size. **Local experimental-design proposal.**

Keep raw proof, free-text goals, model prompts and access URLs out of analytics. **Basis: [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).**
