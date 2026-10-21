/**
 * Reading-group transitions (ADR 2026-10-19 D6) and the context shelf's
 * bounds (D9).
 */
import type { LightboxReadingGroup, LightboxReadingTile } from '@messages';
import {
  settleLightboxGroup,
  startLightboxGroups,
  stopLightboxGroups
} from '@/infrastructure/lightbox/LightboxReadingState';
import type { LightboxGroupOutcome } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { lightboxFileKey } from '@/infrastructure/lightbox/LightboxFileKey';
import { emptyLightboxReadingGroup, lightboxPlannedCalls } from '@shared/constants/lightbox';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const tile = (id: string, kind: 'headline' | 'motif', lens: 'headline' | 'motif'): LightboxReadingTile => ({
  id,
  kind,
  lens,
  title: id,
  claim: id,
  paragraphs: [1],
  evidence: [{ paragraph: 1, text: 'down went Alice', match: 'exact' }],
  withheldQuotes: [],
  support: [],
  friction: 'f',
  ...(kind === 'motif' ? { gist: 'g' } : {})
} as LightboxReadingTile);

const outcome = (over: Partial<LightboxGroupOutcome>): LightboxGroupOutcome => ({
  group: 'A',
  lenses: ['headline', 'motif'],
  status: 'ok',
  tiles: [],
  withheldBlocks: [],
  withheldClaims: [],
  frictions: [],
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.5 },
  quoteChecks: [{ lens: 'headline', checked: 1, withheld: 0 }],
  ...over
});

const landed: LightboxReadingGroup = {
  ...emptyLightboxReadingGroup('A'),
  status: 'ok',
  lenses: ['headline', 'motif'],
  tiles: [tile('h1', 'headline', 'headline'), tile('m1', 'motif', 'motif')],
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.5 }
};

