/**
 * The writer's words for a file-edit card (ADR 2026-11-05 D9): one table,
 * every kind in it. The lists below are typed against each source's own
 * union, so a kind added anywhere fails to compile here until it has words.
 */
import type { DraftEditRefusal } from '@/application/services/draftEdit/DraftEditApplier';
import { WORKSHOP_FILE_EDIT_CHECKPOINT_REFUSALS, type WorkshopFileEditCheckpointRefusal } from '@/application/services/workshop/fileEdits/WorkshopFileEditCheckpoint';
import { fileEditOutcomeMessage, fileEditStagingRefusalMessage } from '@/application/services/fileEdits/fileEditCopy';
import { WORKSHOP_FILE_EDIT_NOT_THE_OFFERED_FILE } from '@/application/services/workshop/fileEdits/WorkshopEditOfferAnswerCompletion';
import type { FileEditApplyRefusal, FileEditOperationFault } from '@/domain/models/FileEdit';
import { FILE_EDIT_STAGING_REFUSALS } from '@/domain/models/FileEditStaging';
import {
  WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS,
  WORKSHOP_FILE_EDIT_REASON_WORDS,
  WORKSHOP_FILE_EDIT_STATE_WORDS,
  workshopFileEditCardWords,
  workshopFileEditReasonWords,
  type WorkshopFileEditReasonKind
} from '@shared/constants/workshopFileEditWords';
import { WORKSHOP_FILE_EDIT_REOPENED_APPLYING_REASON, WORKSHOP_FILE_EDIT_STATES, WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON } from '@messages';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the reason kinds' kebab-case words. */
const every = <K extends string>(kinds: Record<K, true>): K[] => Object.keys(kinds) as K[];

const APPLY_REFUSALS = every<FileEditApplyRefusal>({
  'no-operations': true, 'no-longer-configured': true, 'outside-workspace': true, 'catalog-unreadable': true, unreadable: true,
  'identity-changed': true, 'not-text': true, 'too-large': true, superseded: true, 'authority-changed': true, 'host-failed': true
});
const OPERATION_FAULTS = every<FileEditOperationFault>({
  'not-found': true, ambiguous: true, overlapping: true, 'conflicting-operations': true, 'not-allowed': true,
  'baseline-changed': true, 'insertion-too-long': true, 'rewrite-ceiling': true, 'rewrite-protected': true, 'rewrite-too-large': true,
  // An intent's policy (ADR 2026-11-10 D6).
  'more-than-a-fix': true
});
const APPLIER_REFUSALS = every<DraftEditRefusal>({ changed: true, protected: true, 'line-break': true, overlapping: true, markup: true });
/* eslint-enable @typescript-eslint/naming-convention */
const CHECKPOINT_REFUSALS = every<WorkshopFileEditCheckpointRefusal>(
  Object.fromEntries(WORKSHOP_FILE_EDIT_CHECKPOINT_REFUSALS.map((kind) => [kind, true])) as Record<WorkshopFileEditCheckpointRefusal, true>
);
const CARD_KINDS = [
  'rewrite-on-prose', WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON, WORKSHOP_FILE_EDIT_REOPENED_APPLYING_REASON,
  // An answer's card for another file than its offer's (ADR 2026-11-10 D5).
  WORKSHOP_FILE_EDIT_NOT_THE_OFFERED_FILE
];
const HANDLER_KINDS: WorkshopFileEditReasonKind[] = [
  'outcome-unknown', 'file-edits-off', 'run-active', 'room-changed', 'no-card', 'applying', 'session-operation',
  'document-changed', 'refused', 'not-a-rewrite'
];

const SOURCES: Array<[string, readonly string[]]> = [
  ['staging', FILE_EDIT_STAGING_REFUSALS],
  ['reply reader and reopen', CARD_KINDS],
  ['gateway refusals', APPLY_REFUSALS],
  ['operation faults', OPERATION_FAULTS],
  ['applier refusals', APPLIER_REFUSALS],
  ['checkpoint refusals', CHECKPOINT_REFUSALS],
  ['handler and gateway outcomes', HANDLER_KINDS]
];

