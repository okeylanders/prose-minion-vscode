import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopWidgetRecommendation
} from '@messages';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { parseWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { cloneWidgetRecommendation } from '@/application/services/workshop/WorkshopSessionRecords';

type ShowVsTellRecommendation = Extract<WorkshopWidgetRecommendation, { widgetId: 'show-vs-tell' }>;

const recommendation = (): ShowVsTellRecommendation => ({
  widgetId: 'show-vs-tell',
  seed: {
    beatText: 'She hadn’t trusted him since the funeral.',
    subject: 'the funeral line',
    sourceReferences: [{ kind: 'context-attachment', attachmentId: 'ctx-1' }],
    mustSurvive: 'The distrust is old and funeral-rooted.\nIt predates tonight.',
    mustNotChange: 'No flashback.',
    pov: { mode: 'close-third', focalCharacter: 'Mara' },
    position: 'evidence',
    channels: ['observable-action', 'interiority'],
    lengthBudget: 'plus-one-sentence'
  }
});

function sessionWith(widgetRecommendation: unknown): unknown {
  const session = new WorkshopSessionService(() => 1);
  session.setSessionScope('open');
  session.beginPersonaMessage('req-1', 'Should I carry the funeral line?');
  session.completeRun(
    'req-1',
    'It buys time and spends the moment.',
    undefined,
    false,
    'host-conv',
    [],
    undefined,
    widgetRecommendation as WorkshopWidgetRecommendation
  );
  return session.exportCommittedState();
}

describe('Show vs. Tell recommendation persistence', () => {
  it('round-trips a turn carrying the seed through the session codec', () => {
    const parsed = parseWorkshopSessionStateV1(sessionWith(recommendation()));
    const restored = new WorkshopSessionService(() => 2);
    restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);

    const turn = restored.getSnapshot().turns.find((entry) => entry.widgetRecommendation);
    expect(turn?.widgetRecommendation).toEqual(recommendation());
  });

  it('round-trips a seed saved before Slice 7: required must survive, one reference, no context text', () => {
    const old: ShowVsTellRecommendation = {
      widgetId: 'show-vs-tell',
      seed: { beatText: 'A beat.', sourceReferences: [{ kind: 'active-excerpt' }], mustSurvive: 'The fact.' }
    };
    const parsed = parseWorkshopSessionStateV1(sessionWith(old));
    const restored = new WorkshopSessionService(() => 2);
    const result = restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    // No widget repair runs: the seed's new field is optional (ADR 2026-07-30).
    expect(result.normalizations.filter((name) => name.includes('show-vs-tell'))).toEqual([]);
    expect(restored.getSnapshot().turns.find((entry) => entry.widgetRecommendation)
      ?.widgetRecommendation).toEqual(old);
  });

  it('round-trips a seed with context text, several canonical references, and no must survive (D2, D3)', () => {
    const edited: ShowVsTellRecommendation = {
      widgetId: 'show-vs-tell',
      seed: {
        beatText: 'A beat.',
        contextText: 'He set the mug down.\nShe did not look up.',
        sourceReferences: [
          { kind: 'active-excerpt' },
          { kind: 'context-attachment', attachmentId: 'ctx-2' },
          { kind: 'context-attachment', attachmentId: 'ctx-10' }
        ]
      }
    };
    const parsed = parseWorkshopSessionStateV1(sessionWith(edited));
    const restored = new WorkshopSessionService(() => 2);
    restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(restored.getSnapshot().turns.find((entry) => entry.widgetRecommendation)
      ?.widgetRecommendation).toEqual(edited);
  });

  it('round-trips the minimal seed with no optional suggestions', () => {
    const minimal: ShowVsTellRecommendation = {
      widgetId: 'show-vs-tell',
      seed: { beatText: 'A beat.', sourceReferences: [] }
    };
    const parsed = parseWorkshopSessionStateV1(sessionWith(minimal));
    const restored = new WorkshopSessionService(() => 2);
    restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(restored.getSnapshot().turns.find((entry) => entry.widgetRecommendation)
      ?.widgetRecommendation).toEqual(minimal);
  });

  it.each([
    ['a workup', { workup: null }],
    ['kept variants', { kept: [] }],
    ['a carry mode', { carryMode: 'direction' }],
    ['a note', { note: 'x' }],
    ['provenance', { provenance: { kind: 'pasted' } }]
  ])('cannot persist a seed that carries %s', (_label, extra) => {
    const forged = recommendation();
    Object.assign(forged.seed, extra);
    expect(() => parseWorkshopSessionStateV1(sessionWith(forged))).toThrow();
  });

  it.each([
    ['a missing seed', (r: ShowVsTellRecommendation) => ({ widgetId: r.widgetId })],
    ['a multi-line beat', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, beatText: 'one\ntwo' }
    })],
    ['an over-long must-survive', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, mustSurvive: 'x'.repeat(121) }
    })],
    ['an over-long context text', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, contextText: 'x'.repeat(20_001) }
    })],
    ['nine source references', (r: ShowVsTellRecommendation) => ({
      ...r,
      seed: {
        ...r.seed,
        sourceReferences: Array.from({ length: 9 }, (_, index) => (
          { kind: 'context-attachment', attachmentId: `ctx-${index + 1}` }
        ))
      }
    })],
    ['duplicate source references', (r: ShowVsTellRecommendation) => ({
      ...r,
      seed: { ...r.seed, sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'active-excerpt' }] }
    })],
    ['source references out of canonical order', (r: ShowVsTellRecommendation) => ({
      ...r,
      seed: {
        ...r.seed,
        sourceReferences: [
          { kind: 'context-attachment', attachmentId: 'ctx-2' },
          { kind: 'context-attachment', attachmentId: 'ctx-1' }
        ]
      }
    })],
    ['a focal character under an unspecified mode', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, pov: { mode: 'unspecified', focalCharacter: 'Mara' } }
    })],
    ['an unknown position', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, position: 'show-it' }
    })],
    ['a repeated channel', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, channels: ['interiority', 'interiority'] }
    })],
    ['channels in a non-canonical order', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, channels: ['interiority', 'observable-action'] }
    })],
    ['an over-long subject', (r: ShowVsTellRecommendation) => ({
      ...r, seed: { ...r.seed, subject: 'x'.repeat(61) }
    })]
  ])('rejects %s on parse', (_label, mutate) => {
    expect(() => parseWorkshopSessionStateV1(sessionWith(mutate(recommendation())))).toThrow();
  });

  it('fails closed at hydration on a hand-altered channel order, and names the rule', () => {
    const altered = recommendation();
    altered.seed.channels = ['interiority', 'observable-action'];

    expect(() => parseWorkshopSessionStateV1(sessionWith(altered)))
      .toThrow(/channels.*distinct channels in the fixed channel order/);
  });

  it('accepts every canonical subset the parser can emit, in any size', () => {
    const canonical = ['observable-action', 'sensory-evidence', 'interiority', 'dialogue-subtext', 'summary-exposition'] as const;
    for (let size = 1; size <= canonical.length; size += 1) {
      const subset = recommendation();
      subset.seed.channels = canonical.slice(0, size) as unknown as typeof subset.seed.channels;
      expect(() => parseWorkshopSessionStateV1(sessionWith(subset))).not.toThrow();
    }
    const sparse = recommendation();
    sparse.seed.channels = ['sensory-evidence', 'summary-exposition'];
    expect(() => parseWorkshopSessionStateV1(sessionWith(sparse))).not.toThrow();
  });

  it('deep-copies every nested seed value when cloning', () => {
    const original = recommendation();
    const copy = cloneWidgetRecommendation(original) as ShowVsTellRecommendation;
    expect(copy).toEqual(original);

    copy.seed.sourceReferences[0] = { kind: 'active-excerpt' };
    copy.seed.pov!.focalCharacter = 'changed';
    copy.seed.channels!.push('dialogue-subtext');
    copy.seed.beatText = 'changed';

    expect(original).toEqual(recommendation());
  });
});
