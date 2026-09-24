# First workout Oath contract

Status: T01 evidence policy accepted by the owner, 2026-09-24; real-layout acceptance pending. No application behavior or model evaluation is implemented by this document. Later time, resolution, progression, recovery, pause and retention policies remain open.

Accepted basis: completion declared by the player, supported by either a photo or an activity screenshot under separate criteria (owner decision, 2026-09-23). The [MVP guardrails and progression direction](mvp.md), [evidence limits](../engineering/ai-verification.md) and [language rules](glossary.md#language-and-naming-rules) remain binding. The T01 rules below are an **accepted local decision: owner instruction, 2026-09-24**. Apple Fitness is an evaluation candidate only; later policy proposals are not accepted by this decision.

## Accepted platform and localization scope

**Owner decision, 2026-09-24:** iOS-only MVP, in Polish and English. Android is deferred. Product strings must follow the [translation storage and runtime contract](glossary.md#translation-storage-and-runtime-contract); tables here specify copy, not permission to hardcode it in components. This decision does not select Apple Fitness or any other evidence-source layout.

## Oath template and Evidence contract

### Promise and naming

| Copy | Polish | English |
| --- | --- | --- |
| First-task initiation title | Próba Iskry | Trial of the Spark |
| Mechanical subtitle | Ukończ zaplanowany trening | Complete your planned workout |
| Commitment | Ukończę trening: {activity}, do {deadline}. Potwierdzę jego ukończenie i prześlę zdjęcie lub zrzut ekranu zgodnie z zasadami dowodu tej Przysięgi. | I will complete my workout: {activity}, by {deadline}. I will confirm completion and submit a photo or screenshot under this Oath’s evidence rules. |
| Completion declaration | Potwierdzam ukończenie treningu wskazanego w tej Przysiędze. Przesłany dowód dotyczy tego treningu. | I confirm that I completed the workout named in this Oath. The evidence I submit relates to that workout. |
| Evidence caveat | AI ocenia widoczne elementy dowodu. Sam obraz nie potwierdza ukończenia treningu, jego czasu trwania ani tego, kto go wykonał. | AI assesses visible evidence. The image alone does not verify workout completion, duration or who performed it. |

The owner selected “Próba Iskry / Trial of the Spark” as the initiation title. It names the introductory task; the commitment remains an Oath. The spark motif is invented setting terminology, not a claimed traditional Slavic ritual. The accepted bilingual title and commitment term are recorded in the glossary. `{activity}` is the chosen workout type; `{deadline}` must show the committed date, time and timezone once T02 defines them. No exercise duration or intensity target is selected here. These sentences are the completion promise, not a complete activation screen: submission cutoff, consequence and recovery disclosures require T02–T05.

### Shared evidence rules

The player sees both evidence contracts before committing and chooses either mode at submission. The rule snapshot preserves both alternatives; switching between them does not change the workout promise. Completion declaration is required for either route. A missing declaration blocks submission with a request to confirm it; the model cannot supply it for the player.

An accepted evidence assessment means only that the image satisfies the selected visible-content criteria. Fulfillment additionally relies on the player’s declaration and backend eligibility checks. It is not independent verification of exercise. T02/T03 must define timely eligibility, ambiguous/rejected follow-up and final outcomes; this draft grants no XP and defines no terminal transition.

Do not require faces, names, body photos, maps, GPS permission or matching upload location. Do not collect or depend on EXIF for this contract. Permit cropping or redacting private areas while preserving required evidence fields; missing metadata is not proof of fraud. The capture/gallery mechanism and upload limits remain downstream implementation details to resolve before MVP-07; this contract makes no camera-only provenance claim.

### Photo evidence

A context photo must show a recognizable setting or equipment consistent with the chosen activity: for example a mat for a home mobility workout, gym equipment for strength training, or an outdoor running path for a run. A person need not appear. A clear contextual image plus the declaration can satisfy the minimum evidence contract, even though the image cannot establish that any exercise occurred. This deliberately relies on honest self-report.

An unreadable or ambiguous setting is `unclear`. A clearly unrelated image is `rejected` against the visible-content requirement, not a finding of dishonesty. Neither assessment automatically means the Oath is missed. A photograph of a watch or app result is assessed as an activity record under the fields below; it is not accepted as a context photo merely because it is a photograph. This keeps the separate evidence criteria explicit.

### Activity-record evidence

Require a single readable summary of one completed activity showing:

- Identifiable source app/device (visible source name or an evaluated recognizable layout).
- Activity type consistent with the committed workout.
- Activity date and start time, with timezone interpretation reserved for T02.
- Recorded duration with units and a positive value. This is a completeness field, not a minimum workout target or independently verified duration.

Do not require calories, distance, heart rate, name or map. Privacy cropping may remove these. Duration is the selected common record metric; it gives no metric-based XP. An active timer or explicitly unfinished activity is rejected as a completed-record submission. Missing, obscured or unreadable required fields are `unclear`; visible incompatible activity type is `rejected`. Unfamiliar layouts are `unclear` pending support evaluation, not presumed fabricated.

### Apple Fitness evaluation gate

Selected candidate: the details screen of one completed workout in Apple Fitness on iPhone, recorded using Apple Watch. **No real app/device layout is supported yet.** Inspect a real, consented example first and record iOS version, app version if available, watchOS version when known, UI language and capture date. Verify source, activity type, date, start time and positive duration with units are actually readable on the submitted image. Do not assume they fit a single screen.

| Locale | Real example inspected | Required fields confirmed | Automated assessment evaluated | Support status |
| --- | --- | --- | --- | --- |
| Polish | Pending | Pending | Pending | Candidate only |
| English | Pending | Pending | Pending | Candidate only |

Evaluate PL and EN separately. MVP-07/08 must use the inspected layouts to build representative fixtures and complete model evaluation before claiming support. If the real screen omits required fields, record the incompatibility and resolve capture scope or contract changes explicitly; do not silently waive a field. This is screenshot evidence, not a HealthKit integration or authenticated Apple activity data.

The `DUMMY Activity` scenario below remains a synthetic content example: strength training, start 2026-09-24 18:00, duration 25 minutes, completed. It is neither an Apple Fitness visual fixture nor compatibility evidence. `Europe/Warsaw` may be supplied as scenario metadata, but the model must not report it as visible when absent from the image. Real examples are external validation inputs; the specification can be handed off with this explicit pending gate, but layout support cannot.

### Artifact acceptance scenarios

These are expected assessments under the accepted evidence contract, not executed model tests. Cases assume a completion declaration where stated; timing and backend resolution remain T02/T03 dependencies.

| ID | Input → action | Expected result |
| --- | --- | --- |
| LOOP-01 | Switch between Polish and English before committing | Identical workout promise and evidence alternatives; no duration target introduced by translation |
| LOOP-02 | Strength workout declaration + clear gym-equipment photo → assess | Accept contextual evidence only; completion remains self-reported and duration unknown |
| T01-P02 | Mobility declaration + severely blurred image → assess | Unclear; do not invent a mat, completed exercise or dishonesty |
| T01-P03 | Running declaration + clear restaurant menu → assess | Reject unrelated context; final Oath outcome still follows T03 |
| T01-P04 | Clear context photo without declaration → submit | Ask for declaration; do not infer completion from the image |
| T01-S01 | Synthetic content example: source “DUMMY Activity”, strength, 2026-09-24 18:00, completed, duration 25 min → inspect | Complete required visible fields; no actual app support, time eligibility or authenticity established |
| LOOP-03 | Readable activity type/date but duration omitted → assess | Unclear, including when a calorie value remains visible |
| LOOP-04 | Crop name/map, preserving source/type/date/start/duration → assess | Crop itself does not disqualify evidence; never infer ownership from a visible name |
| LOOP-05 | Context photo without EXIF, uploaded elsewhere → assess | Neither fact is a rejection reason; apply visible-content criteria only |
| T01-S02 | Supported strength summary submitted for a run → assess | Reject activity mismatch; no automatic missed outcome |
| T01-S03 | App summary layout has not been evaluated → assess | Unclear unsupported layout; no fabricated compatibility claim |
| T01-S04 | Otherwise complete summary omits timezone → inspect | T01 fields complete; time eligibility awaits T02 policy, never guessed from image metadata |

### T01 decision record and handoff

Owner accepted the initiation title, completion promise without a universal duration/intensity minimum, submission-time evidence choice, photo context rule, record fields, privacy cropping, no GPS/EXIF requirement and non-terminal `unclear`/`rejected` assessments on 2026-09-24. Polish and English commitment/declaration copy above implements the same accepted meaning. Backend timing and final resolution still belong to T02/T03.

T01 specifies the contract with a synthetic content placeholder; actual Apple Fitness PL and EN examples and model evaluation remain pending. No actual layout support, product implementation or AI accuracy has been demonstrated. The remaining epic tasks are not completed by this decision.
