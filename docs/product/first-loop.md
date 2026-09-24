# First workout Oath contract

Status: T01 evidence policy accepted by the owner, 2026-09-24; real-layout acceptance pending. No application behavior or model evaluation is implemented by this document. T02 time policy is accepted; resolution, progression, recovery, pause and retention policies remain open.

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
| T01-S04 | Otherwise complete summary omits timezone → inspect | T01 fields complete; request activity-timezone confirmation under T02, never guess it from image metadata |

### T01 decision record and handoff

Owner accepted the initiation title, completion promise without a universal duration/intensity minimum, submission-time evidence choice, photo context rule, record fields, privacy cropping, no GPS/EXIF requirement and non-terminal `unclear`/`rejected` assessments on 2026-09-24. Polish and English commitment/declaration copy above implements the same accepted meaning. Backend timing and final resolution still belong to T02/T03.

T01 specifies the contract with a synthetic content placeholder; actual Apple Fitness PL and EN examples and model evaluation remain pending. No actual layout support, product implementation or AI accuracy has been demonstrated. The remaining epic tasks are not completed by this decision.

## Time policy

Status: **T02 accepted local decision: owner approval, 2026-09-24.** The owner accepted the complete time-policy proposal, including inclusive completion and receipt boundaries, offline/retry behavior and timezone interpretation. They neither change T01 evidence requirements nor complete T03–T06. No runtime behavior is implemented.

### Committed times

- Store workout completion deadline `D` as a UTC instant, with the selected IANA timezone and original local display value in the immutable rule snapshot. Show both `D` and first-evidence receipt cutoff `S = D + 15 minutes` before commitment. Backend time is authoritative. UTC storage and retained IANA timezone follow the existing [architecture rules](../engineering/architecture.md#reliability-rules); the 15-minute period and boundaries are accepted local decisions.
- Use inclusive boundaries: the workout must finish at or before `D`; the first complete evidence submission must reach the backend at or before `S`. The extra 15 minutes permit submission, not further exercise. Once `S` has passed, do not open a new first-submission attempt under this normal route. Final outcomes and exceptional review routes belong to T03/T06.
- Receipt `R` is the backend timestamp recorded atomically with a durable submission record after the complete upload is available in controlled storage, bound to the authenticated owner/Oath and accompanied by the declaration. Record it after synchronous upload-integrity checks, before asynchronous image assessment. Upload start, device time, a storage upload without a finalized submission, screenshot creation and queue completion are not `R`.
- A retry of the same finalized submission returns the original receipt; interrupted or unfinalized uploads have none. Changing evidence content is a new submission, not an idempotent replay. Later correction and bonus-upgrade windows cannot be inferred from this first-receipt rule; they need T03/T04 policy.

### Timezone and activity-time handling

Resolve local scheduling time to an instant before commitment. If it falls in a daylight-saving gap, ask for a valid time; do not silently shift it. If it occurs twice, require an explicit offset/occurrence and display that choice. After commitment, device/account timezone or language changes cannot move `D` or `S`. Display the committed timezone; any additional local-time rendering must identify its timezone and represent the same instant. Snapshot rule changes require a new commitment, not reinterpretation of an active one.

For a context photo, completion time relies on the player's declaration that the workout finished by `D`. For a record, the model extracts only visible time fields. A displayed timezone can inform interpretation; when none is visible, ask the player to confirm the activity timezone, defaulting the selection to the committed timezone. This is explicitly self-reported submission metadata, not an extra required image field and not an inference from GPS, EXIF or the upload location.

Do not assume that displayed duration equals elapsed wall-clock time: a paused or moving-time duration may not establish the finish instant. A visible unambiguous finish timestamp, or start plus an explicitly elapsed duration with a resolved timezone/offset, may be checked against `D`. Otherwise rely on the completion declaration; lack of a visible finish time is not a new rejection criterion. If visible timing conflicts with that declaration, flag `unclear` for the T03 correction/review route instead of silently resolving as missed. Ambiguous activity dates, offsets or DST crossings require clarification; do not invent missing image fields. Real Apple Fitness time labels remain unverified until the candidate evaluation gate is satisfied.

### Receipt and processing scenarios

Fixture: `D = 2026-09-24T18:00:00Z`, `S = 2026-09-24T18:15:00Z`. All timestamps below are explicit UTC fixtures; they are not the local start time of the separate DUMMY Activity example.

| ID | Input → action | Expected timing result |
| --- | --- | --- |
| T02-01 | Declared finish at 17:59:59Z / 18:00:00Z / 18:00:01Z | Respectively within / within / outside workout deadline; timely upload does not make the third workout timely |
| LOOP-06 | Complete first receipt at 18:14:59Z / 18:15:00Z / 18:15:01Z | Respectively timely / timely / late; no extra grace after `S` |
| LOOP-07 | Upload starts at 18:14:50Z; complete receipt at 18:15:01Z | Late; upload-start time does not reserve eligibility |
| T02-02 | Offline capture at 17:50Z; reconnect and complete receipt at 18:14Z | Timely receipt; original completion declaration still required |
| T02-03 | Offline capture before `D`; receipt after `S` | Late under normal submission policy; client capture time cannot backdate receipt |
| T02-04 | Backend finalized at 18:14Z; response lost; same submission retried at 18:16Z | Return original 18:14Z receipt; do not reclassify as late or create a second submission |
| T02-05 | Bytes stored at 18:14Z but owner/Oath submission finalized at 18:16Z | Late; storage completion alone was not receipt |
| LOOP-08 | Timely receipt; provider timeout; successful assessment next day | Receipt remains timely; AI delay alone cannot cause player failure; T03 defines retry/escalation and settlement |
| T02-06 | Device timezone/language changes after commitment | Same UTC `D` and `S`; translated display retains committed timezone |
| T02-07 | Schedule time is nonexistent / repeated in selected timezone | Request valid time / explicit occurrence before commitment; no silent adjustment |
| T02-08 | Screenshot time lacks timezone | Request activity-timezone confirmation as metadata; model reports no visible timezone |
| T02-09 | Submission server unavailable before cutoff; no durable receipt exists | Do not fabricate a timely receipt; infrastructure handling and exceptional review remain unresolved T03/T06 dependencies, not an automatic missed verdict here |

The original timely receipt must survive queue delays and later correction requests. The owner's proposed two corrections within 24 hours of assessment concerns the same workout; it is not a way to submit a new workout after `D`. Whether each assessment restarts that window, how initial lateness interacts with review, and when a pending Oath becomes terminal must be resolved in T03/T06, not assumed from this table.

### T02 decision record and handoff

Owner accepted the complete T02 proposal on 2026-09-24: inclusive `D` and `S = D + 15 minutes`, finalized durable server receipt, original receipt on identical retry, no offline backdating, immutable committed timezone with explicit DST disambiguation, and user-confirmed activity timezone when absent from the image. No visible finish time or timezone is fabricated. Infrastructure exceptions and correction windows remain explicit T03/T06 dependencies. Artifact scenarios are specification checks, not executed application tests.
