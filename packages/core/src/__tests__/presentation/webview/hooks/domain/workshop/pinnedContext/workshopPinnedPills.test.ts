/**
 * workshopPinnedPillViews (Pinned Context Slice 4): which pills carry the
 * mark, which offer Pin, and where a refusal shows. The mark is the shared
 * match rule over the host's last list, with the host's platform (ADR D4).
 * *Alice*.
 */

import {
  WORKSHOP_PINNED_PILL_CHANGED,
  workshopPinnedPillViews,
  workshopPinnedPillsCountText,
  type WorkshopPinnedPillsInput
} from '@hooks/domain/workshop/pinnedContext/workshopPinnedPills';
import type { WorkshopContextAttachmentSnapshot, WorkshopPinnedContextPayload } from '@messages';

function answer(overrides: Partial<WorkshopPinnedContextPayload> = {}): WorkshopPinnedContextPayload {
  return {
    requestId: 'r-1',
    platform: 'posix',
    availability: { available: true },
    file: { state: 'ok' },
    revision: 'rev-1',
    entries: [{ path: 'Characters/alice.md', label: 'alice.md', group: 'characters', words: 3400, state: 'ready' }],
    totals: { words: 3400, budgetWords: 100_000, files: 1, maxFiles: 20 },
    ...overrides
  };
}

const file = (id: string, overrides: Partial<WorkshopContextAttachmentSnapshot> = {}): WorkshopContextAttachmentSnapshot => ({
  id,
  kind: 'file',
  origin: 'writer',
  label: 'alice.md',
  words: 3400,
  addedAt: 1,
  ...overrides
});

const views = (input: Partial<WorkshopPinnedPillsInput> & Pick<WorkshopPinnedPillsInput, 'attachments'>) =>
  workshopPinnedPillViews({ pinnableIds: [], pending: false, ...input });

