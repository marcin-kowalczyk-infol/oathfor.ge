# First workout Oath contract

Status: T01 evidence policy accepted by the owner, 2026-09-24; real-layout acceptance pending. No application behavior or model evaluation is implemented by this document. T02 time and T03 resolution policies are accepted; T04 progression and Recovery are accepted; T05 pause policy is accepted; T06 appeals and retention are accepted; real validation and runtime implementation remain pending.

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

The owner selected “Próba Iskry / Trial of the Spark” as the initiation title. It names the introductory task; the commitment remains an Oath. The spark motif is invented setting terminology, not a claimed traditional Slavic ritual. The accepted bilingual title and commitment term are recorded in the glossary. `{activity}` is the chosen workout type; `{deadline}` must show the committed date, time and timezone under the T02 policy. No exercise duration or intensity target is selected here. These sentences are the completion promise, not a complete activation screen: the submission cutoff is defined in T02; rewards and Recovery follow T04, while pause handling follows T05.

### Shared evidence rules

The player sees both evidence contracts before committing and chooses either mode at submission. The rule snapshot preserves both alternatives; switching between them does not change the workout promise. Completion declaration is required for either route. A missing declaration blocks submission with a request to confirm it; the model cannot supply it for the player.

An accepted evidence assessment means only that the image satisfies the selected visible-content criteria. Fulfillment additionally relies on the player’s declaration and backend eligibility checks. It is not independent verification of exercise. The accepted T02/T03 sections define timing eligibility, ambiguous/rejected follow-up and final outcomes. Reward amounts are specified in T04; this document implements no runtime behavior.

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

These are expected assessments under the accepted evidence contract, not executed model tests. Cases assume a completion declaration where stated; timing and backend resolution follow T02/T03.

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

Owner accepted the initiation title, completion promise without a universal duration/intensity minimum, submission-time evidence choice, photo context rule, record fields, privacy cropping, no GPS/EXIF requirement and non-terminal `unclear`/`rejected` assessments on 2026-09-24. Polish and English commitment/declaration copy above implements the same accepted meaning. Backend timing and final resolution are specified in T02/T03.

T01 specifies the contract with a synthetic content placeholder; actual Apple Fitness PL and EN examples and model evaluation remain pending. No actual layout support, product implementation or AI accuracy has been demonstrated. The remaining epic tasks are not completed by this decision.

## Time policy

Status: **T02 accepted local decision: owner approval, 2026-09-24.** The owner accepted the complete time-policy proposal, including inclusive completion and receipt boundaries, offline/retry behavior and timezone interpretation. They neither change T01 evidence requirements nor complete T03–T06. No runtime behavior is implemented.

### Committed times

