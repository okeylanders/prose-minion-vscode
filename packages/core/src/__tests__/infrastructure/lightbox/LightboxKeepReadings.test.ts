/**
 * Keep, lens by lens, until replaced (Slice 4J, epic decision 49): the pure
 * transitions every run scope shares. A usable new block replaces its lens's
 * readings and records the run, model and time that read it; a failed or
 * stopped call, a reply cut off before the lens's block, a withheld block,
 * and a block with no usable tile keep the earlier reading, its standing and
 * stale mark included, with the reason. A lens with no earlier reading shows
 * the new state as a first read does. Template and summary are kept or
 * replaced together. The quotes are from "Alice's Adventures in Wonderland"
 * (1865, public domain).
 */
import type { LightboxLensId, LightboxReadingGroup, LightboxReadingTile } from '@messages';
import {
  settleLightboxGroup,
  startLightboxGroups,
  stopLightboxGroups
} from '@/infrastructure/lightbox/LightboxReadingState';
import type { LightboxGroupOutcome } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  LIGHTBOX_KEEP_REASONS,
  lightboxBoardModels,
  lightboxEarlierLensCount,
  lightboxEarlierReason,
  lightboxLensModel
} from '@shared/constants/lightboxProvenance';
import { LIGHTBOX_CUT_INSIDE_REASON } from '@shared/constants/lightboxCallNotes';
import { LIGHTBOX_CUT_OFF_REASON } from '@/infrastructure/lightbox/LightboxReadingWire';

const FIRST = { run: 'run-1-token', at: '2026-10-24T09:00:00.000Z' };
const SECOND = { run: 'run-2-token', at: '2026-10-24T09:08:00.000Z' };

function tile(id: string, lens: LightboxLensId, kind: LightboxReadingTile['kind'] = 'headline'): LightboxReadingTile {
  return {
    id, kind, lens, title: id, claim: id, paragraphs: [1],
    evidence: [{ paragraph: 1, text: 'down went Alice', match: 'exact' }],
    withheldQuotes: [], support: [], friction: `${id} strains`,
    ...(kind === 'motif' ? { gist: 'g' } : {}),
    ...(kind === 'template' ? { freshness: { level: 'mixed', note: 'n' }, engagement: [] } : {})
  } as LightboxReadingTile;
}

function outcome(lenses: LightboxLensId[], over: Partial<LightboxGroupOutcome> = {}): LightboxGroupOutcome {
  return {
    group: 'A', lenses, status: 'ok', tiles: [], withheldBlocks: [], withheldClaims: [],
    frictions: lenses.map((lens) => ({ lens, friction: `${lens} strains anew` })),
    quoteChecks: lenses.map((lens) => ({ lens, checked: 2, withheld: 0 })),
    model: 'provider/model-b',
    usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.02 },
    ...over
  };
}

/** Group A as run 1 left it: headline and motif read, motif stale. */
function landedA(): LightboxReadingGroup {
  const first = settleLightboxGroup(
    { ...emptyLightboxReadingGroup('A'), status: 'running', pending: ['headline', 'motif'] },
    outcome(['headline', 'motif'], {
      tiles: [tile('h1', 'headline'), tile('m1', 'motif', 'motif')],
      model: 'provider/model-a',
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.01 }
    }),
    FIRST
  );
  return { ...first, staleLenses: [{ lens: 'motif', readAgainst: 'an-earlier-text' }] };
}

const rerun = (group: LightboxReadingGroup, lenses: LightboxLensId[] = ['headline', 'motif']) =>
  startLightboxGroups([group], [{ group: 'A', lenses }])[0];
const ids = (group: LightboxReadingGroup, lens?: LightboxLensId) =>
  group.tiles.filter((entry) => !lens || entry.lens === lens).map((entry) => entry.id);

