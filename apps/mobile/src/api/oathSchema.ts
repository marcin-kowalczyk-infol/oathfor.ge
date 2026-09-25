import { exact } from './request';

// Versioned wire policy: changes require explicit client support, never silent reinterpretation.
const policy = {
  "templateVersion": "workout_oath_v1",
  "policyVersion": "workout_rewards_v1",
  "evidence": {
    "alternatives": [
      "photo",
      "activity_record"
    ],
    "declarationRequired": true,
    "routeChosenAtSubmission": true,
    "photo": "recognizable_activity_context",
    "recordRequiredFields": [
      "source",
      "activity",
      "date",
      "start_time",
      "positive_duration_with_units"
    ],
    "supportedRecordLayouts": [],
    "privacyCroppingAllowed": true,
    "requiresFace": false,
    "requiresGps": false,
    "requiresExif": false,
    "imageVerifiesCompletion": false,
    "workoutReuseAllowed": false
  },
  "rewards": {
    "base": 30,
    "photoBonus": 10,
    "recordBonus": 20,
    "photoTotal": 40,
    "recordTotal": 50,
    "highestTierOnly": true,
    "metricRewards": false,
    "upgradeAttempts": 1,
    "upgradeWindowSeconds": 86400,
    "upgradeDelta": 10,
    "upgradeRequiresSameWorkout": true
  },
  "consequences": {
    "missedXp": 0,
    "unresolvedXp": 0,
    "withdrawnXp": 0,
    "existingXpLoss": 0,
    "unlocksRemoved": false,
    "minimumQuestAvailable": false
  },
  "pause": {
    "global": true,
    "reasonRequired": false,
    "withdrawWithoutFinalizedProofThroughCutoff": true,
    "reconcileOverdueBeforeWithdrawal": true,
    "pendingClocksContinue": true,
    "resumeRestoresCommitments": false,
    "suppressesGameplayReminders": true
  },
  "recovery": {
    "eligibleOriginalState": "missed",
    "attempts": 1,
    "sameActivity": true,
    "newWorkoutAfterActivation": true,
    "completionWindowFromMissSeconds": 86400,
    "receiptGraceSeconds": 900,
    "activationStrictlyBeforeDeadline": true,
    "totalXp": 15,
    "evidenceBonus": false,
    "upgrade": false,
    "chaining": false,
    "preservesOriginalMiss": true,
    "pauseDoesNotRefundAttempt": true,
    "activatedRecoverySurvivesOriginalAmendment": true
  },
  "review": {
    "completionInclusive": true,
    "receiptInclusive": true,
    "receiptGraceSeconds": 900,
    "durableFinalizedReceiptRequired": true,
    "offlineBackdating": false,
    "unknownAvailability": "review_pending",
    "correctionAttempts": 2,
    "correctionWindowSeconds": 86400,
    "correctionClockStarts": "first_actionable_result_in_detail",
    "correctionsRequireSameWorkout": true,
    "providerAttempts": 3,
    "providerRetryAfterSeconds": [
      60,
      300
    ],
    "providerEscalationSeconds": 900,
    "reviewWindowSeconds": 259200,
    "incidentAttachmentWindowAfterCutoffSeconds": 86400,
    "incidentCannotCloseBeforeAttachmentWindow": true,
    "unresolvedIsNeutral": true,
    "appealAttempts": 1,
    "appealWindowSeconds": 604800,
    "appealDecisionWindowSeconds": 259200,
    "appealCannotReduceXp": true,
    "proofDeletionClosesPendingNeutrally": true,
    "providerRetryClockStarts": "initial_attempt_start",
    "providerEscalationClockStarts": "revision_receipt",
    "assessmentMustApplyStrictlyBeforeEscalation": true,
    "reviewClockStarts": "review_entry",
    "reviewDecisionStrictlyBeforeClosure": true,
    "incidentAttachmentAvailableWhileAvailabilityUnknown": true,
    "incidentFulfillmentRequiresConfirmedServiceIncident": true,
    "appealClockStarts": "terminal_result_available_in_detail",
    "appealDecisionStrictlyBeforeClosure": true
  }
} as const;