describe('workshopPinnedPillViews', () => {
  describe('the mark follows the match rule', () => {
    it('a file attached under a catalog key, pinned under the same path, is pinned', () => {
      const pill = file('ctx-1', { configuredResource: { group: 'characters', path: 'Characters/alice.md' } });
      expect(views({ answer: answer(), attachments: [pill] })['ctx-1'].pinned).toBe(true);
    });

    it('a workspace file pinned by its relative path is pinned', () => {
      const pill = file('ctx-1', { relativePath: 'Characters/alice.md' });
      expect(views({ answer: answer(), attachments: [pill] })['ctx-1'].pinned).toBe(true);
    });

    it('two different paths never match', () => {
      const pill = file('ctx-1', {
        label: 'alice-old.md',
        relativePath: 'Characters/alice-old.md',
        configuredResource: { group: 'characters', path: 'Drafts/alice.md' }
      });
      expect(views({ answer: answer(), attachments: [pill] })['ctx-1'].pinned).toBe(false);
    });

    it('folds case under Windows, and not under POSIX', () => {
      const pill = file('ctx-1', { relativePath: 'characters\\ALICE.md' });
      expect(views({ answer: answer({ platform: 'windows' }), attachments: [pill] })['ctx-1'].pinned).toBe(true);
      expect(views({ answer: answer({ platform: 'posix' }), attachments: [pill] })['ctx-1'].pinned).toBe(false);
    });

    it('under Windows, final and medial sigma name one file; under POSIX they are two', () => {
      const entries = [{ path: 'Places/Κόσμος.md', label: 'Κόσμος.md', words: 10, state: 'ready' as const }];
      const pill = file('ctx-1', { label: 'Κόσμοσ.md', relativePath: 'Places/Κόσμοσ.md' });
      expect(views({ answer: answer({ platform: 'windows', entries }), attachments: [pill] })['ctx-1'].pinned).toBe(true);
      expect(views({ answer: answer({ platform: 'posix', entries }), attachments: [pill] })['ctx-1'].pinned).toBe(false);
    });

    it('a text note is never pinned, whatever its label', () => {
      const note = file('ctx-1', { kind: 'text', label: 'Characters/alice.md' });
      expect(views({ answer: answer(), attachments: [note] })['ctx-1'].pinned).toBe(false);
    });

    it('nothing is marked before the host answers, or while the list cannot be read', () => {
      const pill = file('ctx-1', { relativePath: 'Characters/alice.md' });
      expect(views({ attachments: [pill] })['ctx-1'].pinned).toBe(false);
      expect(views({ answer: answer({ file: { state: 'unreadable', words: 'It can’t be read.' } }), attachments: [pill] })['ctx-1'].pinned).toBe(false);
      expect(views({
        answer: answer({ availability: { available: false, reason: 'multi-root', words: 'Several folders.' } }),
        attachments: [pill]
      })['ctx-1'].pinned).toBe(false);
    });
  });

  describe('Pin', () => {
    const rabbit = file('ctx-2', { label: 'the-white-rabbit.md', relativePath: 'Characters/the-white-rabbit.md' });

    it('an unpinned file pill the tab could pin offers Pin, named for new sessions', () => {
      const view = views({ answer: answer(), attachments: [rabbit], pinnableIds: ['ctx-2'] })['ctx-2'];
      expect(view.pin).toEqual({ name: 'Pin the-white-rabbit.md for new sessions', disabled: false });
    });

    it('waits while another change is with the host', () => {
      expect(views({ answer: answer(), attachments: [rabbit], pinnableIds: ['ctx-2'], pending: true })['ctx-2'].pin?.disabled).toBe(true);
    });

    it('a pinned pill, a text note and a wizard pill never offer it', () => {
      const alice = file('ctx-1', { relativePath: 'Characters/alice.md' });
      const note = file('ctx-3', { kind: 'text', label: 'The clock always reads six' });
      const wizard = file('ctx-4', { origin: 'wizard', label: 'the-hatter.md', relativePath: 'Characters/the-hatter.md' });
      const all = views({ answer: answer(), attachments: [alice, note, wizard], pinnableIds: ['ctx-1', 'ctx-3', 'ctx-4'] });
      expect(all['ctx-1'].pin).toBeUndefined();
      expect(all['ctx-3'].pin).toBeUndefined();
      expect(all['ctx-4'].pin).toBeUndefined();
    });

    it('a pill the tab could not pin (no list to change) offers none', () => {
      expect(views({ answer: answer(), attachments: [rabbit], pinnableIds: [] })['ctx-2'].pin).toBeUndefined();
    });
  });

  describe('a refusal shows at the pill that asked', () => {
    const rabbit = file('ctx-2', { label: 'the-white-rabbit.md', relativePath: 'Characters/the-white-rabbit.md' });
    const hatter = file('ctx-3', { label: 'the-hatter.md', relativePath: 'Characters/the-hatter.md' });
    const posted = { attachmentId: 'ctx-2', requestId: 'r-9' };

    it('in the host\'s words, on that pill only', () => {
      const refused = answer({ requestId: 'r-9', action: 'pin-attachments', ok: false, notice: { kind: 'refused', text: 'Can’t pin the-white-rabbit.md: only 20 files can be pinned.' } });
      const all = views({ answer: refused, attachments: [rabbit, hatter], pinnableIds: ['ctx-2', 'ctx-3'], posted });
      expect(all['ctx-2'].refusal).toBe('Can’t pin the-white-rabbit.md: only 20 files can be pinned.');
      expect(all['ctx-2'].pin).toBeDefined();
      expect(all['ctx-3'].refusal).toBeUndefined();
    });

    it('a stale revision says the list changed', () => {
      const changed = answer({ requestId: 'r-9', action: 'pin-attachments', ok: false, notice: { kind: 'changed' } });
      expect(views({ answer: changed, attachments: [rabbit], pinnableIds: ['ctx-2'], posted })['ctx-2'].refusal).toBe(WORKSHOP_PINNED_PILL_CHANGED);
    });

    it('is cleared by another request\'s answer, and never shown on a landed pin', () => {
      const other = answer({ requestId: 'r-10', ok: false, notice: { kind: 'refused', text: 'Something else.' } });
      expect(views({ answer: other, attachments: [rabbit], pinnableIds: ['ctx-2'], posted })['ctx-2'].refusal).toBeUndefined();
      const landed = answer({ requestId: 'r-9', action: 'pin-attachments', ok: true });
      expect(views({ answer: landed, attachments: [rabbit], pinnableIds: ['ctx-2'], posted })['ctx-2'].refusal).toBeUndefined();
    });

    it('a landed pin marks its own pill as landed, so the focus can come back to it', () => {
      const entries = [{ path: 'Characters/the-white-rabbit.md', label: 'the-white-rabbit.md', words: 1900, state: 'ready' as const }];
      const landed = answer({ requestId: 'r-9', action: 'pin-attachments', ok: true, entries });
      const all = views({ answer: landed, attachments: [rabbit, hatter], pinnableIds: ['ctx-3'], posted });
      expect(all['ctx-2']).toEqual({ pinned: true, landed: true });
      expect(all['ctx-3'].landed).toBeUndefined();
      expect(views({ answer: { ...landed, requestId: null }, attachments: [rabbit], pinnableIds: [], posted })['ctx-2'].landed).toBeUndefined();
    });
  });

  describe('the head\'s count', () => {
    it('counts the pills that show the mark, and says nothing at 0', () => {
      const pills = (...marks: boolean[]) => Object.fromEntries(marks.map((pinned, index) => [`ctx-${index + 1}`, { pinned }]));
      expect(workshopPinnedPillsCountText(undefined)).toBeUndefined();
      expect(workshopPinnedPillsCountText(pills(false))).toBeUndefined();
      expect(workshopPinnedPillsCountText(pills(true, false))).toBe('1 pinned');
      expect(workshopPinnedPillsCountText(pills(true, true, false))).toBe('2 pinned');
    });
  });
});
