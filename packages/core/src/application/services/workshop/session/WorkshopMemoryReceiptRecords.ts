/**
 * `WorkshopTurn.projectMemoryReceipt` in the persisted session (ADR
 * 2026-11-04 D7, D12; epic Slice 3). Optional and additive: written only
 * when present, no `schemaVersion` bump. A session without it reads and
 * writes exactly as before.
 *
 * A receipt lives on its own session divider (`role: 'system'`,
 * `kind: 'divider'`, `participant: 'session'`, artifact `memory_receipt`),
 * and that artifact always carries one. It names the memory by id, title and
 * version, never by its body.
 */

import {
  WORKSHOP_MEMORY_RECEIPT_ACTIONS,
  WORKSHOP_MEMORY_RECEIPT_AUTHORS,
  type WorkshopProjectMemoryReceipt
} from '@messages';
import { PROJECT_MEMORY_FIELD_CHARACTERS } from '@shared/types/projectMemory';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import {
  enumAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import { memoryIdAt, oneLineAt } from '@/application/services/workshop/session/WorkshopMemoryProposalRecords';

/** A D14 version: the first 12 hex characters of a SHA-256. */
export const WORKSHOP_MEMORY_RECEIPT_VERSION = /^[0-9a-f]{12}$/;

/** Strict structure of one turn's `projectMemoryReceipt`, and that its divider and it go together. */
export function assertWorkshopMemoryReceiptShape(turn: Record<string, unknown>, path: string): void {
  const at = `${path}.projectMemoryReceipt`;
  const isReceiptTurn = turn.artifact === 'memory_receipt';
  if (turn.projectMemoryReceipt === undefined) {
    if (isReceiptTurn) {
      shapeError(at, 'a receipt on a memory_receipt divider');
    }
    return;
  }
  if (!isReceiptTurn || turn.role !== 'system' || turn.kind !== 'divider' || turn.participant !== 'session') {
    shapeError(at, 'a receipt only on a session memory_receipt divider');
  }
  const receipt = exactObject(
    turn.projectMemoryReceipt,
    at,
    ['action', 'memoryId', 'title', 'version', 'by'],
    ['proposedBy']
  );
  enumAt(receipt.action, `${at}.action`, WORKSHOP_MEMORY_RECEIPT_ACTIONS);
  memoryIdAt(receipt.memoryId, `${at}.memoryId`);
  oneLineAt(receipt.title, `${at}.title`, PROJECT_MEMORY_FIELD_CHARACTERS.title);
  if (typeof receipt.version !== 'string' || !WORKSHOP_MEMORY_RECEIPT_VERSION.test(receipt.version)) {
    shapeError(`${at}.version`, 'a memory version (12 lower-case hex digits)');
  }
  enumAt(receipt.by, `${at}.by`, WORKSHOP_MEMORY_RECEIPT_AUTHORS);
  if (receipt.proposedBy !== undefined && !isWorkshopPersonaId(receipt.proposedBy)) {
    shapeError(`${at}.proposedBy`, 'known Workshop persona id');
  }
}

export function cloneWorkshopMemoryReceipt(receipt: WorkshopProjectMemoryReceipt): WorkshopProjectMemoryReceipt {
  return {
    action: receipt.action,
    memoryId: receipt.memoryId,
    title: receipt.title,
    version: receipt.version,
    by: receipt.by,
    ...(receipt.proposedBy !== undefined ? { proposedBy: receipt.proposedBy } : {})
  };
}
