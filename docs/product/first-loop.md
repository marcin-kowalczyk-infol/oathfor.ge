# First workout Oath contract

Status: T01 proposal for owner decision, 2026-09-24. No application behavior or model evaluation is implemented by this document. Later time, resolution, progression, recovery, pause and retention policies remain open.

Accepted basis: completion declared by the player, supported by either a photo or an activity screenshot under separate criteria (owner decision, 2026-09-23). The [MVP guardrails and progression direction](mvp.md), [evidence limits](../engineering/ai-verification.md) and [language rules](glossary.md#language-and-naming-rules) remain binding. Every selection below is a **local proposal**, not an accepted requirement.

## Accepted platform and localization scope

**Owner decision, 2026-09-24:** iOS-only MVP, in Polish and English. Android is deferred. Product strings must follow the [translation storage and runtime contract](glossary.md#translation-storage-and-runtime-contract); tables here specify copy, not permission to hardcode it in components. This decision does not select Apple Fitness or any other evidence-source layout.

## Oath template and Evidence contract

### Promise and naming proposal

| Copy | Polish | English |
| --- | --- | --- |
| Proposed first-task initiation title | Próba Iskry | Trial of the Spark |
| Mechanical subtitle | Ukończ zaplanowany trening | Complete your planned workout |
| Commitment | Ukończę trening: {activity}, do {deadline}. Potwierdzę jego ukończenie i prześlę zdjęcie lub zrzut ekranu zgodnie z zasadami dowodu tej Przysięgi. | I will complete my workout: {activity}, by {deadline}. I will confirm completion and submit a photo or screenshot under this Oath’s evidence rules. |
| Completion declaration | Potwierdzam ukończenie treningu wskazanego w tej Przysiędze. Przesłany dowód dotyczy tego treningu. | I confirm that I completed the workout named in this Oath. The evidence I submit relates to that workout. |
| Evidence caveat | AI ocenia widoczne elementy dowodu. Sam obraz nie potwierdza ukończenia treningu, jego czasu trwania ani tego, kto go wykonał. | AI assesses visible evidence. The image alone does not verify workout completion, duration or who performed it. |

The owner requested an initiation theme for the first task. “Próba Iskry / Trial of the Spark” is the resulting proposal, not yet accepted. It names the introductory task; the commitment remains an Oath. The spark motif is invented setting terminology, not a claimed traditional Slavic ritual. Both title translations and Polish “Przysięga” remain proposed glossary entries. `{activity}` is the chosen workout type; `{deadline}` must show the committed date, time and timezone once T02 defines them. No exercise duration or intensity target is selected here. These sentences are the completion promise, not a complete activation screen: submission cutoff, consequence and recovery disclosures require T02–T05.

### Shared proposal

The player sees both evidence contracts before committing and chooses either mode at submission. The rule snapshot preserves both alternatives; switching between them does not change the workout promise. Completion declaration is required for either route. A missing declaration blocks submission with a request to confirm it; the model cannot supply it for the player.

An accepted evidence assessment means only that the image satisfies the selected visible-content criteria. Fulfillment additionally relies on the player’s declaration and backend eligibility checks. It is not independent verification of exercise. T02/T03 must define timely eligibility, ambiguous/rejected follow-up and final outcomes; this draft grants no XP and defines no terminal transition.

Do not require faces, names, body photos, maps, GPS permission or matching upload location. Do not collect or depend on EXIF for this contract. Permit cropping or redacting private areas while preserving required evidence fields; missing metadata is not proof of fraud. The capture/gallery mechanism and upload limits remain downstream implementation details to resolve before MVP-07; this proposal makes no camera-only provenance claim.

### Photo proposal

A context photo must show a recognizable setting or equipment consistent with the chosen activity: for example a mat for a home mobility workout, gym equipment for strength training, or an outdoor running path for a run. A person need not appear. A clear contextual image plus the declaration can satisfy the minimum evidence contract, even though the image cannot establish that any exercise occurred. This deliberately relies on honest self-report.

An unreadable or ambiguous setting is `unclear`. A clearly unrelated image is `rejected` against the visible-content requirement, not a finding of dishonesty. Neither assessment automatically means the Oath is missed. A photograph of a watch or app result is assessed as an activity record under the fields below; it is not accepted as a context photo merely because it is a photograph. This keeps the separate evidence criteria explicit.

### Activity-record proposal

Require a single readable summary of one completed activity showing:

- Identifiable source app/device (visible source name or an evaluated recognizable layout).
- Activity type consistent with the committed workout.
- Activity date and start time, with timezone interpretation reserved for T02.
- Recorded duration with units and a positive value. This is a completeness field, not a minimum workout target or independently verified duration.

Do not require calories, distance, heart rate, name or map. Privacy cropping may remove these. Duration is the proposed common record metric; it gives no metric-based XP. An active timer or explicitly unfinished activity is rejected as a completed-record submission. Missing, obscured or unreadable required fields are `unclear`; visible incompatible activity type is `rejected`. Unfamiliar layouts are `unclear` pending support evaluation, not presumed fabricated.

Proposed support boundary: begin with a small, explicitly evaluated allowlist of summary layouts. **No real app/device layout is supported yet.** The owner must nominate the first app/device and supply or authorize representative synthetic/consented examples, including locale and version. MVP-08 must evaluate those layouts before automated assessment is released. A synthetic summary demonstrating these fields is a specification fixture only, never evidence of real-provider compatibility. Do not advertise universal screenshot support. A real layout that lacks a required field needs an explicit contract revision, not an invisible exception.

### Artifact acceptance scenarios

These are expected assessments under the proposal, not executed model tests. Cases assume a completion declaration where stated; timing and backend resolution remain T02/T03 dependencies.

| ID | Input → action | Expected result |
| --- | --- | --- |
| LOOP-01 | Switch between Polish and English before committing | Identical workout promise and evidence alternatives; no duration target introduced by translation |
| LOOP-02 | Strength workout declaration + clear gym-equipment photo → assess | Accept contextual evidence only; completion remains self-reported and duration unknown |
| T01-P02 | Mobility declaration + severely blurred image → assess | Unclear; do not invent a mat, completed exercise or dishonesty |
| T01-P03 | Running declaration + clear restaurant menu → assess | Reject unrelated context; final Oath outcome still follows T03 |
| T01-P04 | Clear context photo without declaration → submit | Ask for declaration; do not infer completion from the image |
| T01-S01 | Synthetic allowlist candidate: source “DUMMY Activity”, strength, 2026-09-24 18:00, completed, duration 25 min → inspect | Complete proposed visible fields; no actual app support, time eligibility or authenticity established |
| LOOP-03 | Readable activity type/date but duration omitted → assess | Unclear, including when a calorie value remains visible |
| LOOP-04 | Crop name/map, preserving source/type/date/start/duration → assess | Crop itself does not disqualify evidence; never infer ownership from a visible name |
| LOOP-05 | Context photo without EXIF, uploaded elsewhere → assess | Neither fact is a rejection reason; apply visible-content criteria only |
| T01-S02 | Supported strength summary submitted for a run → assess | Reject activity mismatch; no automatic missed outcome |
| T01-S03 | App summary layout has not been evaluated → assess | Unclear unsupported layout; no fabricated compatibility claim |
| T01-S04 | Otherwise complete summary omits timezone → inspect | T01 fields complete; time eligibility awaits T02 policy, never guessed from image metadata |

### Decisions needed before T01 completion

1. Accept or revise the proposed bilingual name, promise and declaration.
2. Accept or revise evidence-mode choice at submission, the contextual photo minimum, privacy cropping and no GPS/EXIF requirement.
3. Accept or revise the activity-record fields, including positive duration without a duration target, and nominate the first app/device layout for evaluation. Representative layout fixtures may be prepared later as explicitly synthetic placeholders; real compatibility remains pending until evaluated.

No values, deadline rules, evidence bonuses, final state names or review periods are selected by this draft. T01 remains incomplete until the owner resolves the policy choices; later tasks retain their plan dependencies.
