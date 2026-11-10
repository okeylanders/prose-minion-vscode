/**
 * `WorkshopTurn.fileEditProposals` in the persisted session (ADR 2026-11-05
 * D10; epic Slice 3). Optional and additive: written only when present, no
 * `schemaVersion` change in this slice (the release decision is ADR
 * 2026-07-30's, at the epic's end). A session without it reads and writes
 * exactly as before.
 *
 * When present it is exact: one to `proposalsPerReply` cards, only on a
 * persona's reply, no two requesting one file. Each card holds:
 * - `requested`: what the frame named, by `resource.read`'s rule, or the excerpt;
 * - `target`, `class` and `baseline` together, staging's (D4–D6): a
 *   `file` identity for a resource, an `excerpt` one for the excerpt, each a
 *   host-written `documentUri` and a safe display path. Only a card refused
 *   at staging lacks them, and it names its reason;
 * - `operations`, by the trailer codec's own rule;
 * - its one-line `why`;
 * - its `state` and, once settled (applied, partial, unknown), one outcome
 *   per operation: all landed when applied, some and not all when partial;
 * - one `landed` record per landed operation (N-01): its before and after
 *   within `revertCharacters` and its context within
 *   `landedContextCharacters`, or only their hashes;
 * - a `reason`, the host's one line, never on a pending, applying or
 *   declined card;
 * - no two cards naming one identity (`documentUri`), nor requesting one file;
 * - `intent`, optional (ADR 2026-11-10 D6; epic Reply Edit Actions Slice 2):
 *   `fixes` on a card that answers a reply's fixes offer, `rewrites` on one
 *   that answers a rewrites offer (its second addendum; a rewrites card
 *   saved before that carries none, and keeps its class's ceiling).
 *   Additive, like the field itself: no development checkpoint held another
 *   shape of it.
 * `landed` records exist only on applied and partial cards; an unknown card
 * records no landed operation.
 *
 * **Reopen** (D8): `applying` is a legitimate persisted state, written only
 * around a dispatched write. The codec reads it as written, so a file
 * round-trips; a session that is *reopened* reads it as `unknown`, by the read
 * rule `settleWorkshopFileEditProposalsOnReopen`, which hydration applies.
 * It is not a checkpoint normalization: no development shape is repaired.
 * No development checkpoint ever held another shape of this field.
 */