describe('reading-group transitions', () => {
  it('clears a group for a full run and marks every lens it reads pending', () => {
    const [a, b] = startLightboxGroups([landed, emptyLightboxReadingGroup('B')], [{ group: 'A', lenses: ['headline', 'motif'] }]);
    expect(a).toMatchObject({ status: 'running', tiles: [], lenses: [], pending: ['headline', 'motif'], usage: landed.usage });
    expect(b.status).toBe('not-run');
  });

  it('re-reads one lens: the others stay, only that lens is replaced, usage accumulates', () => {
    const [running] = startLightboxGroups([landed], [{ group: 'A', lenses: ['motif'] }], 'motif');
    expect(running).toMatchObject({ status: 'running', pending: ['motif'], tiles: landed.tiles });
    const settled = settleLightboxGroup(running, outcome({ lenses: ['motif'], tiles: [tile('m2', 'motif', 'motif')] }), 'motif');
    expect(settled.tiles.map((entry) => entry.id)).toEqual(['h1', 'm2']);
    expect(settled.status).toBe('ok');
    expect(settled.pending).toBeUndefined();
    expect(settled.usage?.costUsd).toBeCloseTo(1);
  });

  it('replaces only the re-read lens\'s quote checks, and keeps them all when the re-read fails (PR #149 F-07)', () => {
    const counted = { ...landed, quoteChecks: [{ lens: 'headline' as const, checked: 1, withheld: 0 }, { lens: 'motif' as const, checked: 5, withheld: 1 }] };
    const [running] = startLightboxGroups([counted], [{ group: 'A', lenses: ['motif'] }], 'motif');
    const reread = settleLightboxGroup(running, outcome({ lenses: ['motif'], quoteChecks: [{ lens: 'motif', checked: 2, withheld: 0 }] }), 'motif');
    expect(reread.quoteChecks).toEqual([{ lens: 'headline', checked: 1, withheld: 0 }, { lens: 'motif', checked: 2, withheld: 0 }]);
    const failed = settleLightboxGroup(running, outcome({ status: 'failed', quoteChecks: [] }), 'motif');
    expect(failed.quoteChecks).toEqual(counted.quoteChecks);
    expect(startLightboxGroups([counted], [{ group: 'A', lenses: ['headline', 'motif'] }])[0].quoteChecks).toEqual([]);
  });

  it('keeps the earlier readings when a re-read fails', () => {
    const [running] = startLightboxGroups([landed], [{ group: 'A', lenses: ['motif'] }], 'motif');
    const settled = settleLightboxGroup(running, outcome({ status: 'failed', error: 'Rate limited.', tiles: [] }), 'motif');
    expect(settled).toMatchObject({ status: 'failed', error: 'Rate limited.', tiles: landed.tiles });
  });

  it('cancels only the stopped run\'s groups that were still running', () => {
    const groups = [landed, { ...emptyLightboxReadingGroup('B'), status: 'running' as const, pending: ['voice' as const] }];
    const stopped = stopLightboxGroups(groups, ['A', 'B'], 'Stopped.');
    expect(stopped.map((group) => group.status)).toEqual(['ok', 'cancelled']);
    expect(stopped[1]).toMatchObject({ error: 'Stopped.' });
    expect(stopped[1].pending).toBeUndefined();
  });

  it('plans calls from the lens toggles: off lenses left out, empty groups dropped, landed groups skipped by "rest"', () => {
    expect(lightboxPlannedCalls(['genre', 'voice', 'lineage', 'spark', 'rhythm'], { mode: 'all' })).toEqual([
      { group: 'A', lenses: ['headline', 'motif', 'tension', 'gravity', 'palette'] },
      { group: 'B', lenses: ['characters', 'subtext'] },
      { group: 'D', lenses: ['stock', 'numbers'] },
      { group: 'E', lenses: ['template', 'pressure', 'artifacts', 'summary'] },
      // Craft steering reads the chapter beside the others (Slice 4F).
      { group: 'G', lenses: ['steering'] },
      // The Opinion is always the last call (Slice 4D).
      { group: 'F', lenses: ['opinion'] }
    ]);
    expect(lightboxPlannedCalls([], { mode: 'rest' }, [{ group: 'A', status: 'ok' }, { group: 'B', status: 'cancelled' }]))
      .toEqual([
        { group: 'B', lenses: ['characters', 'voice', 'subtext'] },
        { group: 'C', lenses: ['genre', 'lineage', 'spark'] },
        { group: 'D', lenses: ['stock', 'rhythm', 'numbers'] },
        { group: 'E', lenses: ['template', 'pressure', 'artifacts', 'summary'] },
        { group: 'G', lenses: ['steering'] },
        { group: 'F', lenses: ['opinion'] }
      ]);
    // Slice 4D: the Opinion reads alone, and "rest" after it landed skips it like any group.
    expect(lightboxPlannedCalls([], { mode: 'lens', lens: 'opinion' })).toEqual([{ group: 'F', lenses: ['opinion'] }]);
    expect(lightboxPlannedCalls(['opinion'], { mode: 'all' }).map((call) => call.group)).toEqual(['A', 'B', 'C', 'D', 'E', 'G']);
    expect(lightboxPlannedCalls([], { mode: 'rest' }, (['A', 'B', 'C', 'D', 'E', 'G', 'F'] as const).map((group) => ({ group, status: group === 'F' ? 'failed' : 'ok' }))))
      .toEqual([{ group: 'F', lenses: ['opinion'] }]);
    // Slice 4F: craft steering is a call of its own, turned off like any lens, and re-read alone.
    expect(lightboxPlannedCalls([], { mode: 'lens', lens: 'steering' })).toEqual([{ group: 'G', lenses: ['steering'] }]);
    expect(lightboxPlannedCalls(['steering'], { mode: 'all' }).map((call) => call.group)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(lightboxPlannedCalls([], { mode: 'lens', lens: 'voice' })).toEqual([{ group: 'B', lenses: ['voice'] }]);
    expect(lightboxPlannedCalls(['voice'], { mode: 'lens', lens: 'voice' })).toEqual([]);
    // Slice 4B: the craft lenses are one call of their own, and read alone like any lens.
    expect(lightboxPlannedCalls([], { mode: 'lens', lens: 'numbers' })).toEqual([{ group: 'D', lenses: ['numbers'] }]);
    expect(lightboxPlannedCalls(['stock', 'rhythm', 'numbers'], { mode: 'all' }).map((call) => call.group)).toEqual(['A', 'B', 'C', 'E', 'G', 'F']);
    // Slice 4C: template and summary are read together on a re-read, since engagement sits on the movements;
    // with one of them off, the other is read alone.
    expect(lightboxPlannedCalls([], { mode: 'lens', lens: 'template' })).toEqual([{ group: 'E', lenses: ['template', 'summary'] }]);
    expect(lightboxPlannedCalls([], { mode: 'lens', lens: 'summary' })).toEqual([{ group: 'E', lenses: ['template', 'summary'] }]);
    expect(lightboxPlannedCalls(['summary'], { mode: 'lens', lens: 'template' })).toEqual([{ group: 'E', lenses: ['template'] }]);
    expect(lightboxPlannedCalls([], { mode: 'lens', lens: 'pressure' })).toEqual([{ group: 'E', lenses: ['pressure'] }]);
  });
});

describe('LightboxContextShelf', () => {
  it('holds files within the context-files word budget, once each', () => {
    let id = 0;
    const shelf = new LightboxContextShelf({ mintId: () => `c${++id}` });
    expect(shelf.add({ displayPath: 'Notes/cast.md', text: 'Alice is seven.', sourceKey: '/w/cast.md' })).toEqual({
      added: true,
      file: { id: 'c1', displayPath: 'Notes/cast.md', wordCount: 3, fileKey: lightboxFileKey('/w/cast.md') }
    });
    expect(shelf.add({ displayPath: 'Notes/cast.md', text: 'Again.', sourceKey: '/w/cast.md' })).toMatchObject({ added: false });
    expect(shelf.add({ displayPath: 'Notes/empty.md', text: '  ', sourceKey: '/w/empty.md' })).toMatchObject({ added: false });
    const big = 'word '.repeat(PROMPT_BUDGETS.contextFiles.words);
    expect(shelf.add({ displayPath: 'Notes/big.md', text: big, sourceKey: '/w/big.md' })).toEqual({
      added: false,
      notice: 'Notes/big.md has 50,000 words, and the context holds 3 of its 50,000. Remove a file, or choose a shorter one.'
    });
    expect(shelf.materials()).toEqual([{ displayPath: 'Notes/cast.md', text: 'Alice is seven.' }]);
    expect(shelf.remove('c1')).toBe(true);
    expect(shelf.list()).toEqual([]);
  });
});
