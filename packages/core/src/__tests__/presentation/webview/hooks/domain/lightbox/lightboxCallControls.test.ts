/**
 * Per-call run controls (Slice 4I, epic decisions 41–45): a widget's
 * Analyze and a call's Run in the Lenses panel, as the webview draws them.
 * What each reads, what it says before, after and while its call runs, its
 * price from the host's estimate, its accessible name, and every reason it
 * is disabled: another run, no key, no estimate, a call too large, every
 * lens of the call off, and the Opinion with nothing to weigh.
 *
 * PR #166: every price is an approximate total, the Opinion's included,
 * never a cap (F-01); every accessible name starts with its visible label
 * (N-01).
 */
import type { LightboxBoard, LightboxCallEstimate, LightboxLensId, LightboxReadingGroup, LightboxRunEstimate } from '@messages';
import { emptyLightboxReadingGroup, LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { LIGHTBOX_OPINION_NOTHING_TO_WEIGH } from '@shared/constants/lightboxOpinion';
import {
  LIGHTBOX_DIGEST_INPUT_NOTE,
  lightboxCallControls,
  lightboxCallCost,
  type LightboxCallControl,
  type LightboxCallControlsInput
} from '@hooks/domain/lightbox/lightboxCallControls';
import { makeBoard } from './lightboxBoardFixtures';
import { makeReadBoard, readGroup } from './lightboxReadingBoardFixtures';

const call = (group: LightboxCallEstimate['group'], lenses: LightboxLensId[], costUsd: number | undefined, extra: Partial<LightboxCallEstimate> = {}): LightboxCallEstimate => ({
  group, lenses, inputTokens: 3_000, expectedOutputTokens: 900, reservedOutputTokens: 12_000, fit: 'fits', ...(costUsd !== undefined ? { costUsd } : {}), ...extra
});

/** The host's estimate with every lens on but gravity and palette (call A reads three). */
const LENSES_OFF: LightboxLensId[] = ['gravity', 'palette'];
function estimate(overrides: Partial<LightboxRunEstimate> = {}): LightboxRunEstimate {
  return {
    boardId: 'board-8',
    key: 'estimate-board-8',
    model: 'provider/model-v1',
    contextLength: 200_000,
    groups: [
      call('A', ['headline', 'motif', 'tension'], 0.07),
      call('B', ['characters', 'voice', 'subtext'], 0.0412),
      call('C', ['genre', 'lineage', 'spark'], 0.003),
      call('D', ['stock', 'rhythm', 'numbers'], 0.05),
      call('E', ['template', 'pressure', 'artifacts', 'summary'], 0.06),
      call('G', ['steering'], 0.04),
      call('F', ['opinion'], 0.05, { inputBound: 'digest' })
    ],
    rereads: [],
    fit: 'fits',
    costUsd: 0.31,
    bookSized: false,
    sourceWords: 260,
    contextWords: 0,
    ...overrides
  };
}

const withGroup = (board: LightboxBoard, group: LightboxReadingGroup): LightboxBoard => ({
  ...board,
  readings: board.readings.map((entry) => (entry.group === group.group ? group : entry))
});

const controls = (board: LightboxBoard, overrides: Partial<LightboxCallControlsInput> = {}) =>
  lightboxCallControls({ board, estimate: estimate(), lensesOff: LENSES_OFF, providerPaused: false, running: false, ...overrides });

describe('a widget\'s Analyze', () => {
  it('runs its call before the call has run: the call\'s lenses that are on, priced, named for the call', () => {
    const analyze = controls(makeBoard(8)).lens.voice;
    expect(analyze).toEqual({
      group: 'B',
      lenses: ['characters', 'voice', 'subtext'],
      scope: { mode: 'group', group: 'B', lens: 'voice' },
      label: 'Analyze',
      cost: '≈ $0.04',
      name: 'Analyze, call B: Characters, Voice, Subtext · ≈ $0.04',
      blocked: false,
      inFlight: false,
      again: false
    });
  });

  it('becomes Re-analyze once its lens has a reading, and still runs the whole call', () => {
    const board = withGroup(makeBoard(8), readGroup('B'));
    expect(controls(board).lens.subtext).toMatchObject({
      label: 'Re-analyze', again: true, scope: { mode: 'group', group: 'B', lens: 'subtext' },
      name: 'Re-analyze, call B: Characters, Voice, Subtext · ≈ $0.04'
    });
    expect(controls(board).lens.subtext.reason).toBeUndefined();
  });

  it('says Analyzing… while the call reading it is in flight, and every other control waits with the reason', () => {
    const board = withGroup(makeBoard(8), { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice', 'subtext'] });
    const all = controls(board, { running: true });
    expect(all.lens.voice).toMatchObject({ label: 'Analyzing…', inFlight: true, reason: 'Call B is running. Stop is on the run line.', blocked: false });
    expect(all.lens.voice.cost).toBe('≈ $0.04');
    expect(all.lens.voice.name).toBe('Analyzing…, call B: Characters, Voice, Subtext · ≈ $0.04');
    expect(all.lens.motif).toMatchObject({ label: 'Analyze', reason: 'An analysis is running. Stop it, or wait for it to finish.', blocked: false });
    expect(all.group.A).toMatchObject({ label: 'Run A', reason: 'An analysis is running. Stop it, or wait for it to finish.' });
    expect(all.group.B).toMatchObject({ label: 'Running B…', inFlight: true, name: 'Running B…, call B: Characters, Voice, Subtext · ≈ $0.04' });
  });

  it('a tile\'s re-read of another lens in the same call leaves this widget waiting, not Analyzing…', () => {
    const board = withGroup(makeBoard(8), { ...readGroup('B'), status: 'running', pending: ['voice'] });
    const all = controls(board, { running: true });
    expect(all.lens.voice.label).toBe('Analyzing…');
    expect(all.lens.characters).toMatchObject({ label: 'Re-analyze', inFlight: false, reason: 'An analysis is running. Stop it, or wait for it to finish.' });
  });

  it('includes its own lens even when that lens is off, and leaves the call\'s other off lenses out', () => {
    const analyze = controls(makeBoard(8), { lensesOff: ['gravity', 'palette', 'motif'] }).lens.motif;
    expect(analyze.lenses).toEqual(['headline', 'motif', 'tension']);
    expect(analyze.scope).toEqual({ mode: 'group', group: 'A', lens: 'motif' });
    // Gravity and palette stay out: they are off and not the widget pressed.
    expect(controls(makeBoard(8)).lens.gravity.lenses).toEqual(['headline', 'motif', 'tension', 'gravity']);
  });

  it('is disabled without an API key, while the cost is estimated, or when the call is not priced', () => {
    const board = makeBoard(8);
    expect(controls(board, { providerPaused: true }).lens.voice.reason).toBe('Add an OpenRouter API key in Settings to run AI analyses.');
    expect(controls(board, { estimate: undefined }).lens.voice).toMatchObject({ reason: 'Its cost is being estimated.', blocked: false });
    expect(controls(board, { estimate: undefined }).lens.voice.cost).toBeUndefined();
    // Gravity's call with it added was never priced (it is off), so the press waits rather than sends an unpriced call.
    expect(controls(board).lens.gravity.reason).toBe('This call has no estimate yet. Wait for the cost, then press again.');
  });

  it('is disabled with the call\'s own reason, shown, when the call is too large for the window', () => {
    const tooLarge = estimate();
    tooLarge.groups = tooLarge.groups.map((entry) => (entry.group === 'D' ? { ...entry, fit: 'too-large' as const, inputTokens: 190_000 } : entry));
    expect(controls(makeBoard(8), { estimate: tooLarge }).lens.numbers).toMatchObject({
      blocked: true,
      reason: 'Call D would send about 190,000 tokens and reserve 12,000 for the reply, more than provider/model-v1\'s 200,000-token window allows.'
    });
  });
});

describe('the Opinion\'s Analyze', () => {
  it('says the Opinion has nothing to weigh, in the host\'s words, while nothing on the board is read and current', () => {
    const analyze = controls(makeBoard(8)).lens.opinion;
    expect(analyze).toMatchObject({
      group: 'F', lenses: ['opinion'], scope: { mode: 'group', group: 'F', lens: 'opinion' },
      label: 'Analyze', reason: LIGHTBOX_OPINION_NOTHING_TO_WEIGH, blocked: true
    });
    expect(LIGHTBOX_OPINION_NOTHING_TO_WEIGH).toBe(
      'Nothing on the board is read and current, so the Opinion has nothing to weigh. Analyze another call first, then the Opinion.'
    );
    expect(controls(makeBoard(8)).group.F).toMatchObject({ label: 'Run F', reason: LIGHTBOX_OPINION_NOTHING_TO_WEIGH, blocked: true });
  });

  it('runs once one call has landed, priced "≈" like every call, its name saying its input is at the digest limit', () => {
    const board = withGroup(makeBoard(8), readGroup('B'));
    const analyze = controls(board).lens.opinion;
    expect(analyze.reason).toBeUndefined();
    expect(analyze.cost).toBe('≈ $0.05');
    expect(analyze.name).toBe('Analyze, call F: Opinion · ≈ $0.05 · input at digest limit');
    // Run F says the same about the same call.
    expect(controls(board).group.F).toMatchObject({ label: 'Run F', cost: '≈ $0.05', name: 'Run F, call F: Opinion · ≈ $0.05 · input at digest limit' });
  });

  it('never presents its price as a maximum: a reply below the output ceiling can cost more than it shows (PR #166 F-01)', () => {
    // The review's figures: the digest's whole bound in the input, the typical
    // output priced, the call's ceiling reserved. Synthetic prices, no call made.
    const prompt = 0.000003;
    const completion = 0.000015;
    const opinion = call('F', ['opinion'], undefined, { inputTokens: 9_125, expectedOutputTokens: 1_440, reservedOutputTokens: 12_000, inputBound: 'digest' });
    const costUsd = opinion.inputTokens * prompt + opinion.expectedOutputTokens * completion;
    expect(costUsd).toBeCloseTo(0.048975, 9);
    const priced = estimate({ groups: [...estimate().groups.filter((entry) => entry.group !== 'F'), { ...opinion, costUsd }] });
    const board = withGroup(makeBoard(8), readGroup('B'));
    const shown: LightboxCallControl[] = [controls(board, { estimate: priced }).lens.opinion, controls(board, { estimate: priced }).group.F];

    // A permitted reply: 1,000 tokens in, 4,000 out, under the 12,000 the call reserves.
    const reply = { input: 1_000, output: 4_000 };
    expect(reply.output).toBeLessThan(opinion.reservedOutputTokens);
    const spent = reply.input * prompt + reply.output * completion;
    expect(spent).toBeCloseTo(0.063, 9);
    expect(spent).toBeGreaterThan(costUsd);

    for (const control of shown) {
      // What it shows is approximate, and less than that reply spent.
      expect(control.cost).toBe('≈ $0.05');
      expect(Number(control.cost?.replace(/^≈ \$/, ''))).toBeLessThan(spent);
      // Nothing in its label, price, name or tooltip says that is the most it can cost.
      for (const text of [control.label, control.cost ?? '', control.name]) {
        expect(text).not.toMatch(/\bup to\b|\bat most\b|\bmax(imum)?\b|\bcap\b|\bceiling\b|≤/i);
      }
      // Its input bound is said apart from the price.
      expect(control.name.endsWith(` · ≈ $0.05 · ${LIGHTBOX_DIGEST_INPUT_NOTE}`)).toBe(true);
    }
  });

  it('says nothing of its input bound without live pricing, and keeps it beside a tiny price', () => {
    const board = withGroup(makeBoard(8), readGroup('B'));
    const unpriced = estimate();
    unpriced.groups = unpriced.groups.map(({ costUsd: _costUsd, ...entry }) => entry);
    expect(controls(board, { estimate: unpriced }).lens.opinion).toMatchObject({ name: 'Analyze, call F: Opinion', blocked: false });
    expect(controls(board, { estimate: unpriced }).lens.opinion.reason).toBeUndefined();
    expect(controls(board, { estimate: unpriced }).lens.opinion.cost).toBeUndefined();
    const tiny = estimate();
    tiny.groups = tiny.groups.map((entry) => (entry.group === 'F' ? { ...entry, costUsd: 0.001 } : entry));
    expect(controls(board, { estimate: tiny }).group.F).toMatchObject({ cost: '< $0.01', name: 'Run F, call F: Opinion · < $0.01 · input at digest limit' });
  });

  it('counts only current readings: a board whose readings are all stale still has nothing to weigh', () => {
    const stale = withGroup(makeBoard(8), { ...readGroup('B'), staleLenses: ['characters', 'voice', 'subtext'].map((lens) => ({ lens: lens as LightboxLensId, readAgainst: 'old' })) });
    expect(controls(stale).lens.opinion.reason).toBe(LIGHTBOX_OPINION_NOTHING_TO_WEIGH);
  });

  it('says Re-analyze once the Opinion has a reading', () => {
    expect(controls(makeReadBoard()).lens.opinion).toMatchObject({ label: 'Re-analyze', again: true, name: 'Re-analyze, call F: Opinion · ≈ $0.05 · input at digest limit' });
  });
});

describe('a call\'s Run in the Lenses panel', () => {
  it('runs the call with its lenses that are on: Run before it holds a reading, Rerun after', () => {
    const before = controls(makeBoard(8)).group.A;
    expect(before).toMatchObject({
      label: 'Run A', scope: { mode: 'group', group: 'A' }, lenses: ['headline', 'motif', 'tension'],
      cost: '≈ $0.07', name: 'Run A, call A: Headline, Theme & motif, Tension arc · ≈ $0.07', again: false
    });
    const after = controls(withGroup(makeBoard(8), readGroup('A'))).group.A;
    expect(after).toMatchObject({ label: 'Rerun A', again: true, name: 'Rerun A, call A: Headline, Theme & motif, Tension arc · ≈ $0.07' });
  });

  it('is disabled, with the reason shown, when every lens of its call is off', () => {
    const run = controls(makeBoard(8), { lensesOff: ['steering'] }).group.G;
    expect(run).toMatchObject({ lenses: [], blocked: true, reason: 'Every lens of call G is off. Turn one on to run it.', name: 'Run G, call G' });
  });

  it('has one control per call, A–G', () => {
    expect(Object.keys(controls(makeBoard(8)).group).sort()).toEqual([...LIGHTBOX_READING_GROUPS].sort());
  });
});

describe('every control\'s accessible name starts with its visible label (PR #166 N-01)', () => {
  const running = withGroup(withGroup(makeBoard(8), readGroup('A')), { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice', 'subtext'] });
  const moments: Array<[string, LightboxBoard, Partial<LightboxCallControlsInput>]> = [
    ['before any call runs', makeBoard(8), {}],
    ['after one call landed', withGroup(makeBoard(8), readGroup('A')), {}],
    ['while a call runs', running, { running: true }],
    ['on a read board', makeReadBoard(), {}]
  ];

  it.each(moments)('%s: each name leads with the label its button shows', (_moment, board, overrides) => {
    const all = controls(board, overrides);
    for (const control of [...Object.values(all.group), ...Object.values(all.lens)]) {
      expect(control.name.startsWith(`${control.label}, call ${control.group}`)).toBe(true);
      if (control.cost) {
        expect(control.name).toContain(` · ${control.cost}`);
      }
    }
  });

  it('covers each label the buttons show', () => {
    const labels = new Set(moments.flatMap(([, board, overrides]) => {
      const all = controls(board, overrides);
      return [...Object.values(all.group), ...Object.values(all.lens)].map((control) => control.label.replace(/ [A-G]…?$/, (tail) => tail.replace(/[A-G]/, 'X')));
    }));
    expect([...labels].sort()).toEqual(['Analyze', 'Analyzing…', 'Re-analyze', 'Rerun X', 'Run X', 'Running X…']);
  });
});

describe('a call\'s price on its button', () => {
  it('reads "≈" or "< $0.01", the Opinion\'s too, and nothing without live pricing', () => {
    expect(lightboxCallCost({ costUsd: 0.0412 })).toBe('≈ $0.04');
    expect(lightboxCallCost({ costUsd: 0.001 })).toBe('< $0.01');
    expect(lightboxCallCost(call('F', ['opinion'], 0.05, { inputBound: 'digest' }))).toBe('≈ $0.05');
    expect(lightboxCallCost({})).toBeUndefined();
    const unpriced = estimate();
    unpriced.groups = unpriced.groups.map(({ costUsd: _costUsd, ...entry }) => entry);
    const analyze = controls(makeBoard(8), { estimate: unpriced }).lens.voice;
    expect(analyze.cost).toBeUndefined();
    expect(analyze.name).toBe('Analyze, call B: Characters, Voice, Subtext');
    expect(analyze.reason).toBeUndefined();
  });
});
