# Companion brief — MVP-03-T01

Status: **accepted starting brief, subject to visual refinement during artwork production.** Owner selected Żaromir on 2026-09-24, then accepted the remaining brief with “na razie przy tym zostanmy, bedziemy ew. modyfikowac w trakcie tworzenia grafik”. The Weles/Veles anchor is accepted (owner reply “Weles brzmi dobrze :D”, 2026-09-24). This brief is an original creative direction dated 2026-09-24, not selected artwork or implemented companion behavior. Constraints come from the [Art Bible](art-bible.md), [AI boundaries](../engineering/ai-verification.md#companion-constraints) and [first-loop contract](../product/first-loop.md).

## Accepted starting identity

**Żaromir / Zharomir**, an Oath Guardian: a weathered, human-shaped wanderer carrying a small ember lantern. Use the same personal identity in both languages; Zharomir is the accepted starting English spelling. The name evokes warmth and steadiness as a creative choice, not a claim about an attested mythological figure or historical etymology. It remains separate from Przysięga/Oath, Próba Iskry/Trial of the Spark and Zadanie Powrotu/Recovery Quest.

Original fiction: Weles entrusted this guardian with accompanying people along the paths they choose. He carries a light for the return journey; he neither owns their promises nor judges their worth. The relationship to Weles, personal name, lantern and story are invented for Oathforge. This brief asserts no historical appearance, cult practice or uniform pan-Slavic tradition. Domowik is an earlier alternative, not a second companion or an unresolved anchor choice.

| Introduction | Starting player-facing copy |
| --- | --- |
| Polish | Jestem Żaromir, strażnik związany z Welesem. Będę ci towarzyszył na drodze Przysięgi. Ty wybierasz zobowiązanie; ja pomagam pamiętać jego zasady i dostępne kroki. |
| English | I am Zharomir, a guardian linked to Veles. I will accompany you on the path of your Oath. You choose the commitment; I help you remember its rules and the steps available to you. |

## Form and continuity brief

T02 refinement: the [selected concept references](companion-assets.md) retain a relaxed arm, lantern near the knee and a longer cloak rear panel. These observed refinements supersede the original hip-height/squat-lantern and short-rear-cloak details below; preserve the same side and carry in future exports.

Starting body: an upright adult humanoid, broad through the shoulders, with grounded proportions and visible hands. A short charcoal travel cloak leaves the face and lantern unobscured. The face resembles weathered carved wood, with a broad brow, short squared beard and two small warm eyes. Keep him approachable through posture and expression, without turning him into a cute pet. No skull mask, threatening teeth or oversized weapon.

The identifying motif is **one vertical ember seam in the left cheek**, paired with a squat iron lantern held at the right hip. Preserve the cheek side in every pose; never mirror an export silently. The seam is an original design mark, not a claimed traditional rune. Establish both portrait and silhouette recognition: the cheek anchors the portrait, while broad shoulders, short cloak and lantern anchor the full figure. Use no tiny inscriptions as the only identifying feature.

Starting materials are matte dark wood, worn charcoal cloth and plain iron; restrained amber light comes from the seam and lantern. Later richness can come from fittings, cloak trim and the lantern housing. These are design constraints to explore, not approved palette values or unlock content. Avoid a glowing body that competes with rule text.

Four concept stages must retain the same head shape, beard, cheek seam, body proportions and lantern location. Explore increasing equipment/material richness around those constants. Do not turn the final stage into Weles or another creature. Four concepts do not determine the five initial levels or authorize XP thresholds beyond the [accepted level policy](../product/first-loop.md#initial-levels-and-unlock-ownership). T02 selects canonical references; T03 selects the actual five-level content. Nothing here replaces the existing DUMMY unlock handoffs.

## Persona and authority

Starting tone: calm, direct and quietly warm. One brief acknowledgment followed by one available next step; occasional path/light imagery, never enough to hide a requirement. He can recognize a recorded result without claiming to have watched the workout. No shame, insults, threats, emotional dependency, fabricated memories or pressure to exercise during illness.

Use only backend-provided event/state, eligibility and permitted history. A missing start event is not evidence of inactivity. The companion cannot assess proof on his own, grant rewards, extend deadlines, reduce committed requirements or resolve an appeal. Provider errors and uncertain evidence are not misses. The deterministic state explanation, exact deadlines and action labels remain visible separately; narrative copy cannot replace them. These boundaries apply the existing [AI policy](../engineering/ai-verification.md) and [bilingual copy handoff](../product/first-loop.md#bilingual-implementation-copy-handoff), not a new game rule.

Persona means written event-driven messages. It does not add audio, open chat or a memory system. **Owner decision, 2026-09-28:** a live model may write bounded companion messages for reminders, upcoming deadline notifications and motivation. The rules in this section are the policy each generated message must pass before it is sent. Exact deadlines, state and actions still come from the backend, never from model text. Suppress gameplay interventions while paused under the accepted [pause contract](../product/first-loop.md#pause-contract); passive status remains available when the player opens it.

## Bilingual event examples

These are selected supplemental examples, gated by the stated authoritative state. They must appear alongside the mechanical explanation and relevant deadline/action, not be sent indiscriminately. The pairs preserve the same outcome and next step; they add no reward amounts or timing rules.

| Event and display condition | Polish | English |
| --- | --- | --- |
| Original fulfillment confirmed; detail available | Przysięga spełniona. To kolejny krok na twojej drodze. Zobacz wynik i przyznane XP. | Oath fulfilled. Another step along your path. View the result and awarded XP. |
| Original missed; unpaused, unused Recovery currently eligible | Ta Przysięga pozostaje niewykonana. Możesz podjąć Zadanie Powrotu — sprawdź jego zasady i terminy przed rozpoczęciem. | This Oath remains missed. You can take a Recovery Quest — check its rules and deadlines before starting. |
| Recovery fulfilled; linked result available | Zadanie Powrotu ukończone. Wracasz na szlak. Zobacz wynik; wcześniejsza niewykonana Przysięga pozostaje w historii. | Recovery Quest completed. You are back on the path. View the result; the earlier missed Oath remains in your history. |
| Ambiguous proof; correction currently allowed; user opens detail | Ten dowód nie wystarcza do rozstrzygnięcia. To nie jest porażka. Sprawdź, co trzeba uzupełnić i do kiedy. | This evidence is not enough to decide the outcome. This is not a miss. Check what needs clarification and its deadline. |
| Assessment provider unavailable after durable timely receipt; still pending | Dowód dotarł na czas, ale ocena jest chwilowo niedostępna. To nie jest porażka. Sprawdź status i obowiązujące terminy w szczegółach. | Your evidence arrived on time, but assessment is temporarily unavailable. This is not a miss. Check the status and applicable deadlines in the details. |
| Player mentions illness; pause not yet selected | Możesz zrobić przerwę. Otwórz ustawienia pauzy, aby sprawdzić jej skutki przed potwierdzeniem. Nie musisz podawać powodu. | You can take a break. Open pause settings to review its effects before confirming. You do not need to give a reason. |
| Pause confirmed; submitted evidence still pending; passive detail only | Pauza jest włączona. Ocena przesłanych dowodów i dotychczasowe terminy nadal obowiązują. Szczegóły znajdziesz przy Przysiędze. | Pause is on. Submitted evidence is still assessed and existing deadlines remain in effect. You can find the details with your Oath. |

If Recovery is unavailable, omit its invitation and show the current mechanical state/actions. If no timely receipt exists, omit the provider-outage example's receipt claim. Once correction closes or review becomes terminal, show the corresponding first-loop status instead of the correction invitation. Illness alone never activates pause. Messages cannot imply that pause freezes clocks or clears an existing miss; earlier XP and unlocks remain intact under the accepted rules.

## Selection and next handoff

Owner selected **Żaromir** on 2026-09-24 and then accepted **Zharomir**, the wooden wanderer with the left-cheek ember seam and iron lantern, and the calm written persona as the starting brief. The owner explicitly allows refinement during artwork creation. Record resulting identity changes with the selected references; this decision is not approval of unseen artwork.

T02 produces and visually reviews the canonical reference and four-stage concepts. Before production, review the selected generator's current terms. Under the owner's 2026-09-24 [storage decision](pipeline.md#files-and-continuity), masters may remain in ignored graphics temporarily; S3 backup is deferred. T02/T03 must inspect actual portrait/full-body readability and progression differences; this text cannot establish visual acceptance. Product catalogs, locale selection and iOS accessibility/layout checks remain later implementation work.

## Player distinction exploration, 2026-09-26

The owner requested a distinct main player and considers Żaromir a helper and guide. The current moving companion sprite remains a spatial prototype, not the player avatar. Proposed starter appearance, customization, naming and staging are recorded in [Player character and Forge roles](../product/player-character.md). No new player identity or character creator has been selected or implemented.
