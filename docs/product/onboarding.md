# Onboarding into the Trial of the Spark

Status: accepted product intention and local implementation contract, 2026-09-24. Authentication is implemented through MVP-04-T14; T16 implements profile persistence and server completion; T17 implements mobile profile hydration and confirmed language/timezone/intention. T18 adds the accepted companion introduction with durable acknowledgment. T19 adds the optional notification preference and device-permission step; T20 adds final review and server completion; MVP-05-T09 replaces the provisional entry with a bilingual Oath form, stored-rule review and explicit confirmation; T10 makes Today the entry with creation, detail, history and pause navigation. Real signed-device/provider acceptance remains a separate gate.

## Intention and boundaries

**Owner decision, 2026-09-24:** require one explicitly confirmed intention: “Chcę regularnie podejmować aktywność” / “I want to be active regularly.” Its stored value is `regular_activity`. There is no numerical goal, quota, intensity requirement or inferred health target. The intention leads to [Próba Iskry / Trial of the Spark](first-loop.md); it does not itself create an Oath.

An authenticated player can start alone, without an invitation. Confirm language, timezone and intention; meet Żaromir; decide notification preference; then explicitly continue to the first Oath. Onboarding has no deadline, evidence, XP or penalty. The later Oath flow presents and confirms its own immutable rules. A profile timezone supplies a scheduling default and never changes an existing Oath snapshot. Sources: accepted [MVP](mvp.md), [time policy](first-loop.md#time-policy) and [language rules](glossary.md#language-and-naming-rules).

## Confirmed progress and recovery

The following are local interaction and persistence choices for MVP-04. The exact [profile API contract](../engineering/api-contract.md#onboarding-profile-contract) is authoritative for request shapes and server validation.

- Load the server profile for every authenticated account, including returning accounts whose onboarding is complete. Apply its confirmed language before routing. On load failure, offer retry and logout in the current resolved language; do not guess completion or reuse another account’s profile.
- Language, timezone and intention begin unconfirmed. Device language/timezone can suggest a choice but must not silently save it. Require explicit confirmation; unsupported timezone suggestions need correction, with a visible IANA example such as `Europe/Warsaw`. A saved server zone unsupported by the current device must not block profile/language loading; pending onboarding offers correction before confirmation. Completed accounts still bypass onboarding; the later Oath flow validates its scheduling input.
- Save only confirmed fields with atomic partial updates. A failed save does not advance or claim persistence. Serialize mobile writes; after an ambiguous response, refetch before retrying. Ignore results from an earlier account/session generation.
- Restart at the first incomplete step from the server profile. Preserve confirmed fields, not unsaved draft claims. Once all fields are saved but completion is pending, show a final review with the recorded notification preference and freshly read device permission, without automatically prompting.
- Completion requires confirmed language, timezone, `regular_activity`, companion introduction and a notification preference of enabled or disabled. OS permission is not a requirement. Complete only through the server endpoint; repeated completion is harmless and cannot issue XP, create an Oath or renew a session.
- After a lost completion response, refetch the profile. Resume a missing step on `onboarding_incomplete`; bypass onboarding only when the server reports complete. Authentication failure returns to session recovery.

Concurrent updates of different fields preserve both changes; for the same field, the last serialized successful write wins. The client does not promise that another device cannot change the same preference. Completion and companion acknowledgment are monotonic. Sources for transaction/ownership requirements: [architecture](../engineering/architecture.md), [security rules](../../.agents/rules/security.md); merge behavior is a local contract choice.

## Companion introduction

Reuse the accepted [companion identity and bilingual introduction](../art/companion.md) and the selected base appearance. Adjacent text carries the message, so the image is decorative. Missing artwork leaves the introduction and continuation usable. No new lore, appearance entitlement or reward is introduced.

PL: “Jestem Żaromir, strażnik związany z Welesem. Będę ci towarzyszył na drodze Przysięgi. Ty wybierasz zobowiązanie; ja pomagam pamiętać jego zasady i dostępne kroki.”

EN: “I am Zharomir, a guardian linked to Veles. I will accompany you on the path of your Oath. You choose the commitment; I help you remember its rules and the steps available to you.”

Superseded on 2026-10-02: the introduction is now two sentences, shown in Żaromir's bubble above "Dalej". PL "Jestem Żaromir, strażnik związany z Welesem. Pomogę Ci pamiętać zasady i kolejne kroki." EN "I am Zharomir, a guardian linked to Veles. I will help you remember the rules and your next steps." See [clarity](clarity.md).

The explicit continuation saves `companionIntroduced: true`. A failed save offers retry and does not pretend the step is finished.

## Notification preference and this device

Local choice: account preference and OS permission describe different things. `enabled` records the wish to receive applicable future notifications; `disabled` includes explicit “not now”; null means no decision. A device denial does not disable another device’s account preference.

“Enable” first saves enabled, then requests permission only as part of that explicit action. If saving fails, show retry or skip and do not prompt. “Not now” saves disabled without a prompt. Read device permission on screen entry and foreground; never request automatically on mount, restart or return from Settings. If interrupted after preference save, resume with the saved preference and current OS status. Explicit permission retry is available only when the OS permits asking again; otherwise offer Settings and continuation. Failure to open Settings must leave continuation usable.

Superseded on 2026-10-02: the notification step shows only the saved preference, the line that reminders are not sent yet and the buttons. The account and device explanations fold behind "Jak działają powiadomienia" / "How notifications work". The device line stays visible only for denied, unavailable and provisional permission, because those change what the player can do. See [clarity](clarity.md).

Superseded on 2026-10-02 (MVP-22-B1): the notification step shows the line that notifications are optional, the line that reminders are not sent yet and the buttons. The saved preference sentence also folds behind "Jak działają powiadomienia" / "How notifications work". The device line stays visible only when the player turned notifications on and the device blocks them (denied, not decided yet, unavailable or quiet only). The final review shows one line, "Przejście dalej nie tworzy jeszcze Przysięgi." / "Continuing does not create an Oath yet.", and one summary card with the language, the zone label such as "Warszawa", the intention and the notification preference. The reminder line and a device line that blocks nothing fold behind the same link there. See [clarity](clarity.md).

Denied, unavailable, provisional and ephemeral permission all have accurate copy and permit continuation after the preference is saved. Quiet authorization is not a promise of alert delivery. Ignore a permission result arriving after logout. This epic registers no push token, schedules no notification and installs no foreground delivery handler. Sources: [Expo SDK57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) (checked 2026-09-24), [companion boundaries](../art/companion.md); the sequencing and account/device separation are local choices.

## Bilingual copy handoff

These local labels preserve the accepted meaning; implementation can adjust surrounding phrasing naturally in each language without changing the rules.

Superseded on 2026-10-02: player lines around the intention call it "cel" / "goal", for example "Cel: Chcę regularnie podejmować aktywność". The intention label itself is unchanged. See [clarity](clarity.md).

| Purpose | Polish | English |
| --- | --- | --- |
| Intention | Chcę regularnie podejmować aktywność | I want to be active regularly |
| Language | Język | Language |
| Timezone | Strefa czasowa | Timezone |
| Continue | Dalej | Continue |
| Enable preference | Włącz powiadomienia | Enable notifications |
| Skip preference | Nie teraz | Not now |
| Device settings | Otwórz ustawienia | Open Settings |
| Final handoff | Przejdź do pierwszej Przysięgi | Continue to your first Oath |

The final handoff is not “Złóż Przysięgę” / “Commit to the Oath”. That action belongs to the actual MVP-05 rule summary and explicit commitment. MVP-05-T09 now provides that separate form and rule review after server completion. Entering it still creates nothing; only its explicit acceptance action submits a commitment. Full PL/EN signed-iOS restart, interruption, denial, accessibility and first-Oath acceptance remains required; mocks and exports establish only the local implementation behavior.