describe('a run keeps every lens\'s reading until a new one lands (decision 49)', () => {
  it('starts with the earlier readings in place, each lens it reads pending', () => {
    const before = landedA();
    const running = rerun(before);
    expect(running).toMatchObject({ status: 'running', pending: ['headline', 'motif'], lenses: ['headline', 'motif'] });
    expect(running.tiles).toEqual(before.tiles);
    expect(running.frictions).toEqual(before.frictions);
    expect(running.staleLenses).toEqual(before.staleLenses);
    expect(running.provenance).toEqual(before.provenance);
  });

  it('clears a lens with no reading of what an earlier call left, as a first read shows it', () => {
    const withheld: LightboxReadingGroup = {
      ...landedA(),
      lenses: ['headline', 'motif', 'tension'],
      withheldBlocks: [{ kind: 'tension-arc', lens: 'tension', reason: 'The tension block broke the format: scores.' }],
      frictions: [...landedA().frictions, { lens: 'tension', friction: 'old' }]
    };
    const running = rerun(withheld, ['headline', 'motif', 'tension']);
    expect(running.withheldBlocks).toEqual([]);
    expect(running.lenses).toEqual(['headline', 'motif']);
    expect(running.frictions.map((entry) => entry.lens)).toEqual(['headline', 'motif']);
  });

  it('replaces a lens with a usable new block, and records the run, the model and the time it landed', () => {
    const settled = settleLightboxGroup(rerun(landedA()), outcome(['headline', 'motif'], {
      tiles: [tile('h2', 'headline'), tile('m2', 'motif', 'motif')]
    }), SECOND);
    expect(ids(settled)).toEqual(['h2', 'm2']);
    expect(settled.staleLenses).toBeUndefined();
    expect(settled.earlierLenses).toBeUndefined();
    expect(settled.provenance).toEqual([
      { lens: 'headline', run: 'run-2-token', model: 'provider/model-b', at: SECOND.at },
      { lens: 'motif', run: 'run-2-token', model: 'provider/model-b', at: SECOND.at }
    ]);
    expect(settled.frictions).toEqual([{ lens: 'headline', friction: 'headline strains anew' }, { lens: 'motif', friction: 'motif strains anew' }]);
  });

  const keeps: Array<[string, LightboxGroupOutcome, string]> = [
    ['the call failed', outcome(['headline', 'motif'], { status: 'failed', error: 'The provider rate-limited this call.', tiles: [], frictions: [], quoteChecks: [] }), 'The provider rate-limited this call.'],
    ['the reply was cut off before the block', outcome(['headline', 'motif'], {
      tiles: [tile('h2', 'headline')],
      withheldBlocks: [{ kind: 'motif', lens: 'motif', reason: `${LIGHTBOX_CUT_OFF_REASON} Complete response saved for recovery at /r.txt.` }],
      frictions: [{ lens: 'headline', friction: 'f' }]
    }), `${LIGHTBOX_CUT_OFF_REASON} Complete response saved for recovery at /r.txt.`],
    ['the block was withheld', outcome(['headline', 'motif'], {
      tiles: [tile('h2', 'headline')],
      withheldBlocks: [{ kind: 'motif', lens: 'motif', reason: 'The motifs block names no friction; every lens must say where it strains.' }],
      frictions: [{ lens: 'headline', friction: 'f' }]
    }), 'The motifs block names no friction; every lens must say where it strains.'],
    ['the block drew no usable tile', outcome(['headline', 'motif'], {
      tiles: [tile('h2', 'headline')],
      withheldClaims: [
        { kind: 'motif', lens: 'motif', title: 'Falling', reason: 'Its quotes were not found where it said.', quotes: [] },
        { kind: 'motif', lens: 'motif', title: 'Curiosity', reason: 'Its quotes were not found where it said.', quotes: [] }
      ]
    }), LIGHTBOX_KEEP_REASONS.noTile(2)],
    ['the block came back empty', outcome(['headline', 'motif'], { tiles: [tile('h2', 'headline')] }), LIGHTBOX_KEEP_REASONS.empty]
  ];

  it.each(keeps)('keeps the earlier reading when %s, standing, stale mark and provenance included, with the reason', (_case, landing, reason) => {
    const before = landedA();
    const settled = settleLightboxGroup(rerun(before), landing, SECOND);
    expect(ids(settled, 'motif')).toEqual(['m1']);
    expect(settled.tiles.find((entry) => entry.lens === 'motif')).toEqual(before.tiles.find((entry) => entry.lens === 'motif'));
    expect(settled.frictions.find((entry) => entry.lens === 'motif')).toEqual(before.frictions.find((entry) => entry.lens === 'motif'));
    expect(settled.quoteChecks.find((entry) => entry.lens === 'motif')).toEqual(before.quoteChecks.find((entry) => entry.lens === 'motif'));
    expect(settled.staleLenses).toEqual([{ lens: 'motif', readAgainst: 'an-earlier-text' }]);
    expect(settled.provenance?.find((entry) => entry.lens === 'motif')).toEqual({ lens: 'motif', run: 'run-1-token', model: 'provider/model-a', at: FIRST.at });
    expect(lightboxEarlierReason(settled, 'motif')).toBe(reason);
    // The kept lens's model is its own run's; nothing of the new block's withheld notes stands in for its reading.
    expect(lightboxLensModel(settled, 'motif')).toBe('provider/model-a');
    expect(settled.withheldBlocks.filter((entry) => entry.lens === 'motif')).toEqual([]);
    expect(settled.withheldClaims.filter((entry) => entry.lens === 'motif')).toEqual([]);
  });

  it('decides each lens of one call on its own: the headline replaced, the motif kept (mixed outcomes)', () => {
    const settled = settleLightboxGroup(rerun(landedA()), keeps[2][1], SECOND);
    expect(settled.status).toBe('ok');
    expect(ids(settled)).toEqual(['h2', 'm1']);
    expect(lightboxEarlierReason(settled, 'headline')).toBeUndefined();
    expect(lightboxEarlierReason(settled, 'motif')).toBe(keeps[2][2]);
    expect(lightboxLensModel(settled, 'headline')).toBe('provider/model-b');
    expect(lightboxLensModel(settled, 'motif')).toBe('provider/model-a');
    expect(lightboxBoardModels([settled])).toEqual(['provider/model-b', 'provider/model-a']);
    expect(lightboxEarlierLensCount([settled])).toBe(1);
  });

  it('adds up every call it paid for, whichever readings landed', () => {
    const failed = settleLightboxGroup(rerun(landedA()), keeps[0][1], SECOND);
    expect(failed.usage).toMatchObject({ totalTokens: 240 });
    expect(failed.usage?.costUsd).toBeCloseTo(0.03);
    expect(failed).toMatchObject({ status: 'failed', error: keeps[0][2], model: 'provider/model-b' });
  });

  it('shows a lens with no earlier reading as a first read does: a failure holds nothing, a withheld block stands', () => {
    const first = { ...emptyLightboxReadingGroup('A'), status: 'running' as const, pending: ['headline', 'motif'] as LightboxLensId[] };
    const failed = settleLightboxGroup(first, keeps[0][1], SECOND);
    expect(failed).toMatchObject({ status: 'failed', lenses: [], tiles: [], error: keeps[0][2] });
    expect(failed.earlierLenses).toBeUndefined();
    const withheld = settleLightboxGroup(first, keeps[2][1], SECOND);
    expect(withheld.lenses).toEqual(['headline', 'motif']);
    expect(withheld.withheldBlocks.map((entry) => entry.lens)).toEqual(['motif']);
    expect(withheld.earlierLenses).toBeUndefined();
    expect(withheld.provenance?.map((entry) => entry.lens)).toEqual(['headline', 'motif']);
  });

  it('leaves the lenses its call did not read as they were, earlier marks included', () => {
    const kept = settleLightboxGroup(rerun(landedA()), keeps[0][1], SECOND);
    const headlineOnly = settleLightboxGroup(rerun(kept, ['headline']), outcome(['headline'], { tiles: [tile('h3', 'headline')] }), SECOND);
    expect(ids(headlineOnly)).toEqual(['h3', 'm1']);
    expect(lightboxEarlierReason(headlineOnly, 'motif')).toBe(keeps[0][2]);
    expect(lightboxEarlierReason(headlineOnly, 'headline')).toBeUndefined();
  });

  it('stops with every pending lens\'s reading kept, said to be the earlier one', () => {
    const [stopped] = stopLightboxGroups([rerun(landedA())], ['A'], 'Stopped before this group came back.');
    expect(stopped).toMatchObject({ status: 'cancelled', error: 'Stopped before this group came back.' });
    expect(stopped.pending).toBeUndefined();
    expect(ids(stopped)).toEqual(['h1', 'm1']);
    expect(stopped.earlierLenses).toEqual([
      { lens: 'headline', reason: 'Stopped before this group came back.' },
      { lens: 'motif', reason: 'Stopped before this group came back.' }
    ]);
    expect(stopped.staleLenses).toEqual([{ lens: 'motif', readAgainst: 'an-earlier-text' }]);
  });

  it('clears the earlier mark when a new reading of the lens lands', () => {
    const [stopped] = stopLightboxGroups([rerun(landedA())], ['A'], 'Stopped before this group came back.');
    const landed = settleLightboxGroup(rerun(stopped), outcome(['headline', 'motif'], {
      tiles: [tile('h2', 'headline'), tile('m2', 'motif', 'motif')]
    }), SECOND);
    expect(landed.earlierLenses).toBeUndefined();
  });

  it('keeps the Opinion the same way, in a run of every call as on its own', () => {
    const opinion = tile('op1', 'opinion', 'opinion');
    const f: LightboxReadingGroup = {
      ...emptyLightboxReadingGroup('F'), status: 'ok', lenses: ['opinion'], tiles: [opinion],
      provenance: [{ lens: 'opinion', run: 'run-1-token', model: 'provider/model-a', at: FIRST.at }]
    };
    const running = startLightboxGroups([f], [{ group: 'F', lenses: ['opinion'] }])[0];
    expect(running.tiles).toEqual([opinion]);
    const withheld = settleLightboxGroup(running, {
      ...outcome(['opinion'], { group: 'F' }),
      withheldBlocks: [{ kind: 'opinion', lens: 'opinion', reason: 'The opinion block kept fewer than 2 observations.' }],
      frictions: []
    }, SECOND);
    expect(withheld.tiles).toEqual([opinion]);
    expect(lightboxEarlierReason(withheld, 'opinion')).toBe('The opinion block kept fewer than 2 observations.');
  });
});