export type Activity = 'running' | 'strength_training' | 'mobility';
export type LocalTimeInput = { local: string; timezone: string; offset?: string };
export type PreviewInput = { activity: Activity; activation: { mode: 'now' } | { mode: 'scheduled'; time: LocalTimeInput }; deadline: LocalTimeInput };
export type ResolvedTime = { local: string; timezone: string; offset: string; explicitOffset: boolean; utc: string };
const sectionKeys = ['activation', 'timing', 'evidence', 'photo', 'activityRecord', 'privacy', 'rewards', 'consequence', 'pause', 'recovery', 'review', 'appeal'] as const;
export type RuleCopy = { title: string; subtitle: string; promise: string; declaration: string; activity: string; sections: Record<typeof sectionKeys[number], string> };
export type Snapshot = typeof policy & { activity: Activity; activation: { mode: 'now' | 'scheduled'; time: ResolvedTime | null }; deadline: ResolvedTime & { receiptCutoff: string }; copy: { pl: RuleCopy; en: RuleCopy } };
export type OathState = 'scheduled' | 'active' | 'proof_pending' | 'needs_more_evidence' | 'review_pending' | 'fulfilled' | 'missed' | 'unresolved' | 'withdrawn';
export type Oath = { id: string; state: OathState; snapshot: Snapshot; createdAt: string; activatedAt: string | null; terminalAt: string | null; reason: string | null; review: null | { enteredAt: string; closesAt: string } };
export type Preview = { id: string; snapshot: Snapshot };
export type PreviewEnvelope = { preview: Preview; serverTime: string };
export type StoredPreviewEnvelope = { preview: Preview; oathId: string | null };
export type OathEnvelope = { oath: Oath; serverTime: string };
export type OathListEnvelope = { items: Oath[]; nextCursor: string | null; serverTime: string; paused: boolean };
export type PauseEnvelope = { paused: boolean; revision: string; withdraw: string[]; preserve: string[]; serverTime: string };

