/**
 * What crosses between the sidebar and the Passage Search engine (ADR
 * 2026-11-20 D15): scope choices in, display-safe views out.
 */

import {
  passageSearchEstimateView,
  passageSearchPatternsOf,
  passageSearchRequestOf,
  passageSearchResultView
} from '@/application/handlers/domain/PassageSearchViews';
import { alicePlan, aliceResult } from '@/__tests__/application/handlers/domain/passageSearchRouteHarness';

const payload = (scopes: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  requestId: 'plan-1',
  question: 'Where does the Cheshire Cat grin?',
  organize: false,
  scopes: { activeFile: false, selection: false, groups: [], pattern: '', ...scopes },
  ...overrides
});

describe('passageSearchRequestOf', () => {
  it('builds scopes in a fixed order: active file, selection, groups in catalog order, then patterns', () => {
    const request = passageSearchRequestOf(payload({
      activeFile: true,
      selection: true,
      groups: ['manuscript', 'characters'],
      pattern: 'drafts/a.md, drafts/part-2/*.md\nnotes/cat.txt'
    }));
    expect(request).toEqual({
      question: 'Where does the Cheshire Cat grin?',
      organize: false,
      scopes: [
        { kind: 'active-file' },
        { kind: 'selection' },
        { kind: 'group', group: 'characters' },
        { kind: 'group', group: 'manuscript' },
        { kind: 'pattern', pattern: 'drafts/a.md', writerTyped: true },
        { kind: 'pattern', pattern: 'drafts/part-2/*.md', writerTyped: true },
        { kind: 'pattern', pattern: 'notes/cat.txt', writerTyped: true }
      ]
    });
  });

  it('names no scope when nothing is chosen, so the engine refuses in its own words', () => {
    expect(passageSearchRequestOf(payload({}))?.scopes).toEqual([]);
  });

  it('keeps a group it does not know, for the engine to refuse', () => {
    expect(passageSearchRequestOf(payload({ groups: ['tea-party'] }))?.scopes).toEqual([{ kind: 'group', group: 'tea-party' }]);
  });

  it('never builds a file or text scope, whatever the payload holds', () => {
    const request = passageSearchRequestOf(payload({ file: { group: 'chapters', path: 'a.md' }, text: 'Off with her head!' }, { text: 'by value' }));
    expect(request?.scopes).toEqual([]);
  });

  it.each([
    ['no question', payload({}, { question: undefined })],
    ['a toggle that is no boolean', payload({}, { organize: 'yes' })],
    ['no scopes', { requestId: 'plan-1', question: 'q', organize: true }],
    ['a group that is no string', payload({ groups: [7] })],
    ['a pattern that is no string', payload({ pattern: ['a.md'] })],
    ['a pattern field past its bound', payload({ pattern: 'a'.repeat(4001) })],
    ['a selection that is no boolean', payload({ selection: 'the whole chapter' })],
    ['nothing', undefined]
  ])('reads %s as no request', (_name, bad) => {
    expect(passageSearchRequestOf(bad)).toBeUndefined();
  });

  it('splits the field on lines and commas, dropping blanks', () => {
    expect(passageSearchPatternsOf(' a.md ,, b/*.md \n\n c.txt ')).toEqual(['a.md', 'b/*.md', 'c.txt']);
  });
});

describe('the estimate view', () => {
  it('says the allowance and the files left out', () => {
    expect(passageSearchEstimateView(alicePlan().estimate)).toEqual({
      model: 'test/reader',
      files: 3,
      calls: 4,
      inputTokens: 9000,
      outputTokens: 3200,
      usd: 0.42,
      organizeAllowance: true,
      leftOut: { unreadable: 0, unsplittable: 1, empty: 0 },
      leftOutMessage: '1 file left out: it has no place to split.'
    });
  });

  it('carries no price and no allowance when the plan has neither', () => {
    const { usd: _usd, organize: _organize, ...estimate } = alicePlan({ leftOut: { unreadable: 0, unsplittable: 0, empty: 0 } }).estimate;
    const view = passageSearchEstimateView(estimate);
    expect(view).not.toHaveProperty('usd');
    expect(view).not.toHaveProperty('leftOutMessage');
    expect(view.organizeAllowance).toBe(false);
  });
});

describe('the result view', () => {
  it('holds display paths and counts, never an absolute path, an offset or a file key', () => {
    const view = passageSearchResultView(aliceResult(), 'result-1', false);
    const written = JSON.stringify(view);
    expect(written).not.toContain('/home/dodgson');
    expect(written).not.toContain('"f1"');
    expect(written).not.toContain('"start"');
    expect(view.resultId).toBe('result-1');
    expect(view.files).toEqual({ planned: 3, searched: { full: 3, partial: 0, none: 0 }, withInstances: 2, leftOut: { unreadable: 0, unsplittable: 0, empty: 0 } });
    expect(view.instances.map((instance) => [instance.number, instance.file, instance.line, instance.lines, instance.canOpen])).toEqual([
      [1, 'chapters/alice-ch1.md', 12, 'document', true],
      [2, 'Selected text', 3, 'text', false]
    ]);
  });

  it('carries the analysis, why one is missing, and the ending in host words', () => {
    const analysis = {
      headline: 'The Rabbit keeps checking the time',
      sections: [{ title: 'Hurry', claims: [{ text: 'He consults the watch.', cites: [1, 2] }] }],
      read: { instances: 2, of: 2 },
      dropped: { claims: 1, uncited: 0, misquoted: 1, malformed: 0, sections: 0, cites: 2 },
      replaced: { headline: true, titles: 1 },
      clipped: 1
    };
    expect(passageSearchResultView(aliceResult({ analysis }), 'r', false).analysis).toEqual(analysis);
    const failed = passageSearchResultView(aliceResult({ analysisMissing: 'cut', ended: 'instance-limit' }), 'r', false);
    expect(failed.analysisMissing).toBe('cut');
    expect(failed.endedMessage).toContain('instances, the most it keeps');
    expect(passageSearchResultView(aliceResult(), 'r', false)).not.toHaveProperty('endedMessage');
  });

  it('carries the cancelled count and how many files were searched in full, in part and not at all', () => {
    const result = aliceResult();
    const view = passageSearchResultView({
      ...result,
      calls: { planned: 3, answered: 1, failed: 0, cut: 0, cancelled: 1, unsent: 1, tooLarge: 0, dispatched: 2 },
      files: { ...result.files, searched: { full: 1, partial: 1, none: 1 } }
    }, 'r', false);
    expect(view.calls).toEqual({ planned: 3, answered: 1, failed: 0, cut: 0, cancelled: 1, unsent: 1, tooLarge: 0, dispatched: 2 });
    expect(view.files.searched).toEqual({ full: 1, partial: 1, none: 1 });
  });
});
