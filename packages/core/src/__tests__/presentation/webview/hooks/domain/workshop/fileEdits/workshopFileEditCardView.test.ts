/**
 * A file-edit card as drawn (ADR 2026-11-05 D8, D9; epic Slice 4b): the
 * display path and class, the host's words for every state, actions only
 * while pending, outcomes by operation and the tally. *Alice*.
 */

import { WORKSHOP_FILE_EDIT_STATES, type WorkshopFileEditProposal } from '@messages';
import { workshopFileEditCardWords } from '@shared/constants/workshopFileEditWords';
import {
  workshopFileEditCardKey,
  workshopFileEditCardView,
  workshopFileEditStackLabel
} from '@hooks/domain/workshop/fileEdits/workshopFileEditCardView';

const card = (change: Partial<WorkshopFileEditProposal> = {}): WorkshopFileEditProposal => ({
  requested: { kind: 'resource', group: 'chapters', path: 'chapters/one.md' },
  target: { kind: 'file', relativePath: 'chapters/one.md' },
  class: 'prose',
  operations: [
    { op: 'replace', find: 'Alice ran', with: 'Alice walked' },
    { op: 'append', text: 'The Rabbit was late.' }
  ],
  why: 'Slow the chase before the fall.',
  baseline: { sha256: 'a'.repeat(64), length: 1200 },
  state: 'pending',
  ...change
});

describe('workshopFileEditCardView', () => {
  it('keys a card by its turn and index', () => {
    expect(workshopFileEditCardKey('turn-4-assistant-1008', 2)).toBe('turn-4-assistant-1008#2');
  });

  it('names the file by its display path and class', () => {
    expect(workshopFileEditCardView(card())).toMatchObject({ path: 'chapters/one.md', classLabel: 'chapter', why: 'Slow the chase before the fall.' });
    expect(workshopFileEditCardView(card({ class: 'notes', target: { kind: 'file', relativePath: 'notes/cast.md' } })))
      .toMatchObject({ path: 'notes/cast.md', classLabel: 'note' });
  });

  it('a card refused at staging names what the frame asked for, with no class', () => {
    const view = workshopFileEditCardView(card({ target: undefined, class: undefined, baseline: undefined, state: 'refused', reason: 'not-configured' }));
    expect(view.path).toBe('chapters/one.md');
    expect(view.classLabel).toBeUndefined();
    expect(view.words).toBe(workshopFileEditCardWords('refused', 'not-configured'));
  });

  it.each(WORKSHOP_FILE_EDIT_STATES)('a %s card reads in the host\'s words and offers actions only while pending', (state) => {
    const view = workshopFileEditCardView(card({ state }));
    expect(view.words).toBe(workshopFileEditCardWords(state));
    expect(view.actionable).toBe(state === 'pending');
  });

  it('a replace is a word diff; an append is its added text', () => {
    const [replace, append] = workshopFileEditCardView(card()).operations;
    expect(replace).toEqual({
      kind: 'replace',
      segments: [
        { kind: 'same', text: 'Alice ' },
        { kind: 'removed', text: 'ran' },
        { kind: 'added', text: 'walked' }
      ]
    });
    expect(append).toEqual({ kind: 'append', text: 'The Rabbit was late.' });
  });

  it('a partial card carries each operation\'s outcome and a tally', () => {
    const view = workshopFileEditCardView(card({ state: 'partial', reason: 'changed', outcomes: ['landed', 'not-applied'] }));
    expect(view.operations.map((operation) => operation.outcome)).toEqual(['landed', 'not-applied']);
    expect(view.tally).toBe('1 of 2 changes applied.');
    expect(view.words).toBe(workshopFileEditCardWords('partial', 'changed'));
  });

  it('an applied single operation needs no tally', () => {
    const view = workshopFileEditCardView(card({
      operations: [{ op: 'prepend', text: 'Chapter One.' }],
      state: 'applied',
      outcomes: ['landed']
    }));
    expect(view.tally).toBeUndefined();
    expect(view.operations[0].outcome).toBe('landed');
  });

  it('a settled rewrite shows what it replaced when its landed record kept the text', () => {
    const rewrite = card({
      class: 'notes',
      operations: [{ op: 'rewrite', text: 'Cast: Alice, the Rabbit.' }],
      state: 'applied',
      outcomes: ['landed'],
      landed: [{ operation: 0, before: 'Cast: Alice.', after: 'Cast: Alice, the Rabbit.', contextBefore: '', contextAfter: '', versionAfter: 4 }]
    });
    expect(workshopFileEditCardView(rewrite).operations[0]).toEqual({
      kind: 'rewrite',
      text: 'Cast: Alice, the Rabbit.',
      outcome: 'landed',
      landed: { before: 'Cast: Alice.', after: 'Cast: Alice, the Rabbit.' }
    });
    const hashed = { ...rewrite, landed: [{ operation: 0, beforeSha256: 'b'.repeat(64), afterSha256: 'c'.repeat(64) }] };
    expect(workshopFileEditCardView(hashed).operations[0]).not.toHaveProperty('landed');
  });

  it('heads a stack by its count', () => {
    expect(workshopFileEditStackLabel(1)).toBe('1 suggested edit');
    expect(workshopFileEditStackLabel(3)).toBe('3 suggested edits');
  });
});