import {
  WORKSHOP_FILE_EDIT_CLASSES,
  WORKSHOP_FILE_EDIT_INTENTS,
  WORKSHOP_FILE_EDIT_OPERATION_OUTCOMES,
  WORKSHOP_FILE_EDIT_RECORD_LIMITS,
  WORKSHOP_FILE_EDIT_REOPENED_APPLYING_REASON,
  WORKSHOP_FILE_EDIT_STATES,
  workshopFileEditIdentityHoldable,
  type WorkshopFileEditOperation,
  type WorkshopFileEditOperationOutcome,
  type WorkshopFileEditProposal,
  type WorkshopFileEditRequestedTarget,
  type WorkshopTurn
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  boundedArrayAt,
  boundedStringAt,
  enumAt,
  exactObject,
  objectAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import { oneLineAt } from '@/application/services/workshop/session/WorkshopMemoryProposalRecords';
import {
  sameWorkshopFileEditTarget,
  workshopFileEditOperationsFault,
  workshopFileEditResourceFault
} from '@/utils/workshopFileEditProtocol';

const BUDGETS = PROMPT_BUDGETS.workshopFileEdits;
/** A rewrite stands alone, so a card holds at most its replaces, an append and a prepend. */
const CARD_OPERATIONS = BUDGETS.editReplaces + 2;
const SHA256 = /^[0-9a-f]{64}$/;
const SETTLED: readonly string[] = ['applied', 'partial', 'unknown'];
const NO_REASON: readonly string[] = ['pending', 'applying', 'declined'];
/** Only these record what landed. */
const LANDS: readonly string[] = ['applied', 'partial'];

/** Strict structure of one turn's `fileEditProposals`, and that its turn may carry them. */
export function assertWorkshopFileEditProposalShape(turn: Record<string, unknown>, path: string, checkpoint: boolean): void {
  if (turn.fileEditProposals === undefined) {
    return;
  }
  const at = `${path}.fileEditProposals`;
  if (!checkpoint && (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest'))) {
    shapeError(at, 'a host or guest persona reply');
  }
  boundedArrayAt(turn.fileEditProposals, at, 1, BUDGETS.proposalsPerReply, 'file edit suggestions');
  const requested: WorkshopFileEditRequestedTarget[] = [];
  const identities = new Set<string>();
  turn.fileEditProposals.forEach((item, index) => {
    const target = assertProposal(item, `${at}[${index}]`);
    if (requested.some((earlier) => sameWorkshopFileEditTarget(earlier, target))) {
      shapeError(`${at}[${index}].requested`, 'a file no earlier card names');
    }
    requested.push(target);
    // One card per file, by identity too (two requests may stage to one document).
    const documentUri = (item as { target?: { documentUri?: string } }).target?.documentUri;
    if (documentUri !== undefined) {
      if (identities.has(documentUri)) {
        shapeError(`${at}[${index}].target`, 'a document no earlier card names');
      }
      identities.add(documentUri);
    }
  });
}

function assertProposal(value: unknown, at: string): WorkshopFileEditRequestedTarget {
  const proposal = exactObject(
    value,
    at,
    ['requested', 'operations', 'why', 'state'],
    ['target', 'class', 'baseline', 'reason', 'outcomes', 'landed', 'intent']
  );
  if (proposal.intent !== undefined) {
    // Host-written at staging (ADR 2026-11-10 D6): a fixes answer's card, held to the fixes policy at every Apply.
    enumAt(proposal.intent, `${at}.intent`, WORKSHOP_FILE_EDIT_INTENTS);
  }
  const requested = assertRequested(proposal.requested, `${at}.requested`);
  const operations = assertOperations(proposal.operations, `${at}.operations`);
  oneLineAt(proposal.why, `${at}.why`, BUDGETS.whyCharacters);
  enumAt(proposal.state, `${at}.state`, WORKSHOP_FILE_EDIT_STATES);
  assertStaging(proposal, requested, at);
  if (proposal.reason !== undefined) {
    if (NO_REASON.includes(proposal.state as string)) {
      shapeError(`${at}.reason`, 'absent on a pending, applying or declined card');
    }
    oneLineAt(proposal.reason, `${at}.reason`, WORKSHOP_FILE_EDIT_RECORD_LIMITS.reasonCharacters);
  }
  const outcomes = assertOutcomes(proposal, operations.length, at);
  assertLanded(proposal.landed, `${at}.landed`, outcomes);
  return requested;
}

function assertRequested(value: unknown, at: string): WorkshopFileEditRequestedTarget {
  const kind = objectAt(value, at).kind;
  if (kind === 'excerpt') {
    exactObject(value, at, ['kind']);
    return { kind: 'excerpt' };
  }
  if (kind !== 'resource') {
    shapeError(`${at}.kind`, 'resource | excerpt');
  }
  const target = exactObject(value, at, ['kind', 'group', 'path']);
  if (typeof target.group !== 'string' || typeof target.path !== 'string'
    || workshopFileEditResourceFault(target.group, target.path) !== undefined) {
    shapeError(at, 'a configured resource: a known group and a workspace-relative path, within bounds');
  }
  return value as WorkshopFileEditRequestedTarget;
}

/** Staging's three fields together, matching what was requested; absent only on a card refused at staging. */
function assertStaging(proposal: Record<string, unknown>, requested: WorkshopFileEditRequestedTarget, at: string): void {
  const staged = [proposal.target, proposal.class, proposal.baseline].filter((field) => field !== undefined).length;
  if (staged === 0) {
    if (proposal.state !== 'refused' || proposal.reason === undefined) {
      shapeError(`${at}.target`, 'present, or the card refused at staging with its reason');
    }
    return;
  }
  if (staged !== 3) {
    shapeError(at, 'target, class and baseline together');
  }
  const target = exactObject(proposal.target, `${at}.target`, ['kind', 'documentUri', 'relativePath']);
  enumAt(target.kind, `${at}.target.kind`, [requested.kind === 'excerpt' ? 'excerpt' : 'file']);
  // A host-written identity: held to the staging contract, never the model's lookup grammar (PR #230 F-01).
  if (!workshopFileEditIdentityHoldable(target)) {
    shapeError(`${at}.target`, 'a host identity: a one-line documentUri and display path, each within its bound');
  }
  enumAt(proposal.class, `${at}.class`, WORKSHOP_FILE_EDIT_CLASSES);
  const baseline = exactObject(proposal.baseline, `${at}.baseline`, ['sha256', 'length']);
  sha256At(baseline.sha256, `${at}.baseline.sha256`);
  countAt(baseline.length, `${at}.baseline.length`);
}

function assertOperations(value: unknown, at: string): WorkshopFileEditOperation[] {
  boundedArrayAt(value, at, 1, CARD_OPERATIONS, 'operations');
  const operations = value.map((item, index) => assertOperation(item, `${at}[${index}]`));
  const fault = workshopFileEditOperationsFault(operations);
  if (fault) {
    shapeError(at, `operations by the trailer's rules (${fault})`);
  }
  return operations;
}

function assertOperation(value: unknown, at: string): WorkshopFileEditOperation {
  const op = objectAt(value, at).op;
  switch (op) {
    case 'replace': {
      const operation = exactObject(value, at, ['op', 'find', 'with']);
      boundedStringAt(operation.find, `${at}.find`, BUDGETS.findCharacters);
      boundedStringAt(operation.with, `${at}.with`, BUDGETS.replaceWithCharacters);
      break;
    }
    case 'rewrite':
    case 'append':
    case 'prepend': {
      const operation = exactObject(value, at, ['op', 'text']);
      boundedStringAt(operation.text, `${at}.text`, op === 'rewrite' ? BUDGETS.rewriteCharacters : BUDGETS.insertCharacters);
      break;
    }
    default:
      shapeError(`${at}.op`, 'rewrite | replace | append | prepend');
  }
  return value as WorkshopFileEditOperation;
}

/** One outcome per operation, exactly on a settled card; all landed when applied, some and not all when partial. */
function assertOutcomes(
  proposal: Record<string, unknown>,
  operationCount: number,
  at: string
): readonly WorkshopFileEditOperationOutcome[] | undefined {
  const state = proposal.state as string;
  if (proposal.outcomes === undefined) {
    if (state === 'applied' || state === 'partial') {
      shapeError(`${at}.outcomes`, 'one outcome per operation on an applied or partial card');
    }
    return undefined;
  }
  if (!SETTLED.includes(state)) {
    shapeError(`${at}.outcomes`, 'absent on a card that has not settled');
  }
  boundedArrayAt(proposal.outcomes, `${at}.outcomes`, operationCount, operationCount, 'outcomes');
  const outcomes = proposal.outcomes as WorkshopFileEditOperationOutcome[];
  outcomes.forEach((outcome, index) => enumAt(outcome, `${at}.outcomes[${index}]`, WORKSHOP_FILE_EDIT_OPERATION_OUTCOMES));
  const landed = outcomes.filter((outcome) => outcome === 'landed').length;
  if (!LANDS.includes(state) && landed > 0) {
    shapeError(`${at}.outcomes`, 'no landed operation on an unknown card (only applied and partial cards record what landed)');
  }
  if (state === 'applied' && landed !== operationCount) {
    shapeError(`${at}.outcomes`, 'every operation landed on an applied card');
  }
  if (state === 'partial' && (landed === 0 || landed === operationCount)) {
    shapeError(`${at}.outcomes`, 'some operations, not all, landed on a partial card');
  }
  return outcomes;
}

/** One record per landed operation, and none otherwise. */
function assertLanded(value: unknown, at: string, outcomes: readonly WorkshopFileEditOperationOutcome[] | undefined): void {
  const landedOperations = (outcomes ?? []).flatMap((outcome, index) => outcome === 'landed' ? [index] : []);
  if (value === undefined) {
    if (landedOperations.length > 0) {
      shapeError(at, 'one record per landed operation');
    }
    return;
  }
  if (landedOperations.length === 0) {
    shapeError(at, 'absent when no operation landed');
  }
  boundedArrayAt(value, at, landedOperations.length, landedOperations.length, 'landed records');
  const seen = new Set<number>();
  value.forEach((item, index) => {
    const itemAt = `${at}[${index}]`;
    const operation = objectAt(item, itemAt).operation;
    if (typeof operation !== 'number' || !landedOperations.includes(operation) || seen.has(operation)) {
      shapeError(`${itemAt}.operation`, 'a landed operation no other record names');
    }
    seen.add(operation);
    if ('beforeSha256' in (item as object)) {
      const record = exactObject(item, itemAt, ['operation', 'beforeSha256', 'afterSha256']);
      sha256At(record.beforeSha256, `${itemAt}.beforeSha256`);
      sha256At(record.afterSha256, `${itemAt}.afterSha256`);
      return;
    }
    const record = exactObject(item, itemAt, ['operation', 'before', 'after', 'contextBefore', 'contextAfter', 'versionAfter']);
    boundedStringAt(record.before, `${itemAt}.before`, BUDGETS.revertCharacters);
    boundedStringAt(record.after, `${itemAt}.after`, BUDGETS.revertCharacters);
    boundedStringAt(record.contextBefore, `${itemAt}.contextBefore`, BUDGETS.landedContextCharacters);
    boundedStringAt(record.contextAfter, `${itemAt}.contextAfter`, BUDGETS.landedContextCharacters);
    countAt(record.versionAfter, `${itemAt}.versionAfter`);
  });
}

function sha256At(value: unknown, at: string): void {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    shapeError(at, 'a SHA-256 (64 lower-case hex digits)');
  }
}

function countAt(value: unknown, at: string): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    shapeError(at, 'a non-negative integer');
  }
}

