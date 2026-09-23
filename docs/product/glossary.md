# Product glossary and localization

Status: working terminology; Oathforge and Oath are established, remaining labels may change. Source: [ADR 0001](../decisions/0001-project-foundation.md).

| Term | Meaning |
| --- | --- |
| Oath | Commitment with a deadline and agreed evidence |
| Proof | Evidence submitted for an Oath |
| Verification | Assessment against the agreed evidence requirement |
| Companion | Player-facing AI character |
| Referee | Evidence-assessment role, not a separate required character |
| Squad | Private group sharing progress |
| Recovery Quest | Follow-up after a missed Oath |
| Minimum Quest | Optional pre-agreed smaller alternative before the deadline |
| Trial | Candidate label for a time-bounded challenge |
| XP | Experience points; tuning undecided |
| Renown | Candidate lore/progression term; not yet a separate currency |
| Fulfilled / Missed / Recovered | Distinct outcomes; recovery does not rewrite history |

Use plain action labels such as “Submit proof” and “Start recovery.” Preserve distinctive world names where useful, with short explanations. Do not introduce lore names as hidden synonyms for core actions. **Local product convention: [art direction](../art/art-bible.md).**

## Language and naming rules

**Accepted local decision: owner instruction, 2026-09-23.** MVP supports Polish (`pl`) and English (`en`). This is a product requirement, not implemented localization. Code identifiers and engineering prose remain English; player-facing copy and terminology have Polish and English forms.

- Cover the full MVP experience in both languages: onboarding, Oath rules, actions, states, errors, notifications, companion messages and recovery. Neither language is a partial demonstration.
- Localize for natural phrasing, tone and rhythm; literal one-to-one translation is not required. Preserve the same commitment, evidence requirement, deadline, consequence, reward and available actions in both languages.
- Draw names, imagery and narrative language from Slavic legends and folklore where relevant. Record sources for specific traditional references, distinguish regional variants, and label invented lore as original. Do not present invented names as historical traditions.
- Keep each concept's meaning stable across locales. When selecting a player-facing term, record its Polish and English forms here, with its meaning and accepted/proposed status. The English terms above are domain references, not a finalized bilingual copy catalog.
- Lore names may differ between languages to sound natural. Pair evocative titles with clear requirements; narrative wording cannot obscure or change mechanics.
- Review each player-facing feature in both languages for natural wording, terminology consistency, equivalent rules and readable layout before calling localization complete. Exact terminology and language-selection behavior remain to be specified.

These rules govern product specification, implementation and content generation. They do not select an internationalization library or approve any previously proposed Oath title.
