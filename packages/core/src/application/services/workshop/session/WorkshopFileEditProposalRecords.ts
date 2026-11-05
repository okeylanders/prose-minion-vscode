/**
 * `WorkshopTurn.fileEditProposals` in the persisted session (ADR 2026-11-05
 * D8; epic Slice 3). Optional and additive: written only when present, no
 * `schemaVersion` change in this slice (the release decision is ADR
 * 2026-07-30's, at the epic's end). A session without it reads and writes
 * exactly as before.
 *
 * When present it is exact: one to `proposalsPerReply` cards, only on a
 * persona's reply (a host or guest assistant turn), no two naming one file.
 * Each card holds:
 * - its `target`: a catalog key by `resource.read`'s rule, or the excerpt;
 * - its `operations`, by the trailer codec's own rule
 *   (`workshopFileEditOperationsFault`);
 * - its one-line `why`, within `whyCharacters`;
 * - its `state`, and `landed` exactly when it is applied: the file as the
 *   gateway resolved it, the version after, and each applied range's text
 *   with the operations it carries (each operation in at most one range);
 * - a `reason`, the host's one line, on an applied, stale or refused card
 *   only.
 *
 * No development checkpoint ever held another shape of this field, so no
 * normalization reads it.
 */

import {
  WORKSHOP_FILE_EDIT_RECORD_LIMITS,
  WORKSHOP_FILE_EDIT_STATES,
  type WorkshopFileEditLanded,
  type WorkshopFileEditOperation,
  type WorkshopFileEditProposal,
  type WorkshopFileEditTarget
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
/** What one applied range may hold: every operation's text joined into it. */
const RANGE_CHARACTERS = Math.max(
  BUDGETS.rewriteCharacters,
  BUDGETS.editReplaces * BUDGETS.replaceWithCharacters + 2 * BUDGETS.passageCharacters
) + CARD_OPERATIONS * BUDGETS.findCharacters;

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
  const targets: WorkshopFileEditTarget[] = [];
  (turn.fileEditProposals as unknown[]).forEach((item, index) => {
    const target = assertProposal(item, `${at}[${index}]`);
    if (targets.some((earlier) => sameWorkshopFileEditTarget(earlier, target))) {
      shapeError(`${at}[${index}].target`, 'a file no earlier card names');
    }
    targets.push(target);
  });
}

function assertProposal(value: unknown, at: string): WorkshopFileEditTarget {
  const proposal = exactObject(value, at, ['target', 'operations', 'why', 'state'], ['landed', 'reason']);
  const target = assertTarget(proposal.target, `${at}.target`);
  const operations = assertOperations(proposal.operations, `${at}.operations`);
  oneLineAt(proposal.why, `${at}.why`, BUDGETS.whyCharacters);
  enumAt(proposal.state, `${at}.state`, WORKSHOP_FILE_EDIT_STATES);
  if (proposal.state === 'applied') {
    assertLanded(proposal.landed, `${at}.landed`, operations.length);
  } else if (proposal.landed !== undefined) {
    shapeError(`${at}.landed`, 'absent on a card that was not applied');
  }
  if (proposal.reason !== undefined) {
    if (proposal.state === 'pending' || proposal.state === 'declined') {
      shapeError(`${at}.reason`, 'absent on a pending or declined card');
    }
    oneLineAt(proposal.reason, `${at}.reason`, WORKSHOP_FILE_EDIT_RECORD_LIMITS.reasonCharacters);
  }
  return target;
}

function assertTarget(value: unknown, at: string): WorkshopFileEditTarget {
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
  return value as WorkshopFileEditTarget;
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
      boundedStringAt(operation.text, `${at}.text`, op === 'rewrite' ? BUDGETS.rewriteCharacters : BUDGETS.passageCharacters);
      break;
    }
    default:
      shapeError(`${at}.op`, 'rewrite | replace | append | prepend');
  }
  return value as WorkshopFileEditOperation;
}

function assertLanded(value: unknown, at: string, operationCount: number): void {
  const landed = exactObject(value, at, ['target', 'version', 'ranges']);
  assertTarget(landed.target, `${at}.target`);
  if (!Number.isSafeInteger(landed.version) || (landed.version as number) < 0) {
    shapeError(`${at}.version`, 'a non-negative integer');
  }
  boundedArrayAt(landed.ranges, `${at}.ranges`, 1, operationCount, 'applied ranges');
  const carried = new Set<number>();
  landed.ranges.forEach((item, index) => {
    const range = exactObject(item, `${at}.ranges[${index}]`, ['operations', 'text']);
    boundedStringAt(range.text, `${at}.ranges[${index}].text`, RANGE_CHARACTERS);
    boundedArrayAt(range.operations, `${at}.ranges[${index}].operations`, 1, operationCount, 'operations');
    for (const operation of range.operations) {
      if (!Number.isSafeInteger(operation) || (operation as number) < 0 || (operation as number) >= operationCount
        || carried.has(operation as number)) {
        shapeError(`${at}.ranges[${index}].operations`, 'indexes of the card\'s operations, each in one range');
      }
      carried.add(operation as number);
    }
  });
}

export function cloneWorkshopFileEditProposal(proposal: WorkshopFileEditProposal): WorkshopFileEditProposal {
  return {
    target: cloneTarget(proposal.target),
    operations: proposal.operations.map((operation) => ({ ...operation })),
    why: proposal.why,
    state: proposal.state,
    ...(proposal.landed ? { landed: cloneLanded(proposal.landed) } : {}),
    ...(proposal.reason !== undefined ? { reason: proposal.reason } : {})
  };
}

function cloneTarget(target: WorkshopFileEditTarget): WorkshopFileEditTarget {
  return target.kind === 'excerpt' ? { kind: 'excerpt' } : { kind: 'resource', group: target.group, path: target.path };
}

function cloneLanded(landed: WorkshopFileEditLanded): WorkshopFileEditLanded {
  return {
    target: cloneTarget(landed.target),
    version: landed.version,
    ranges: landed.ranges.map((range) => ({ operations: [...range.operations], text: range.text }))
  };
}