/**
 * The reopen rule (D8): a card found `applying` in a session being reopened
 * reads as `unknown`, its write's outcome unknowable, with every operation's
 * outcome `unknown`. Returns the turn itself when it holds no such card.
 */
export function settleWorkshopFileEditProposalsOnReopen(turn: WorkshopTurn): WorkshopTurn {
  if (!turn.fileEditProposals?.some((proposal) => proposal.state === 'applying')) {
    return turn;
  }
  return {
    ...turn,
    fileEditProposals: turn.fileEditProposals.map((proposal): WorkshopFileEditProposal => proposal.state !== 'applying'
      ? proposal
      : {
        ...proposal,
        state: 'unknown',
        reason: WORKSHOP_FILE_EDIT_REOPENED_APPLYING_REASON,
        outcomes: proposal.operations.map(() => 'unknown' as const)
      })
  };
}

export function cloneWorkshopFileEditProposal(proposal: WorkshopFileEditProposal): WorkshopFileEditProposal {
  return JSON.parse(JSON.stringify(proposal)) as WorkshopFileEditProposal;
}

/** One card's settlement (D8, D10): what Apply, Decline or a preview leaves on it. */
export interface WorkshopFileEditSettlement {
  readonly state: WorkshopFileEditProposal['state'];
  readonly reason?: string;
  readonly outcomes?: readonly WorkshopFileEditOperationOutcome[];
  readonly landed?: WorkshopFileEditProposal['landed'];
}