const NO_PATH = /file:|\/|\\|\.md\b|\.txt\b/;

describe('workshopFileEditWords', () => {
  describe.each(SOURCES)('%s', (_source, kinds) => {
    it.each(kinds.map((kind) => [kind]))('%s has its own words, with no path or URI', (kind) => {
      const words = workshopFileEditReasonWords(kind);
      expect(Object.prototype.hasOwnProperty.call(WORKSHOP_FILE_EDIT_REASON_WORDS, kind)).toBe(true);
      expect(words).toMatch(/^[A-Z].*[.…]$/u);
      expect(words).not.toMatch(NO_PATH);
      // The writer's words, never the kind's own spelling.
      if (kind.includes('-')) {
        expect(words).not.toContain(kind);
      }
    });
  });

  it('lists no kind that no source names', () => {
    const named = new Set(SOURCES.flatMap(([, kinds]) => kinds));
    expect(Object.keys(WORKSHOP_FILE_EDIT_REASON_WORDS).filter((kind) => !named.has(kind))).toEqual([]);
  });

  it('reads an unlisted kind, or none, as the generic line, never as itself', () => {
    expect(workshopFileEditReasonWords('some-later-kind')).toBe('The change could not be made.');
    expect(workshopFileEditReasonWords(undefined)).toBe('The change could not be made.');
    expect(workshopFileEditReasonWords('toString')).toBe('The change could not be made.');
  });

  it('has a line for every card state, and leads applied and partial with their state', () => {
    for (const state of WORKSHOP_FILE_EDIT_STATES) {
      expect(WORKSHOP_FILE_EDIT_STATE_WORDS[state]).toMatch(/\S/);
    }
    expect(workshopFileEditCardWords('stale', 'not-found')).toBe('The text to change is no longer in the file.');
    expect(workshopFileEditCardWords('partial', 'markup')).toMatch(/^Some of the changes were applied.*Markdown structure/);
    expect(workshopFileEditCardWords('pending')).toBe('Nothing changes until you apply it.');
  });

  it('is the one table the gateway and staging read their words from', () => {
    for (const kind of FILE_EDIT_STAGING_REFUSALS) {
      expect(fileEditStagingRefusalMessage(kind)).toBe(WORKSHOP_FILE_EDIT_REASON_WORDS[kind]);
    }
    for (const kind of [...APPLY_REFUSALS, ...OPERATION_FAULTS, ...APPLIER_REFUSALS]) {
      expect(fileEditOutcomeMessage('refused', kind)).toBe(WORKSHOP_FILE_EDIT_REASON_WORDS[kind as WorkshopFileEditReasonKind]);
    }
  });

  it('never says "the rest were not" of a partial card whose others are unknown (PR #233 note)', () => {
    const mixed = ['landed', 'unknown'] as const;
    expect(workshopFileEditCardWords('partial', undefined, mixed)).toBe(WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS);
    expect(WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS).not.toMatch(/the rest were not/);
    expect(WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS).toMatch(/not known/);
    expect(workshopFileEditCardWords('partial', 'changed', mixed)).toMatch(/^Some of the changes were applied; for the others, it is not known/);
    // Control: a partial card whose others were not applied says so.
    expect(workshopFileEditCardWords('partial', undefined, ['landed', 'not-applied'])).toBe(WORKSHOP_FILE_EDIT_STATE_WORDS.partial);
    // The gateway's message reads the same table, outcomes and all.
    expect(fileEditOutcomeMessage('partial', undefined, mixed)).toBe(WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS);
    expect(fileEditOutcomeMessage('partial', undefined, ['landed', 'not-applied'])).toBe(WORKSHOP_FILE_EDIT_STATE_WORDS.partial);
    expect(fileEditOutcomeMessage('applied')).toBe(WORKSHOP_FILE_EDIT_STATE_WORDS.applied);
  });
});
