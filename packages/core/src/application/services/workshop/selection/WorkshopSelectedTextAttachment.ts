/**
 * The editor's selection as a Workshop message attachment (ADR 2026-11-14
 * D13). Pure.
 *
 * A snapshot (`EditorSelectionSnapshots`) becomes a one-shot attachment the
 * writer sends with a message or removes. Its label is "Selected Text", its
 * display path the file's, its truncation the cut made at capture, and its
 * meta (`selectedText`) the snapshot's id and lines. The frame is kind
 * `selected-text`, whose preamble says where the text was selected and that
 * it is neither the writer's own words nor the room's excerpt; the frame
 * neutralizes its body like any other.
 *
 * Its identity is the snapshot id (`WorkshopMessageAttachmentIdentity`), so
 * staging twice, Rewind's restage and hydration never put one selection
 * above the composer twice.
 */

import {
  WORKSHOP_SELECTED_TEXT_LABEL,
  WORKSHOP_SELECTED_TEXT_SNAPSHOT_ID_CHARACTERS,
  type WorkshopSelectedTextAttachmentMeta,
  type WorkshopSelectedTextSummary
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  boundedStringAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import type { WorkshopMessageAttachmentInput } from '@/application/services/workshop/WorkshopSessionRecords';
import { workshopSelectedTextSourceKey } from '@/application/services/workshop/WorkshopMessageAttachmentIdentity';

/** The selection at one moment, as the host holds it. The text never leaves the host but inside a frame. */
export interface EditorSelectionSnapshot {
  /** Host-minted and opaque (a UUID). */
  readonly id: string;
  /** The selected text, cut to the bound at capture. */
  readonly text: string;
  /** Display path: workspace-relative, or a bare file name. Never absolute. */
  readonly displayPath: string;
  /** 1-based, inclusive. */
  readonly startLine: number;
  readonly endLine: number;
  /** Words in `text`. */
  readonly words: number;
  /** Set when the selection was longer than the bound. */
  readonly truncation?: { readonly keptWords: number; readonly totalWords: number };
}

/** The pending attachment a snapshot becomes. */
export function workshopSelectedTextAttachmentInput(snapshot: EditorSelectionSnapshot): WorkshopMessageAttachmentInput {
  const selectedText: WorkshopSelectedTextAttachmentMeta = {
    snapshotId: snapshot.id,
    startLine: snapshot.startLine,
    endLine: snapshot.endLine
  };
  return {
    label: WORKSHOP_SELECTED_TEXT_LABEL,
    words: snapshot.words,
    relativePath: snapshot.displayPath,
    ...(snapshot.truncation ? { truncation: { ...snapshot.truncation } } : {}),
    content: snapshot.text,
    sourceUri: workshopSelectedTextSourceKey(selectedText),
    selectedText
  };
}

/** What the webview may see of a snapshot: metadata and a one-line preview. */
export function workshopSelectedTextSummary(snapshot: EditorSelectionSnapshot): WorkshopSelectedTextSummary {
  return {
    snapshotId: snapshot.id,
    displayName: snapshot.displayPath,
    startLine: snapshot.startLine,
    endLine: snapshot.endLine,
    words: snapshot.words,
    ...(snapshot.truncation ? { truncation: { ...snapshot.truncation } } : {}),
    preview: workshopSelectedTextPreview(snapshot.text)
  };
}

/** The first line that says anything, on one line, within the preview bound. */
export function workshopSelectedTextPreview(text: string): string {
  const limit = PROMPT_BUDGETS.workshopSelectedText.previewCharacters;
  const line = (text.split(/\r?\n/).find((candidate) => candidate.trim().length > 0) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const characters = Array.from(line);
  return characters.length <= limit ? line : `${characters.slice(0, limit - 1).join('').trimEnd()}…`;
}

/**
 * The session codec's check of a pending or sent attachment's `selectedText`
 * (`WorkshopSessionStateV1Shape`): exact keys, a bounded id, and lines that
 * are whole, from 1, in order. Optional and additive (ADR 2026-07-30): no
 * `schemaVersion` bump, and forward only, since an older build's strict
 * reader refuses a session that holds the key.
 */
export function assertOptionalWorkshopSelectedTextMeta(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  const meta = exactObject(value, path, ['snapshotId', 'startLine', 'endLine']);
  boundedStringAt(meta.snapshotId, `${path}.snapshotId`, WORKSHOP_SELECTED_TEXT_SNAPSHOT_ID_CHARACTERS, false);
  if (!Number.isSafeInteger(meta.startLine) || (meta.startLine as number) < 1) {
    shapeError(`${path}.startLine`, 'a whole number from 1');
  }
  if (!Number.isSafeInteger(meta.endLine) || (meta.endLine as number) < (meta.startLine as number)) {
    shapeError(`${path}.endLine`, 'a whole number from startLine');
  }
}