export function isUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value); }
function activity(value: unknown): value is Activity { return value === 'running' || value === 'strength_training' || value === 'mobility'; }
function local(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(value)) return false;
  const date = new Date(`${value}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString() === `${value}.000Z`;
}
function utc(value: unknown): value is string { return typeof value === 'string' && value.endsWith('Z') && local(value.slice(0, -1)); }
function zone(value: unknown): value is string { return typeof value === 'string' && value.length <= 128 && (value === 'UTC' || /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value)); }
function offset(value: unknown): value is string { return typeof value === 'string' && value !== '-00:00' && /^[+-](?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value); }
function localInput(value: unknown): value is LocalTimeInput {
  return (exact(value, ['local', 'timezone']) || exact(value, ['local', 'timezone', 'offset'])) && local(value.local) && zone(value.timezone) && (!Object.hasOwn(value, 'offset') || offset(value.offset));
}
export function isPreviewInput(value: unknown): value is PreviewInput {
  if (!exact(value, ['activity', 'activation', 'deadline']) || !activity(value.activity) || !localInput(value.deadline)) return false;
  return (exact(value.activation, ['mode']) && value.activation.mode === 'now')
    || (exact(value.activation, ['mode', 'time']) && value.activation.mode === 'scheduled' && localInput(value.activation.time));
}
function matchesPolicy(value: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return Array.isArray(value) && value.length === expected.length && expected.every((entry, index) => matchesPolicy(value[index], entry));
  if (expected !== null && typeof expected === 'object') return exact(value, Object.keys(expected)) && Object.entries(expected).every(([key, entry]) => matchesPolicy(value[key], entry));
  return value === expected;
}
function resolved(value: unknown, deadline = false): value is ResolvedTime {
  if (!exact(value, deadline ? ['local', 'timezone', 'offset', 'explicitOffset', 'utc', 'receiptCutoff'] : ['local', 'timezone', 'offset', 'explicitOffset', 'utc'])
    || !local(value.local) || !zone(value.timezone) || !offset(value.offset) || typeof value.explicitOffset !== 'boolean' || !utc(value.utc)) return false;
  const minutes = (Number(value.offset.slice(1, 3)) * 60 + Number(value.offset.slice(4, 6))) * (value.offset[0] === '-' ? -1 : 1);
  if (Date.parse(`${value.local}Z`) - minutes * 60000 !== Date.parse(value.utc)) return false;
  if (value.timezone === 'UTC' && value.offset !== '+00:00') return false;
  return !deadline || (utc(value.receiptCutoff) && Date.parse(value.receiptCutoff) - Date.parse(value.utc) === 900000);
}
function copy(value: unknown): value is RuleCopy {
  if (!exact(value, ['title', 'subtitle', 'promise', 'declaration', 'activity', 'sections']) || !exact(value.sections, [...sectionKeys])) return false;
  const boundedText = (text: unknown): text is string => typeof text === 'string' && text.trim().length > 0 && text.length <= 6000;
  if (!['title', 'subtitle', 'promise', 'declaration', 'activity'].every(key => boundedText(value[key])) || !Object.values(value.sections).every(boundedText)) return false;
  const placeholders = (value.promise as string).match(/\{[^{}]*\}/g)?.sort();
  return placeholders?.join(',') === '{activity},{deadline}' && !(value.promise as string).replace('{activity}', '').replace('{deadline}', '').match(/[{}]/);
}
export function isSnapshot(value: unknown, committed = false): value is Snapshot {
  if (!exact(value, [...Object.keys(policy), 'activity', 'activation', 'deadline', 'copy'])
    || !Object.entries(policy).every(([key, expected]) => matchesPolicy(value[key], expected))
    || !activity(value.activity) || !resolved(value.deadline, true) || !exact(value.activation, ['mode', 'time'])
    || !['now', 'scheduled'].includes(value.activation.mode as string)
    || !exact(value.copy, ['pl', 'en']) || !copy(value.copy.pl) || !copy(value.copy.en)) return false;
  if (value.activation.time === null) return !committed && value.activation.mode === 'now';
  return resolved(value.activation.time) && Date.parse(value.activation.time.utc) < Date.parse(value.deadline.utc);
}
function preview(value: unknown): value is Preview { return exact(value, ['id', 'snapshot']) && isUuid(value.id) && isSnapshot(value.snapshot) && (value.snapshot.activation.mode !== 'now' || value.snapshot.activation.time === null); }
export function isPreviewEnvelope(value: unknown): value is PreviewEnvelope { return exact(value, ['preview', 'serverTime']) && preview(value.preview) && utc(value.serverTime); }
export function isStoredPreviewEnvelope(value: unknown): value is StoredPreviewEnvelope { return exact(value, ['preview', 'oathId']) && preview(value.preview) && (value.oathId === null || isUuid(value.oathId)); }
const states = ['scheduled', 'active', 'proof_pending', 'needs_more_evidence', 'review_pending', 'fulfilled', 'missed', 'unresolved', 'withdrawn'];
const terminalStates = ['fulfilled', 'missed', 'unresolved', 'withdrawn'];
export function isOath(value: unknown): value is Oath {
  if (!exact(value, ['id', 'state', 'snapshot', 'createdAt', 'activatedAt', 'terminalAt', 'reason', 'review']) || !isUuid(value.id)
    || !states.includes(value.state as string) || !isSnapshot(value.snapshot, true) || !utc(value.createdAt)
    || !(value.activatedAt === null || utc(value.activatedAt)) || !(value.terminalAt === null || utc(value.terminalAt))
    || !(value.reason === null || (typeof value.reason === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value.reason)))) return false;
  const time = value.snapshot.activation.time;
  if (!time || Date.parse(value.createdAt) > Date.parse(time.utc)) return false;
  if (value.activatedAt !== null && value.activatedAt !== time.utc) return false;
  if (value.snapshot.activation.mode === 'now' && (value.createdAt !== time.utc || value.activatedAt === null)) return false;
  if (value.state === 'scheduled' && (value.snapshot.activation.mode !== 'scheduled' || value.activatedAt !== null)) return false;
  if (!['scheduled', 'withdrawn'].includes(value.state as string) && value.activatedAt === null) return false;
  if (terminalStates.includes(value.state as string) !== (value.terminalAt !== null) || (value.terminalAt !== null && Date.parse(value.terminalAt) < Date.parse(value.createdAt))) return false;
  if (value.review !== null && (!exact(value.review, ['enteredAt', 'closesAt']) || !utc(value.review.enteredAt) || !utc(value.review.closesAt)
    || Date.parse(value.review.closesAt) - Date.parse(value.review.enteredAt) !== 259200000 || Date.parse(value.review.enteredAt) < Date.parse(value.createdAt))) return false;
  if (value.reason === 'service_availability_unknown' && (value.state !== 'review_pending' || value.review === null)) return false;
  return true;
}
export function isOathEnvelope(value: unknown): value is OathEnvelope { return exact(value, ['oath', 'serverTime']) && isOath(value.oath) && utc(value.serverTime); }
export function isOathListEnvelope(value: unknown): value is OathListEnvelope {
  return exact(value, ['items', 'nextCursor', 'serverTime', 'paused']) && Array.isArray(value.items) && value.items.length <= 100 && value.items.every(isOath)
    && new Set(value.items.map(item => item.id)).size === value.items.length && utc(value.serverTime) && typeof value.paused === 'boolean'
    && (value.nextCursor === null || (typeof value.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,1024}$/.test(value.nextCursor) && value.items.length > 0));
}
export function isPauseEnvelope(value: unknown): value is PauseEnvelope {
  if (!exact(value, ['paused', 'revision', 'withdraw', 'preserve', 'serverTime']) || typeof value.paused !== 'boolean'
    || typeof value.revision !== 'string' || !/^[0-9a-f]{64}$/.test(value.revision) || !utc(value.serverTime)
    || !Array.isArray(value.withdraw) || !Array.isArray(value.preserve) || !value.withdraw.every(isUuid) || !value.preserve.every(isUuid)) return false;
  const ids = [...value.withdraw, ...value.preserve];
  return new Set(ids).size === ids.length && (!value.paused || value.withdraw.length === 0);
}