export function workshopFileEditProposalAt(turn: Pick<WorkshopTurn, 'fileEditProposals'> | undefined, index: number): WorkshopFileEditProposal | undefined {
  return Number.isSafeInteger(index) && index >= 0 ? turn?.fileEditProposals?.[index] : undefined;
}

/**
 * A turn's cards with the one at `index` settled, held to the session
 * codec's rules (`assertWorkshopFileEditProposalShape`): its staging,
 * operations and why are kept, and only state, reason, outcomes and landed
 * records change, replacing what it had. Throws on a turn with no card
 * there, or on a settlement the codec would refuse, so nothing a session
 * could not read back is ever held.
 */
export function settleWorkshopFileEditProposal(
  turn: WorkshopTurn,
  index: number,
  settlement: WorkshopFileEditSettlement
): WorkshopFileEditProposal[] {
  const proposals = turn.fileEditProposals;
  const current = workshopFileEditProposalAt(turn, index);
  if (!proposals || !current) {
    throw Object.assign(new Error('That message no longer holds this suggested edit.'), { reason: 'no-card' });
  }
  const { state: _state, reason: _reason, outcomes: _outcomes, landed: _landed, ...kept } = current;
  const settled: WorkshopFileEditProposal = {
    ...kept,
    state: settlement.state,
    ...(settlement.reason !== undefined ? { reason: settlement.reason } : {}),
    ...(settlement.outcomes !== undefined ? { outcomes: [...settlement.outcomes] } : {}),
    ...(settlement.landed !== undefined ? { landed: settlement.landed.map((record) => ({ ...record })) } : {})
  };
  const next = proposals.map((proposal, at) => at === index ? settled : proposal);
  assertWorkshopFileEditProposalShape({ ...turn, fileEditProposals: next } as unknown as Record<string, unknown>, `turn ${turn.id}`, false);
  return next.map(cloneWorkshopFileEditProposal);
}