describe('template and summary are kept or replaced together (engagement sits on the movements)', () => {
  const template = tile('t1', 'template', 'template');
  const movement = tile('mv1', 'summary', 'movement');
  const e = (tiles: LightboxReadingTile[], lenses: LightboxLensId[]): LightboxReadingGroup => ({
    ...emptyLightboxReadingGroup('E'), status: 'ok', lenses, tiles,
    frictions: lenses.map((lens) => ({ lens, friction: 'f' })), quoteChecks: []
  });
  const withheldSummary = (tiles: LightboxReadingTile[]): LightboxGroupOutcome => ({
    ...outcome(['template', 'summary'], { group: 'E', tiles }),
    withheldBlocks: [{ kind: 'synopsis', lens: 'summary', reason: 'The summary block broke the format: movements.' }]
  });

  it('keeps the template with its summary when the summary is kept, though the new template stood', () => {
    const before = e([template, movement], ['template', 'summary']);
    const settled = settleLightboxGroup(
      startLightboxGroups([before], [{ group: 'E', lenses: ['template', 'summary'] }])[0],
      withheldSummary([tile('t2', 'template', 'template')]),
      SECOND
    );
    expect(ids(settled)).toEqual(['t1', 'mv1']);
    expect(lightboxEarlierReason(settled, 'summary')).toBe('The summary block broke the format: movements.');
    expect(lightboxEarlierReason(settled, 'template')).toBe(LIGHTBOX_KEEP_REASONS.together('summary'));
  });

  it('takes the new template when it had no earlier reading: there is no engagement of its own to keep', () => {
    const before = e([movement], ['summary']);
    const settled = settleLightboxGroup(
      startLightboxGroups([before], [{ group: 'E', lenses: ['template', 'summary'] }])[0],
      withheldSummary([tile('t2', 'template', 'template')]),
      SECOND
    );
    expect(ids(settled)).toEqual(['t2', 'mv1']);
    expect(lightboxEarlierReason(settled, 'template')).toBeUndefined();
  });

  it('replaces both when both stood', () => {
    const before = e([template, movement], ['template', 'summary']);
    const settled = settleLightboxGroup(
      startLightboxGroups([before], [{ group: 'E', lenses: ['template', 'summary'] }])[0],
      outcome(['template', 'summary'], { group: 'E', tiles: [tile('t2', 'template', 'template'), tile('mv2', 'summary', 'movement')] }),
      SECOND
    );
    expect(ids(settled)).toEqual(['t2', 'mv2']);
  });
});

describe('the cut-off words are the wire\'s', () => {
  it('shares the reading wire\'s reason for a block cut inside', () => {
    expect(LIGHTBOX_CUT_INSIDE_REASON).toBe(LIGHTBOX_CUT_OFF_REASON);
  });
});

describe('the models of the readings on the board', () => {
  it('falls back to a group\'s model on a board read before provenance, and leaves out a call with nothing on screen', () => {
    const legacy: LightboxReadingGroup = { ...emptyLightboxReadingGroup('B'), status: 'ok', lenses: ['voice'], tiles: [tile('v1', 'voice', 'voice')], model: 'provider/legacy' };
    const failed: LightboxReadingGroup = { ...emptyLightboxReadingGroup('C'), status: 'failed', lenses: [], tiles: [], model: 'provider/unused', error: 'x' };
    expect(lightboxBoardModels([legacy, failed])).toEqual(['provider/legacy']);
  });
});
