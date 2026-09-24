# Product glossary and localization

Status: working terminology; Oathforge and Oath are established, remaining labels may change. Source: [ADR 0001](../decisions/0001-project-foundation.md).

| Term | Meaning |
| --- | --- |
| Oath / Przysięga | Accepted EN/PL commitment term; commitment with a deadline and agreed evidence (owner decision, 2026-09-24) |
| Trial of the Spark / Próba Iskry | Accepted EN/PL name of the first initiation task; the commitment itself remains an Oath (owner decision, 2026-09-24) |
| Proof | Evidence submitted for an Oath |
| Verification | Assessment against the agreed evidence requirement |
| Companion | Player-facing AI character |
| Referee | Evidence-assessment role, not a separate required character |
| Squad | Private group sharing progress |
| Recovery Quest | Follow-up after a missed Oath |
| Minimum Quest | Optional pre-agreed smaller alternative before the deadline |
| Trial | Candidate label for a time-bounded challenge |
| XP | Experience points; accepted initial amounts and level thresholds in [first-loop policy](first-loop.md#progression-and-recovery), owner approval 2026-09-24 |
| Renown | Candidate lore/progression term; not yet a separate currency |
| Fulfilled / Missed / Recovered | Distinct outcomes; recovery does not rewrite history |

Use plain action labels such as “Submit proof” and “Start recovery.” Preserve distinctive world names where useful, with short explanations. Do not introduce lore names as hidden synonyms for core actions. **Local product convention: [art direction](../art/art-bible.md).**

## Language and naming rules

**Accepted local decision: owner instruction, 2026-09-23.** MVP supports Polish (`pl`) and English (`en`). The diagnostic shell implements bilingual copy; full product localization remains a requirement. Code identifiers and engineering prose remain English; player-facing copy and terminology have Polish and English forms.

- Cover the full MVP experience in both languages: onboarding, Oath rules, actions, states, errors, notifications, companion messages and recovery. Neither language is a partial demonstration.
- Localize for natural phrasing, tone and rhythm; literal one-to-one translation is not required. Preserve the same commitment, evidence requirement, deadline, consequence, reward and available actions in both languages.
- Draw names, imagery and narrative language from Slavic legends and folklore where relevant. Record sources for specific traditional references, distinguish regional variants, and label invented lore as original. Do not present invented names as historical traditions.
- Keep each concept's meaning stable across locales. When selecting a player-facing term, record its Polish and English forms here, with its meaning and accepted/proposed status. The English terms above are domain references, not a finalized bilingual copy catalog.
- Lore names may differ between languages to sound natural. Pair evocative titles with clear requirements; narrative wording cannot obscure or change mechanics.
- Review each player-facing feature in both languages for natural wording, terminology consistency, equivalent rules and readable layout before calling localization complete. Exact terminology and language-selection behavior remain to be specified.

These rules govern product specification, implementation and content generation. They do not select an internationalization library or approve any previously proposed Oath title.

## Translation storage and runtime contract

**Local implementation requirements: owner instruction, 2026-09-24.** Store translations separately from UI and domain logic. The following conventions apply when product features are implemented; they do not claim a localization runtime already exists.

- Keep complete UTF-8 message catalogs for `pl` and `en`, with stable semantic keys grouped by feature, under `apps/mobile/src/localization/locales/{pl,en}/`. Components use a shared translation API; no translated sentences, locale conditionals or assembled sentence fragments in components. This path and key convention are local choices informed by [Expo localization](https://docs.expo.dev/guides/localization/) (checked 2026-09-24).
- Use named interpolation and locale-aware plural rules from the chosen localization library. Store full sentences, including plural forms, in catalogs; do not implement Polish plurals with an English singular/plural conditional. Sources: [i18next interpolation](https://www.i18next.com/translation-function/interpolation), [plural rules](https://www.i18next.com/translation-function/plurals) (checked 2026-09-24). Library selection belongs to the localization implementation task; these sources illustrate required capabilities.
- Resolve supported device/app locales to `pl` or `en`, with English fallback for unsupported languages; declare both languages in iOS configuration. Use `Intl` for dates/numbers with the committed Oath timezone when displaying deadlines. Language changes must not change the deadline. Local fallback decision; technical basis: [Expo localization](https://docs.expo.dev/guides/localization/) (checked 2026-09-24).
- Include accessibility labels, errors, notifications and native permission descriptions. Store native iOS translation resources separately through Expo's locale configuration; keep server-owned messages in server catalogs or return stable reason codes for client translation. Do not persist translated labels as domain identifiers. Local boundary convention; native resource basis: [Expo app metadata localization](https://docs.expo.dev/guides/localization/#translating-app-metadata) (checked 2026-09-24).
- Require matching semantic keys and interpolation arguments in both catalogs, plus complete locale-specific plural categories. Check rendered Polish/English messages, Polish plural boundaries, unsupported-language fallback and iOS system text. Missing translations fail validation even if runtime fallback exists. These are local acceptance checks implementing the owner's complete bilingual-content requirement.

Current implementation: `apps/mobile/src/diagnostics/copy.ts` already centralizes both diagnostic dictionaries outside components. It uses a diagnostic environment setting, not production device-language selection. Migrate that copy to the shared catalog/API when establishing product localization before MVP-04 screens; no new product strings may bypass this contract. Exact unaccepted lore wording remains in specification proposals until selected.