- Store workout completion deadline `D` as a UTC instant, with the selected IANA timezone and original local display value in the immutable rule snapshot. Show both `D` and first-evidence receipt cutoff `S = D + 15 minutes` before commitment. Backend time is authoritative. UTC storage and retained IANA timezone follow the existing [architecture rules](../engineering/architecture.md#reliability-rules); the 15-minute period and boundaries are accepted local decisions.
- Use inclusive boundaries: the workout must finish at or before `D`; the first complete evidence submission must reach the backend at or before `S`. The extra 15 minutes permit submission, not further exercise. Once `S` has passed, do not open a new first-submission attempt under this normal route. T03 defines final outcomes and the submission-incident review route; T06 defines appeals.
- Receipt `R` is the backend timestamp recorded atomically with a durable submission record after the complete upload is available in controlled storage, bound to the authenticated owner/Oath and accompanied by the declaration. Record it after synchronous upload-integrity checks, before asynchronous image assessment. Upload start, device time, a storage upload without a finalized submission, screenshot creation and queue completion are not `R`.
- A retry of the same finalized submission returns the original receipt; interrupted or unfinalized uploads have none. Changing evidence content is a new submission, not an idempotent replay. Later correction and bonus-upgrade windows cannot be inferred from this first-receipt rule; corrections follow T03; bonus upgrades follow T04.

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
| T02-09 | Submission server unavailable before cutoff; no durable receipt exists | Do not fabricate a timely receipt; apply the T03 incident/availability review route, not an automatic missed verdict |

The original timely receipt must survive queue delays and later correction requests. The accepted T03 correction policy permits two corrections of the same workout within one non-renewing 24-hour window. It cannot admit a new workout after `D`. T03 defines incident exceptions and terminal settlement; T06 defines post-terminal appeals.

### T02 decision record and handoff

Owner accepted the complete T02 proposal on 2026-09-24: inclusive `D` and `S = D + 15 minutes`, finalized durable server receipt, original receipt on identical retry, no offline backdating, immutable committed timezone with explicit DST disambiguation, and user-confirmed activity timezone when absent from the image. No visible finish time or timezone is fabricated. T03 defines infrastructure exceptions and correction windows; T06 defines appeals and retention. Artifact scenarios are specification checks, not executed application tests.

## Resolution table

Status: **T03 accepted local decision: owner approval, 2026-09-24.** The owner accepted correction/provider limits and the review/neutral-closure/incident route in two explicit replies. T01/T02 remain accepted. These are specified policies, not implemented behavior or staffed operational commitments.

### States and authority

Use `scheduled`, `active`, `proof_pending`, `needs_more_evidence`, `review_pending`, and terminal `fulfilled`, `missed`, `unresolved`, plus `withdrawn` under the accepted T05 pause policy. `unresolved` is a neutral closure, displayed as “Nierozstrzygnięta / Unresolved”: no fulfillment reward, no missed mark, no failure consequence or recovery eligibility. It does not remove existing XP. T04 specifies other reward/consequence effects. Recovery is a separate linked flow; it does not overwrite an original miss.

Only the backend changes Oath state. AI emits `accepted`, `rejected` or `unclear` for a particular evidence revision and committed rule version. A timeout, invalid response, unavailable provider or worker failure is an infrastructure error, never a fourth evidence verdict. Store bounded reason codes and version identifiers; apply the existing [security rules](../../.agents/rules/security.md) to proof access and logs. A review operator may inspect only authorized cases; T06 specifies operator responsibility, appeals and evidence retention; operational staffing/tooling still require verification before release.

### Correction clock

For an eligible first submission, open one 24-hour correction window at `A`, the backend timestamp when the first actionable `rejected` or `unclear` assessment, or backend timing-clarification requirement, and its reason become available in Oath detail. Do not start it from a hidden provider callback or push delivery. Let `C = A + 24 hours`, inclusive. Permit at most two additional finalized evidence revisions for the same workout, using the T01 alternatives; an identical transport retry consumes none. Revisions must reaffirm completion of the original workout by `D`. The correction clock never resets after another assessment.

The first evidence revision is immutable after receipt. A correction becomes current only upon complete durable receipt; until then the prior revision remains current. Accept a correction only in `needs_more_evidence`, with a slot remaining and receipt at or before `C`. Only one revision is assessed at a time. If a correction arrives by `C`, analysis may finish after `C`; the cutoff cannot turn pending analysis into a miss. If its result still needs correction after the window expires or after two corrections, go to review. An interrupted upload consumes no slot. Provider retries consume no correction slots.

### Transitions

| Trigger | Preconditions | Backend effect | Forbidden effect |
| --- | --- | --- | --- |
| Activation | Scheduled Oath reaches its committed activation | `scheduled → active` once | Repeated activation creates another Oath |
| First receipt | Active; owner-authorized complete receipt `R ≤ S` under T02 | `active → proof_pending`; enqueue revision assessment | Grant XP from upload alone |
| Cutoff reconciliation | Now strictly after `S`; no timely finalized submission; submission service known healthy throughout `[D,S]` | `active → missed` for absent timely proof | Mark missed while a timely receipt exists |
| Cutoff with service uncertainty | No timely receipt; confirmed incident overlaps `[D,S]`, or service availability is unknown | `active → review_pending`, infrastructure reason | Treat missing server receipt as proof the player did not exercise |
| Current accepted assessment | Matching current revision/rule/attempt; eligible receipt and no unresolved timing conflict | `proof_pending → fulfilled`; invoke backend settlement once under T04 | Let model grant XP or bypass timing eligibility |
| Current rejected/unclear assessment or backend timing conflict | Matching current revision; first adverse result or corrections remain within window | `proof_pending → needs_more_evidence`; publish reason and `C` | Resolve as missed solely from this verdict |
| Valid correction receipt | In `needs_more_evidence`; receipt `≤ C`, count below two | Increment correction count atomically; `→ proof_pending` for new revision | Reset `C`, change `D`, or reward a new workout |
| Correction exhausted or window elapsed | Adverse result after second correction, or now `> C` with no in-flight timely revision | `→ review_pending` with full revision history | Replace uncertainty with automatic player failure |
| Provider/worker failure | Current revision still pending | Keep pending and follow retry/escalation below | Consume a player correction or return `rejected` |
| Operator confirms fulfillment | `review_pending`; authorized decision confirms declaration, evidence and timing/exception eligibility | `→ fulfilled`; backend settlement once | Award directly from operator prose |
| Operator establishes nonfulfillment | `review_pending`; explicit finding such as player-confirmed noncompletion, or conclusively late completion without a timing ambiguity | `→ missed`, recorded reason | Use inability to verify as proof of failure |
| Operator cannot determine outcome, or review timer expires | `review_pending`; no supported fulfillment/nonfulfillment decision | `→ unresolved` | Award fulfillment XP or record a miss for uncertainty |

An accepted image assessment with missing/contradictory timing eligibility follows the same correction/review path as `unclear`, including opening `A/C` on the first such result. Preserve the original AI assessment separately from the backend timing reason; do not rewrite the model output or silently miss the Oath.

All transitions use the persisted current state/revision and committed policy version in an atomic state change. Deadline reconciliation and receipt finalization must serialize: a finalized `R ≤ S` wins over the absent-proof path, regardless of queue order. A late first upload cannot enter the normal correction route. A timestamp from another user's Oath cannot establish eligibility.

### Retries, incidents and no-response handling

For a pending revision, allow three provider attempts total: an initial attempt and retries no earlier than one and five minutes after the initial attempt starts. Stop retries on a valid current assessment. Each new attempt supersedes the previous attempt token; delayed responses from superseded attempts are ignored. If three attempts fail, escalate immediately to `review_pending`. Let `E = revision receipt + 15 minutes`. The valid assessment must be durably applied to the current revision in an atomic backend transition strictly before `E`. At or after `E`, the same transition first enters review, even if the escalation job has not run; retain the response only as review input. Provider response timestamps cannot override that rule. Thus exactly at `E`, escalation wins. Independently reconcile revisions reaching `E` without a valid applied assessment, even if the worker never started. A delayed scheduler evaluates the persisted deadline when it resumes; no exact worker-uptime guarantee is implied.

When entering review, persist `V` and a fixed closure time `V + 72 hours`. An authorized operator owns the queue; absent a supported decision by that time, settle neutrally as `unresolved`. An operator decision must be committed before the closure time; at or after it the neutral closure wins. An operator who cannot decide may close neutrally earlier, except that an incident case must preserve its full evidence-attachment window as specified below. Timely proof is not a miss merely because an operator or provider failed to respond. Retention must preserve the full evidence set through this route; T06 aligns deletion and appeal rules with this route; runtime verification is still required before release.

For a submission incident with no timely receipt, use an explicitly separate exceptional review route: allow an owner to attach evidence/declaration of the original workout until `S + 24 hours`, inclusive. Do not backdate receipt or extend workout deadline `D`. Only a confirmed service incident overlapping `[D,S]` can justify the submission exception; mere offline-device status cannot. A neutral closure of this incident case is permitted only strictly after `S + 24 hours`, or at the later 72-hour review timeout, preserving the inclusive attachment boundary. Closure and attachment receipt serialize; review considers any finalized eligible attachment before an operator closes the case. If the outage remains unconfirmed, the operator cannot award fulfillment under this exception. The case can close as missed only when healthy submission service and no timely proof are established; otherwise it closes neutrally. If service is still down, the persisted review/exception limits are evaluated after recovery rather than fabricated receipt times. Later-discovered incidents after a terminal settlement require the T06 appeal policy; they are not silently reopened by a callback.

Terminal results ignore automatic callbacks, duplicate cutoff jobs and duplicate operator commands. During `review_pending`, model callbacks cannot settle the case; an authorized operator may use a valid late response as review input before closure. During normal assessment, accept at most one result for the current attempt. Bonus upgrades after fulfillment follow T04; appeals after terminal outcomes follow T06; they cannot replay the original settlement.

### Artifact scenarios

| ID | Input → action | Expected result under T03 |
| --- | --- | --- |
| T03-01 | Timely complete proof; current assessment accepted, no timing conflict | Fulfilled once; reward amount follows T04 |
| T03-02 | First unclear reason published at 2026-09-24 19:00Z | `C = 2026-09-25 19:00Z`; two correction slots; no missed outcome |
| T03-03 | Second correction received exactly at `C`; assessment after `C` | Pending until valid result or escalation; accepted can still fulfill; adverse goes to review |
| T03-04 | First correction receives another unclear result before `C` | Original `C` remains; one slot remains |
| T03-05 | No correction received by `C`; reconcile strictly after `C` | Review pending, not automatic miss |
| T03-06 | Duplicate receipt retries and repeated provider failures | Original receipt/count retained; no player correction charged for provider failure |
| T03-07 | Third provider attempt fails, or receipt age reaches 15 minutes without valid result | Review pending; late automatic callbacks cannot settle |
| T03-08 | Prior revision/attempt response arrives after a newer one | Ignore for settlement; never undo current state |
| LOOP-09 | Concurrent accepted callbacks for same current attempt | One fulfillment transition and one settlement request effect, with deduplication required in T04 implementation |
| T03-09 | No proof after `S`, healthy service confirmed | Missed for lack of timely evidence; no AI verdict manufactured |
| T03-10 | Confirmed incident in `[D,S]`; same-workout evidence received at `S+24h` | Eligible for exceptional review, not automatic fulfillment and not a backdated receipt |
| T03-11 | Review has no operator decision at `V+72h` | Neutral unresolved outcome; no XP, miss or recovery eligibility |
| T03-12 | Image accepted but visible timing conflicts with declaration | Preserve AI result; backend opens correction/review path and first `A/C` if absent |
| T03-13 | Valid assessment atomically applied immediately before / exactly at / after `E` | Before: apply normal assessment; at/after: review wins, regardless of scheduler order |
| T03-14 | Operator cannot decide an incident case before or at `S+24h` | Keep review open for the full attachment window; no early neutral terminal result |

### T03 decision record and handoff

Owner accepted the single 24-hour window with two corrections, three provider attempts and 15-minute escalation, operator review with neutral closure after 72 hours, and incident-specific evidence through `S+24h` on 2026-09-24. The two explicit replies resolve both T03 decision questions. Artifact scenarios are not runtime tests. T06 defines appeals, operator responsibility and retention/deletion; T04 specifies reward amounts and post-fulfillment upgrades. No actual operator service or Apple Fitness layout support is claimed.

## Progression and Recovery

Status: **T04 accepted local decision: owner approval, 2026-09-24.** Three explicit replies accepted rewards/Recovery, bonus upgrade/reuse, and the initial five-level curve. These are initial balancing choices, not measured outcomes or implemented behavior. Artwork identifiers remain provisional DUMMY handoffs.

### Reward policy v1

Snapshot `workout_rewards_v1` with the Oath before activation, including amounts, evidence criteria and upgrade window. Later tuning applies to new commitments; it cannot silently alter an active or fulfilled Oath. Only backend settlement writes XP, atomically with the outcome and activity claim; repeated/concurrent events award nothing extra. Persist a unique settlement identity and monotonic highest-paid tier per Oath. This follows the accepted [progression direction](mvp.md#accepted-progression-direction) and [transaction/idempotency rules](../engineering/architecture.md#reliability-rules).

| Component or outcome | XP | Condition |
| --- | --- | --- |
| Base fulfillment | 30 | T01–T03 fulfillment; declaration alone is insufficient. This is an accounting component, not a separate evidence-free route |
| Context-photo tier | +10 | Accepted T01 contextual photo for this workout |
| Activity-record tier | +20 | Accepted T01 record with all required fields and eligible activity; Apple Fitness automated support still requires its real-layout evaluation |
| Fulfilled with photo / record | 40 / 50 total | Add base once and only the highest qualifying tier |
| Missed | 0 | No subtraction from existing XP or removal of unlocks |
| Unresolved | 0 | Neutral, no miss or Recovery eligibility under T03 |
| Successful Recovery | 15 total | Separate eligible Recovery below; no evidence bonus or later bonus upgrade |

Multiple images, calorie/step/distance values and disclosure of identity/location do not increase XP. Failure to qualify for a higher tier preserves already established fulfillment and its existing reward. A context photo does not qualify for the record tier merely because it contains a watch; the required record fields must be readable and assessed under the record contract.

### Bonus upgrade

Let `F` be the server timestamp of initial fulfillment settlement. A photo-tier Oath permits one finalized upgrade submission, received at or before `U = F + 24 hours`, inclusive, presenting a qualifying record of the same original workout. The one submission is separate from the two pre-fulfillment corrections; an interrupted upload or identical transport retry consumes no additional slot. A record-tier Oath already has the maximum and needs no upgrade. An upgrade changes neither the original completion deadline nor the fulfilled outcome.

Assess the upgrade separately, using T03's three provider attempts, 15-minute escalation and up-to-72-hour operator review limits. These statuses belong to the upgrade request, not the fulfilled Oath. An accepted qualifying record pays only `20 - 10 = 10 XP`; a repeated settlement pays zero. A rejected/unclear upgrade goes to review without new player corrections. Unsupported or inconclusive evidence, or review expiry, closes the upgrade without additional XP and preserves the original 40 XP. Timely upgrade receipt remains eligible despite later analysis; receipt after `U` is ineligible, and first-submission incident exceptions do not extend this optional bonus window. T06 defines appeals, including discovered errors, without authorizing automatic clawbacks here.

### Activity reuse boundary

One physical workout may support only one original Oath or one Recovery, never both or two separate commitments. Initial fulfillment requires the player to attest the workout belongs to that commitment and was not submitted for another one; upgrades and corrections retain the same activity claim. Recovery always requires a new workout begun after its own activation. Do not split one session into multiple claims for rewards.

Backend ties an owner-scoped activity claim to one commitment at first finalized submission; a unique claim/commitment association prevents duplicate reward for that known claim. A missed/unresolved commitment does not transfer its original workout into Recovery. Repeated uploads or a known reused claim cannot create a new entitlement; a detected inconsistent reuse claim follows T03 clarification/review instead of a fabricated authenticity verdict. Similar images alone are not conclusive reuse evidence. Screenshots and declarations cannot reliably identify every duplicate, edited image or different-account claim; this is a game rule with bounded enforcement, not verified provider identity or universal fraud detection. T06 defines the minimum claim metadata lifetime and deletion interactions for this rule.

### Recovery contract

For an original Oath marked `missed` at server time `M`, offer one linked Recovery. It is unavailable for `fulfilled`, `unresolved`, a pending original Oath or a Recovery itself. A preview consumes nothing; activating Recovery consumes the original Oath's single attempt, with idempotent activation returning the same Recovery. There is no chain of Recovery attempts.

The accepted window requires **completion within 24 hours of the miss**. Commit and activate before `D_R = M + 24 hours`; complete a new workout of the original activity type after Recovery activation and at or before `D_R`; complete evidence receipt at or before `S_R = D_R + 15 minutes`. No universal duration/intensity minimum is introduced. Display the fixed deadline, same T01 evidence alternatives and 15 XP reward before activation. Recovery retains the original committed timezone and snapshots the original v1 reward policy.

Use the same T02/T03 receipt, correction, provider/review and incident rules with Recovery deadlines. Timely Recovery proof can resolve after `D_R` or `S_R`. A successful Recovery grants 15 XP exactly once; failed, expired or unresolved Recovery grants zero and offers no further Recovery. Never subtract original XP. If no Recovery was activated before `D_R`, availability expires without creating a second miss. An activated Recovery follows normal settlement, including no-proof reconciliation after `S_R`.

History retains original `missed` plus the linked Recovery outcome, with a “Nadrobiona / Recovered” presentation only after Recovery success. The original state and original reward remain unchanged. Pause/illness interaction follows T05; this contract does not require exercise during illness or grant an extension by assumption. Appeals reversing an original result while Recovery exists follow T06 reconciliation.

### Initial levels and unlock ownership

Use a player progression policy `levels_v1` separate from per-Oath reward snapshots. Start at level 1 with 0 lifetime awarded XP. Accepted initial cap: level 5; XP continues accumulating at the cap, with no implied unpublished level threshold. New levels or curve migrations require an explicit later version. No loss of levels/unlocks from an ordinary miss. For levels 1–4, show the next threshold and unlock before earning it; at the cap, show that the initial progression track is complete.

| Level | Total XP threshold | XP from previous level | Proposed content handoff (not an existing asset) |
| --- | --- | --- | --- |
| 1 | 0 | — | DUMMY `companion_base`: starting form |
| 2 | 100 | 100 | DUMMY `ember_mark`: small original mark/detail |
| 3 | 250 | 150 | DUMMY `guardian_token`: small ornament |
| 4 | 450 | 200 | DUMMY `oath_binding`: small equipment detail |
| 5 | 700 | 250 | DUMMY `spark_mantle`: first larger milestone change |

These are content identifiers and ideas, not accepted lore names or generated graphics. MVP-03 owns original visual design, bilingual names and selected asset exports; MVP-09 owns the backend threshold/unlock ledger and display. Each eligible level unlock is granted once per player/catalog entry, including when one XP settlement crosses several thresholds; retries cannot duplicate it. Real artwork is not present for these IDs. The four-stage companion concept direction remains broader concept work; this initial five-level catalog does not assert that four finished forms exist. T07 must keep missing selected assets visible in the downstream handoff.

### Artifact scenarios

| ID | Input → action | Expected result under T04 |
| --- | --- | --- |
| LOOP-13 | Photo and record from one eligible workout → settle | 50 XP total, not 60; file count adds nothing |
| LOOP-14 | Fulfilled photo Oath already paid 40 XP; record upgrade receipt exactly `F+24h` → accept twice | First settlement +10, duplicate +0; total 50; Oath remains fulfilled |
| T04-01 | Upgrade receipt just after `F+24h`, or timely upgrade unresolved | No extra XP; original 40 XP retained |
| LOOP-15 | Accepted record shows 500 kcal, steps and distance | Still 50 XP total; no metric conversion |
| LOOP-17 | Known workout claim submitted for another Oath/Recovery | No second entitlement; clarify/review inconsistent claim, no automatic image-authenticity conclusion |
| LOOP-10 | Original miss at 2026-09-24 19:00Z; Recovery activated next morning, new workout completed by 2026-09-25 19:00Z and receipt by 19:15Z | Successful Recovery gives 15 XP once; original miss remains |
| T04-02 | Attempt first Recovery activation exactly at `M+24h`, or request a second Recovery after an activated one fails | No new Recovery available; no XP |
| T04-03 | Recovery timely proof meets record tier, including repeated callback | 15 XP once; no evidence bonus or upgrade |
| T04-04 | Original unresolved outcome, or Recovery still pending after its cutoff | No Recovery from unresolved; pending proof retains eligibility, not a timer-generated failure |
| LOOP-16 | Player has 90 XP; earns 40 XP, then duplicate settlement arrives | 130 XP, level 2, its unlock once; duplicate changes nothing |
| T04-05 | Player at 690 XP earns 50 XP | 740 XP, level 5 milestone once; XP continues accumulating at cap |

### T04 decision record and handoff

Owner accepted all three T04 decision questions on 2026-09-24: 30 base XP plus highest 10/20 bonus; one new same-type Recovery workout completed within 24 hours of the miss, with 15 minutes for evidence and 15 XP without bonus or chaining; one bonus upgrade received within 24 hours of fulfillment with delta-only payment; one workout per commitment; initial levels 1–5 at total XP 0/100/250/450/700, continuing XP accumulation at the cap. Unlock content ideas remain provisional DUMMY identifiers for MVP-03/09. T05 specifies pause; T06 defines appeals/retention/reconciliation, and real artwork/layout compatibility remains pending. No application tests or gameplay runtime are claimed.

## Pause and alternatives

Status: **T05 accepted local decision: owner approval, 2026-09-24.** Two explicit replies accepted pause/neutral withdrawal and its Recovery interaction/Minimum Quest deferral. This extends the specified terminal outcomes with `withdrawn`; no runtime behavior is implemented.

### Pause contract

Pause is an explicit player action affecting their Oaths and Recovery, with no required reason, illness diagnosis or medical upload. An illness disclosure prompts a neutral offer to pause; model interpretation does not itself alter commitments. Provide a direct control that works without an AI response. Before confirming pause, show which commitments will be withdrawn and which proof/review cases keep their existing deadlines. Do not ask the player to exercise to avoid losing progress.

Snapshot this opt-out policy before activation in future commitments. Add terminal `withdrawn` (“Wycofana / Withdrawn”) for voluntary withdrawal without a miss, XP, evidence bonus or Recovery eligibility. It differs from T03's `unresolved`, which denotes unresolved evidence/infrastructure. Preserve withdrawn history and all prior XP/unlocks. It is not fulfillment, a moved deadline or an erased miss. The initial game loop has no runtime Oaths to migrate; any later policy change must respect the existing committed version.

Pausing does not stop the server clock. It disables new commitment/Recovery activation and suppresses workout interventions, deadline reminders, correction reminders and re-engagement pressure until explicit resume. In-app status and user-initiated proof/review actions remain available. Evidence corrections and upgrades concern the existing workout and may be submitted voluntarily while paused; never suggest performing another workout to satisfy them. Keep account/security communications outside this gameplay suppression rule.

### Pause decision table

| State at the authoritative pause transaction | Effect on commitment/deadlines | Reward, history and resume behavior |
| --- | --- | --- |
| Scheduled original Oath, not activated | Mark `withdrawn`; cancel activation/interventions | No XP/miss/Recovery; resume requires a new commitment |
| Active original Oath without a finalized first submission | Mark `withdrawn`; cancel future outcome/reminder jobs or make them no-ops | No XP/miss/Recovery; upload bytes without a durable submission confer no eligibility |
| Original proof pending, including a timely finalized submission awaiting AI | Keep `proof_pending`; analysis and T03 timeouts continue | May still fulfill for the declared original workout; no restart or deadline shift |
| Needs more evidence or review pending, including submission-incident review | Keep current state and original correction/attachment/review clocks | Optional correction/review remains possible; T03 settles or closes neutrally; no exercise prompts |
| Original already fulfilled | Preserve fulfillment; the T04 upgrade window keeps running | Retain XP/unlocks; pending upgrade assessment may add only its valid delta |
| Original already missed, Recovery not activated | Preserve original miss; disable Recovery activation while paused; existing `M+24h` availability continues | Resume can offer Recovery only if the original window has not expired; no new 24-hour window |
| Recovery activated without finalized proof | Mark that Recovery `withdrawn`; original miss and used attempt remain | No Recovery XP and no replacement attempt; do not add a second miss |
| Recovery proof/correction/review pending | Keep the pending Recovery and its original clocks | May still grant 15 XP once if fulfilled; original miss remains |
| Already unresolved, withdrawn, or Recovery terminal | Preserve outcome and history | No replay, new attempt or refund; resume changes only pause state |

Pause is global for this player's first-loop commitments: it withdraws all scheduled originals and active commitments without finalized proof, and suppresses future gameplay interventions. It does not affect another player's state. Resume only clears the pause flag; it does not reactivate withdrawn commitments, reset any receipt/deadline/window, or replay suppressed reminders. New commitments require explicit acceptance of their own rules. The player may remain paused indefinitely; no automatic resume or recurring guilt message is scheduled.

### Pause race and delivery rules

Pause, activation, receipt finalization, cutoff reconciliation and outcome settlement use the persisted state under an atomic serialization boundary. A finalized submission committed before pause is preserved; if pause withdraws first, an unfinished first submission cannot resurrect the commitment. Return its current withdrawn state and offer no backdated receipt. Cutoff jobs must recheck state before writing a miss.

When pausing, first apply any logically expired no-proof cutoff using the accepted T03 service-availability rules: if now is strictly after `S` with no timely receipt, a delayed worker cannot make that Oath eligible for withdrawal instead of its due missed/review outcome. At or before `S`, an active Oath without finalized proof may be withdrawn. Apply the same rule to Recovery using `S_R`. Likewise, an expired review or correction timer follows its existing policy; pause cannot reset it. Identical pause/resume requests are idempotent and never restore a spent Recovery attempt.

Recheck the pause flag when dispatching every gameplay notification or generating an intervention; invalidate outstanding local reminders where the client can do so. A push already handed to the OS/provider may still appear: do not promise recall of delivered/in-flight messages. Opening such a message must show current state, with no obsolete call to exercise. After resume, only new applicable events may produce reminders; no catch-up burst. This is a required future delivery behavior, not verified native notification handling.

### Minimum Quest decision

Defer Minimum Quest beyond the first loop. No smaller replacement workout or reduced-XP alternative can replace a committed Oath before its deadline. Recovery remains the separate post-miss contract in T04, and pause is the neutral opt-out above. A future Minimum Quest must be explicitly included in a new commitment's rule snapshot before activation; it is not a discretionary change made by the companion.

### Artifact scenarios

| ID | Input → action | Expected result under T05 |
| --- | --- | --- |
| LOOP-11 | Pause before activation / active without proof before cutoff / after timely proof receipt | Respectively withdrawn / withdrawn / evidence remains pending; no pressure in all three |
| T05-01 | Player mentions illness without selecting pause | Offer pause without medical proof or exercise pressure; no silent rule/state change |
| T05-02 | Pause then resume a withdrawn Oath | It stays withdrawn, with zero XP and no Recovery; new Oath needs a new commitment |
| T05-03 | Pause while a correction window is open and send nothing | Existing clock runs; after expiry T03 review applies, then neutral closure if undecidable; no reminders |
| T05-04 | Finalized receipt commits before pause / pause commits before unfinished upload | Preserve pending proof / withdraw and refuse resurrection; never duplicate outcome |
| T05-05 | Pause after `S`; no timely proof; cutoff worker has not run | Apply due T03 missed/review route before pause effects, not retroactive withdrawal |
| T05-06 | Recovery activated, then paused without proof before `S_R` | Recovery withdrawn, slot consumed, zero XP; original miss remains; no chained attempt |
| T05-07 | Resume after unactivated Recovery availability expired | No Recovery offered; original miss unchanged |
| T05-08 | Pause while fulfilled Oath's valid upgrade is being assessed | Keep fulfillment/reward; accepted same-workout upgrade may pay the delta once |
| T05-09 | Stale reminder opened during pause | Current passive status; no call to exercise or revive the withdrawn commitment |
| T05-10 | Companion suggests reducing today's committed workout | No Minimum Quest substitution; show only the accepted pause or applicable Recovery rules |

### T05 decision record and handoff

Owner accepted neutral withdrawal for scheduled/active commitments without finalized proof before the applicable cutoff, preservation of pending evidence with unchanged clocks, gameplay reminder suppression without medical evidence, no restoration of Recovery attempts/windows on resume, and deferral of Minimum Quest on 2026-09-24. Expired cutoffs are reconciled before pause effects. T06 specifies deletion, appeal reconciliation and operator responsibility; operating procedures require implementation. No native notification delivery or product state implementation is claimed.

## Review and retention

Status: **T06 accepted local decision: owner approval, 2026-09-24.** All three appeal/reconciliation, retention/operator and deletion questions were explicitly accepted. Periods below are local product/engineering choices, not legal retention requirements, compliance claims or existing support guarantees. T03 review and T05 pause rules remain accepted. This section specifies the additional appeal/data-lifecycle contract to implement in MVP-08/14.

### Responsibility and access

The project owner is accountable for assigning the `review_operator` role and checking its queue during the private alpha. Operators access only cases assigned through the protected review service, with explicit authorization and an audit of case ID, actor ID, decision code and policy version. Do not put images, signed URLs, medical narratives or unrestricted player/model text in audit/analytics logs. Players may access/request review only for their own commitments. These boundaries follow the existing [security rules](../../.agents/rules/security.md); the staffing role is an accepted local decision.

The protected in-app Oath detail is the request/status channel; push delivery is optional and does not establish receipt. There is no promise of an email/helpdesk integration. Before accepting real proofs, MVP-08/14 must implement and exercise role assignment, private evidence access, deadlines, deletion and operator decisions. In development the reviewer can be a deterministic DUMMY decision fixture with synthetic evidence; it is not an available human service. No real provider calls are authorized by this specification.

### Terminal appeal

T03 automatically reviews pending ambiguous/infrastructure cases and may close them neutrally. Separately, permit **one player-requested appeal per original Oath, per Recovery, or per closed upgrade request**. Let `T` be the server timestamp when its terminal result is first available in detail. The owner may request an appeal at or before `T + 7 days`, inclusive. Pause does not extend the window. Store an idempotent request receipt `Q`; retries do not consume extra appeals or restart clocks. A successful amendment does not open another appeal allowance for that object.

An appeal challenges a terminal result or reward using existing evidence, bounded same-workout clarification or a documented system error. It cannot introduce a different workout, change `D`, bypass first-receipt eligibility, or revive an ordinary late first submission. For incident exceptions, use the accepted T03 incident/evidence limits; clarification attached to an appeal is not a backdated first receipt. Erroneous withdrawal may be corrected only if historical evidence establishes that the accepted T05 withdrawal rule was misapplied. A voluntary valid withdrawal stays withdrawn.

An authorized operator may grant an appeal only when the accepted evidence/timing/reward rules support the change. Permitted outcome amendments are fulfillment when its requirements are met, or correction of an erroneous miss to `unresolved` (uncertainty/infrastructure) or `withdrawn` (misapplied pause rule). A fulfilled outcome can receive only a supported unpaid reward correction, never a downgrade. Other terminal outcomes remain unchanged unless the appeal establishes fulfillment or the documented pause error; an inconclusive appeal alone is not evidence for an amendment. Keep a versioned amendment event and original outcome history; apply only the unpaid reward difference atomically and once. A player's appeal cannot reduce already granted XP, turn a fulfilled result into a miss, or remove unlocks under this initial contract. Suspected abuse outside these rules is a separate future policy, not an implicit operator power.

The operator must commit a decision strictly before `Q + 72 hours`; at or after that boundary the appeal closes as `not_resolved`, leaving the existing Oath/Recovery/reward unchanged. An unsupported appeal closes as `not_granted`, also unchanged. The UI distinguishes both from a supported amendment (`granted`) and explains that no new penalty was applied. This is an appeal-request status, not T03 `review_pending`: an unresolved appeal does not convert an existing missed result into a new neutral Oath or restart Recovery. At timeout, late operator responses cannot amend automatically. T07 must include bilingual copy for these distinctions before product implementation.

### Original/Recovery reconciliation

While an original miss is appealed, its existing Recovery availability and clock continue under T04/T05; the appeal does not extend them. If an appeal removes the original miss by amending it to `fulfilled`, `unresolved` or `withdrawn`, stop offering unactivated Recovery. Honor every Recovery already activated before the amendment: its committed deadlines and proof route remain, and success can still earn its separate 15 XP. Previously awarded Recovery XP is retained. A neutral amendment grants no original fulfillment reward, but still honors previously activated Recovery and any earned 15 XP. Because Recovery requires a distinct new workout, an original fulfillment reward plus Recovery reward is not duplicate payment for one activity. Preserve both the original miss/amendment events and linked Recovery history.

Serialize Recovery activation with every original amendment that removes Recovery eligibility: if activation commits first, honor that one attempt; if amendment commits first, no Recovery can activate. An appeal granting Recovery fulfillment pays its previously unpaid 15 XP once; an upgrade appeal can pay only its unpaid evidence-tier delta. Never create another Recovery after either appeal. Display corrected original status and the separate Recovery result, rather than rewriting the old miss as though it never happened.

### Retention schedule

Keep raw proof private and only for the declared assessment/correction/review/appeal purpose. Raw proof includes uploads, thumbnails, transformed images and extracted/unrestricted text; treat those derived copies with the same lifecycle. This is a local data-minimization choice under the [security rules](../../.agents/rules/security.md).

| Data | Normal lifetime | Expiry/action |
| --- | --- | --- |
| Unfinalized upload/staging data | 24 hours after upload initiation | Delete if no durable submission references it; an expired upload must be restarted, never attached after purge |
| Finalized proof and derived copies | While its Oath/Recovery/upgrade or a related timely appeal is pending; then 30 days after the last terminal closure/amendment of those related cases | Purge all object versions and derived copies; retain only minimal outcome metadata |
| Minimal committed rule, outcome/reward ledger, activity-claim reference and unlock history | While the account exists | No raw image/text in this history; account deletion removes identifiable entries as below |
| Minimal operator access/decision audit | 90 days after event, or earlier account deletion | Purge actor/case-linked event data; no private proof/text payload |

One appeal within 7 days and a 72-hour decision window fits inside the ordinary 30-day terminal proof lifetime. A timely appeal pins its referenced proof until closure, then starts a fresh 30-day deletion clock. Shared references across a genuine same-workout upgrade use the latest applicable closure; do not purge evidence still required by an open eligible case. Expired queues must be reconciled against their persisted clocks before deciding whether a hold remains; delayed workers cannot silently delete evidence for an open in-window case. Run deletion reconciliation daily and target removal no later than 24 hours after normal expiry; failures require operational retry and visibility, not a false “deleted” status. Do not create raw-proof backups in the initial design; storage versions/caches count as live copies to purge.

### Explicit deletion

Offer deletion of a proof bundle separately from account deletion. Before confirming bundle deletion, identify the Oath/Recovery/upgrade cases that actually reference that proof bundle (not unrelated evidence for a separate Recovery workout) and explain that remaining evidence-based review/appeal cannot continue. Deletion takes precedence over the normal retention hold: revoke player/operator/provider access immediately where controlled, cancel queued use and reject future callbacks, then purge controlled live originals, derivatives and versions within 7 days. Close pending original/Recovery assessment neutrally with a `proof_deleted` reason; keep already settled rewards/history. Close a pending upgrade or appeal request without changing its underlying settled outcome. Do not invent a miss from voluntary proof deletion. A historical case whose proof was explicitly deleted cannot open a new evidence-based appeal; show that limit before confirmation. Do not re-upload to bypass this decision or restart the same case's clocks.

Account deletion immediately revokes sessions and proof access, stops new processing/reminders and closes pending cases without new rewards. Remove identifiable account/proof/history/claim/audit data from controlled live systems within 7 days. Operator access and in-flight callbacks must recheck deletion state before any decision or reward write. Preserve no recoverable player profile in anonymized analytics; retained aggregate counts must not carry account identifiers or evidence content.

For database backups containing metadata, use at most 30 days' retention after the live purge; deletion tombstones must be applied before a restored system accepts requests or starts jobs. Keep the minimal restricted deletion marker only until all affected backups expire, at most 37 days after request under this schedule, then remove it. Raw proofs are excluded from backups as above. Actual storage/provider deletion and retention settings must be verified before real evidence is collected; do not claim deletion from a processor merely because a local row was removed. If a selected service cannot support the agreed policy, resolve that mismatch before launch rather than conceal it. This is a technical acceptance target, not a claim of legal compliance or current configuration.

### Artifact scenarios

| ID | Input → action | Expected result under T06 |
| --- | --- | --- |
| LOOP-12 | Terminal outcome at 2026-09-24 19:00Z; appeal received 2026-10-01 19:00Z | Eligible at exact 7-day boundary; referenced proof held through decision; ordinary 30-day deletion cannot remove it |
| T06-01 | Appeal received just after `T+7d`, or second distinct appeal for same object | Ineligible; identical retry returns original request |
| T06-02 | Appeal has no supported decision at `Q+72h` | Request not_resolved; existing outcome/XP unchanged; no restarted Recovery |
| T06-03 | Original miss appealed successfully after a separate Recovery paid 15 XP | Original fulfillment reward paid once; prior 15 retained; both event histories visible |
| T06-04 | Original amendment races with Recovery activation | Activation first: honor committed Recovery; amendment first: no new Recovery |
| T06-05 | Third party requests a player's proof or appeal | Deny access; knowing object ID is insufficient |
| T06-06 | Explicit proof deletion while original review is pending | Revoke access/cancel processing; neutral closure, no reward or miss; controlled live copies purged within 7 days |
| T06-07 | Delete proof after 40 XP photo fulfillment while upgrade is pending | Preserve 40 XP; close upgrade without extra XP; deletion wins over retention hold |
| T06-08 | Account deletion races with accepted callback | Deletion gate prevents new post-deletion settlement; all identifiable live records removed within 7 days |
| T06-09 | Restore metadata backup containing a deleted account | Apply deletion markers before serving/processing; never resurrect account, claim or jobs |
| T06-10 | Normal retention expires while timely appeal is still open | Keep case evidence; purge only after applicable closure+30 days, unless explicit deletion supersedes |
| T06-11 | Supported appeal corrects original miss to unresolved/withdrawn while Recovery activation races | Activation first: honor that Recovery and any 15 XP; amendment first: no new Recovery. No original fulfillment XP for neutral amendment |

### T06 decision record and handoff

Owner accepted all three T06 questions on 2026-09-24: one appeal within 7 days and a 72-hour response window; honoring activated Recovery after a supported original amendment; 30-day terminal proof retention with timely-appeal protection, 24-hour unfinalized cleanup and 90-day minimal audit; owner-assigned operators; explicit proof/account deletion with immediate controlled access revocation, live purge within 7 days and metadata-backup/deletion-marker bounds of 30/37 days. Actual operator tooling, provider/storage configuration and deletion/restore tests remain MVP-08/14 acceptance gates. No legal compliance, current staffing or successful deletion of real data is claimed.
