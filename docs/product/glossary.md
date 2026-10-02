# Product glossary and localization

Status: accepted first-loop terms and reviewed mechanical PL/EN copy; other lore labels remain provisional. Source: [ADR 0001](../decisions/0001-project-foundation.md).

| Term | Meaning |
| --- | --- |
| Oath / Przysięga | Accepted EN/PL commitment term; commitment with a deadline and agreed evidence (owner decision, 2026-09-24) |
| Trial of the Spark / Próba Iskry | Accepted EN/PL name of the first initiation task; the commitment itself remains an Oath (owner decision, 2026-09-24) |
| Proof | What the player submits for an Oath, such as a photo. English player-facing copy says proof, never evidence (owner decision, 2026-10-02) |
| Verification | Assessment against the agreed evidence requirement |
| Companion | Player-facing AI character |
| Weles / Veles | Accepted PL/EN mythological anchor for an original companion, not the companion’s selected proper name (owner decision, 2026-09-24) |
| Żaromir / Zharomir | Accepted starting PL/EN proper name for the original Weles-linked guide; [brief](../art/companion.md) may evolve during artwork production (owner decision, 2026-09-24) |
| Strażnik Przysięgi / Oath Guardian | Accepted starting PL/EN role description, not a new action or historical title (owner decision, 2026-09-24) |
| Wędrowiec / Wanderer | Selected level 1 appearance name; original content handoff in the [asset manifest](../art/companion-assets.md#selected-five-level-exports), local production selection 2026-09-24; grants/runtime pending |
| Wstęga Żaru / Ember Sash | Selected level 2 appearance name; original content handoff in the [asset manifest](../art/companion-assets.md#selected-five-level-exports), local production selection 2026-09-24; grants/runtime pending |
| Znak Strażnika / Guardian’s Token | Selected level 3 appearance name; original content handoff in the [asset manifest](../art/companion-assets.md#selected-five-level-exports), local production selection 2026-09-24; grants/runtime pending |
| Okucia Przysięgi / Oath Fittings | Selected level 4 appearance name; original content handoff in the [asset manifest](../art/companion-assets.md#selected-five-level-exports), local production selection 2026-09-24; grants/runtime pending |
| Płaszcz Iskry / Spark Mantle | Selected level 5 appearance name; original content handoff in the [asset manifest](../art/companion-assets.md#selected-five-level-exports), local production selection 2026-09-24; grants/runtime pending |
| Referee | Evidence-assessment role, not a separate required character |
| Squad | Private group sharing progress |
| Recovery Quest / Zadanie Powrotu | Follow-up after a missed Oath; Polish mechanical translation reviewed in the T07 handoff, not a new lore name |
| Minimum Quest | Pre-agreed smaller alternative before the deadline; deferred beyond the first loop (owner approval, 2026-09-24) |
| Trial | Candidate label for a time-bounded challenge |
| XP | Experience points; accepted initial amounts and level thresholds in [first-loop policy](first-loop.md#progression-and-recovery), owner approval 2026-09-24 |
| Renown | Candidate lore/progression term; not yet a separate currency |
| Withdrawn / Wycofana | Accepted neutral voluntary withdrawal under the [pause policy](first-loop.md#pause-and-alternatives), without XP, miss or new Recovery eligibility; an already activated Recovery preserved by appeal retains its rules |
| Fulfilled / Spełniona | Successful original commitment |
| Missed / Niewykonana | Original commitment not fulfilled under its rules |
| Unresolved / Nierozstrzygnięta | Neutral outcome when evidence/infrastructure cannot be resolved; no XP, miss or new Recovery eligibility; an already activated Recovery preserved by appeal retains its rules |
| Recovered / Nadrobiona | Original miss with successful linked Recovery; original history is preserved |

Use plain action labels such as “Submit proof” and “Start recovery.” Preserve distinctive world names where useful, with short explanations. Do not introduce lore names as hidden synonyms for core actions. **Local product convention: [art direction](../art/art-bible.md).**

## Language and naming rules

**Accepted local decision: owner instruction, 2026-09-23.** MVP supports Polish (`pl`) and English (`en`). The diagnostic shell implements bilingual copy; full product localization remains a requirement. Code identifiers and engineering prose remain English; player-facing copy and terminology have Polish and English forms.

- Cover the full MVP experience in both languages: onboarding, Oath rules, actions, states, errors, notifications, companion messages and recovery. Neither language is a partial demonstration.
- Localize for natural phrasing, tone and rhythm; literal one-to-one translation is not required. Preserve the same commitment, evidence requirement, deadline, consequence, reward and available actions in both languages.
- Draw names, imagery and narrative language from Slavic legends and folklore where relevant. Record sources for specific traditional references, distinguish regional variants, and label invented lore as original. Do not present invented names as historical traditions.
- Keep each concept's meaning stable across locales. When selecting a player-facing term, record its Polish and English forms here, with its meaning and accepted/proposed status. The English terms above are domain references, not a finalized bilingual copy catalog.
- Lore names may differ between languages to sound natural. Pair evocative titles with clear requirements; narrative wording cannot obscure or change mechanics.
- Review each player-facing feature in both languages for natural wording, terminology consistency, equivalent rules and readable layout before calling localization complete. First-loop copy is reviewed in the [T07 handoff](first-loop.md#bilingual-implementation-copy-handoff); the shared locale boundary is implemented as described below; complete native product layout remains pending.

These rules govern product specification, implementation and content generation. They do not select an internationalization library or approve additional lore; the accepted initiation title is recorded above.

## Translation storage and runtime contract

**Local implementation requirements: owner instruction, 2026-09-24.** Store translations separately from UI and domain logic. The following conventions apply to the shared localization runtime and every future product feature.

- Keep complete UTF-8 message catalogs for `pl` and `en`, with stable semantic keys grouped by feature, under `apps/mobile/src/localization/locales/{pl,en}/`. Components use a shared translation API; no translated sentences, locale conditionals or assembled sentence fragments in components. This path and key convention are local choices informed by [Expo localization](https://docs.expo.dev/guides/localization/) (checked 2026-09-24).
- Use named interpolation and locale-aware plural rules from the chosen localization library. Store full sentences, including plural forms, in catalogs; do not implement Polish plurals with an English singular/plural conditional. Sources: [i18next interpolation](https://www.i18next.com/translation-function/interpolation), [plural rules](https://www.i18next.com/translation-function/plurals) (checked 2026-09-24). Library selection belongs to the localization implementation task; these sources illustrate required capabilities.
- Resolve supported device/app locales to `pl` or `en`, with English fallback for unsupported languages; declare both languages in iOS configuration. Use `Intl` for dates/numbers with the committed Oath timezone when displaying deadlines. Language changes must not change the deadline. Local fallback decision; technical basis: [Expo localization](https://docs.expo.dev/guides/localization/) (checked 2026-09-24).
- Include accessibility labels, errors, notifications and native permission descriptions. Store native iOS translation resources separately through Expo's locale configuration; keep server-owned messages in server catalogs or return stable reason codes for client translation. Do not persist translated labels as domain identifiers. Local boundary convention; native resource basis: [Expo app metadata localization](https://docs.expo.dev/guides/localization/#translating-app-metadata) (checked 2026-09-24).
- Require matching semantic keys and interpolation arguments in both catalogs, plus complete locale-specific plural categories. Check rendered Polish/English messages, Polish plural boundaries, unsupported-language fallback and iOS system text. Missing translations fail validation even if runtime fallback exists. These are local acceptance checks implementing the owner's complete bilingual-content requirement.

Current implementation (MVP-04-T01): `apps/mobile/src/localization/` supplies bundled PL/EN catalogs, an i18next instance per React provider, `useTranslation`, device/app primary-language resolution and committed-timezone formatting. Regional Polish tags resolve to `pl`; English and unsupported languages resolve to `en`. Diagnostic copy now uses this shared boundary. Its explicit diagnostic environment override remains limited to the diagnostic root. `i18n.changeLanguage` updates mounted consumers. Since MVP-18 (2026-09-26) the in-app choice is made in Settings and persisted as the profile `locale` through `PATCH /api/profile`. It applies after the server confirms, and a failed save keeps the previous language. Catalog validation checks semantic keys, named arguments and all locale plural categories. iOS supported languages are declared; rebuilt-app system-language/metadata acceptance and future permission text remain pending. No new product strings may bypass this contract. Exact unaccepted lore wording remains in specification proposals until selected.

Plural selection on iOS: Hermes on iOS ships without `Intl.PluralRules`, so i18next fell back to one and other, and Polish counts such as 5 showed the wrong form. Since MVP-18 (2026-09-26) `apps/mobile/src/localization/plural.ts` installs a small `Intl.PluralRules` replacement for `pl` and `en` cardinal counts when the runtime lacks one. Tests compare it with the Node implementation for counts from -200 to 1000. The menu stat was checked natively in Polish for 0 to 5. Local implementation decision, basis: [i18next plurals](https://www.i18next.com/translation-function/plurals) (checked 2026-09-26).

Library selection, local implementation decision 2026-09-24: i18next/react-i18next for named interpolation, plural forms and React updates; expo-localization for device/app locale. Sources checked that date: [Expo SDK57 localization](https://docs.expo.dev/versions/v57.0.0/sdk/localization/), [React translation hook](https://react.i18next.com/latest/usetranslation-hook), [i18next configuration](https://www.i18next.com/overview/configuration-options). Current catalogs cover implemented content only; future features must add complete bilingual copy.


## Onboarding intention

**Owner decision, 2026-09-24:** “intention” / “intencja” in [onboarding](onboarding.md) means the explicitly confirmed `regular_activity` choice: “Chcę regularnie podejmować aktywność” / “I want to be active regularly”. It has no numerical target and is distinct from an Oath with committed rules and deadlines. Do not translate it as a measurable quota or imply that confirming it begins the Trial of the Spark.

## Content punctuation

Owner decision, 2026-09-26: authored prose and player-facing content must not contain em dashes (U+2014) or semicolons. Prefer short sentences or commas. The bundled PL and EN catalogs, including the demonstration, enforce this in catalog validation. Code syntax is excluded. Existing immutable Oath snapshots retain their original wording. Apply the rule to new policy versions without rewriting accepted records.

## Proposed player terminology, 2026-09-26

The [player-character note](player-character.md) retains the owner’s working name Oathtar and proposes Twoja postać / Your character as interface wording, with Przysiężnik / Oathbearer as a possible lore title. These remain exploration, not accepted replacements for existing terms. Żaromir / Zharomir remains the companion’s name.

Demo only, proposed 2026-09-29: Oblicze Kuźni / Face of the Forge names the art style row, with Dawne / Classic for the current art and Filmowe / Cinematic for the restyle. It is a development control, not accepted player terminology.
