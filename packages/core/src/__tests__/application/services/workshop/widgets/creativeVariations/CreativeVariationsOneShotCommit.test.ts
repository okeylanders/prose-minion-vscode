import {
  buildCreativeVariationsArtifact
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsArtifact';
import {
  prepareCreativeVariationsOneShotCommit
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsOneShotCommit';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopCreativeVariationsCommitPayload,
  WorkshopCreativeVariationsDraft
} from '@messages';
import {
  generatedDraft
} from '@/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariationsFixtures';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const selectedDraft = (
  selections: WorkshopCreativeVariationsDraft['selections'],
  overrides: Partial<WorkshopCreativeVariationsDraft> = {}
): WorkshopCreativeVariationsDraft => ({
  ...clone(generatedDraft),
  ...overrides,
  selections
});

const payload = (
  draft: WorkshopCreativeVariationsDraft
): WorkshopCreativeVariationsCommitPayload => ({
  widgetId: 'creative-variations',
  requestToken: 'commit-creative-1',
  draft
});

describe('CreativeVariations one-shot commit', () => {
  it('compiles the direction-only artifact exactly', () => {
    const artifact = buildCreativeVariationsArtifact(selectedDraft([
      { position: 1, carryMode: 'direction' }
    ]));

    expect(artifact).toBe(
      'Creative Variations — selected takes\n'
      + 'Take 1 — direction:\n'
      + 'cut the told line, downgrade the smile — baseline\n\n'
      + 'Writer-declared invariants\n'
      + 'Must survive: The distrust is old and funeral-rooted. The mug is offered, never handed.\n'
      + 'Must not change: Her last line stays “Somebody had to.”'
    );
  });

  it('compiles the full-prose artifact exactly after explicit promotion', () => {
    const artifact = buildCreativeVariationsArtifact(selectedDraft([
      { position: 1, carryMode: 'full-prose' }
    ]));

    expect(artifact).toBe(
      'Creative Variations — selected takes\n'
      + 'Take 1 — full prose:\n'
      + 'He set the mug down where her hand could reach it without asking. Her mouth moved, not quite a smile.\n\n'
      + 'Writer-declared invariants\n'
      + 'Must survive: The distrust is old and funeral-rooted. The mug is offered, never handed.\n'
      + 'Must not change: Her last line stays “Somebody had to.”'
    );
  });

  it('compiles mixed carry modes, model warnings, and the writer note without the cloud', () => {
    const draft = selectedDraft([
      { position: 1, carryMode: 'direction' },
      { position: 2, carryMode: 'full-prose' }
    ], { note: 'Let Jill challenge the second take first.' });

    const artifact = buildCreativeVariationsArtifact(draft);

    expect(artifact).toBe(
      'Creative Variations — selected takes\n'
      + 'Take 1 — direction:\n'
      + 'cut the told line, downgrade the smile — baseline\n'
      + 'Take 2 — full prose:\n'
      + 'She let it sit long enough that he heard the kettle. She was not going to touch it while he was watching.\n\n'
      + 'Writer-declared invariants\n'
      + 'Must survive: The distrust is old and funeral-rooted. The mug is offered, never handed.\n'
      + 'Must not change: Her last line stays “Somebody had to.”\n\n'
      + 'Model-declared invariant warnings\n'
      + 'Take 2 — advisory warning for Must survive: adds a fact — the chair\n\n'
      + 'Writer note\n'
      + 'Let Jill challenge the second take first.'
    );
    expect(artifact).not.toContain('Absence as furniture');
    expect(artifact).not.toContain('the funeral leaves the paragraph entirely');
    expect(artifact).not.toContain(generatedDraft.subject.text);
    expect(artifact).not.toContain('Drafts/chapter-five.md');
    expect(artifact).not.toContain('maximumPair');
  });

  it('does not invent either invariant section when the writer left both blank', () => {
    const draft = selectedDraft([
      { position: 1, carryMode: 'direction' }
    ], {
      invariants: { mustSurvive: '', mustNotChange: '' },
      workup: {
        ...clone(generatedDraft.workup!),
        cards: generatedDraft.workup!.cards.map((card) => ({
          ...clone(card),
          invariantFlags: []
        }))
      }
    });

    expect(buildCreativeVariationsArtifact(draft)).toBe(
      'Creative Variations — selected takes\n'
      + 'Take 1 — direction:\n'
      + 'cut the told line, downgrade the smile — baseline'
    );
  });

  it('prepares the exact authored draft and clone identity for the shared coordinator', () => {
    const draft = selectedDraft([
      { position: 1, carryMode: 'direction' }
    ], {
      intent: { ...generatedDraft.intent, aim: '' }
    });
    const result = prepareCreativeVariationsOneShotCommit({
      ...payload(draft),
      clonedFromConfigId: 'wc-7'
    });

    expect(result).toEqual({
      ok: true,
      commit: expect.objectContaining({
        widgetId: 'creative-variations',
        widgetConfigInput: { widgetId: 'creative-variations', draft },
        clonedFromConfigId: 'wc-7',
        artifact: expect.objectContaining({ selectionCount: 1 })
      })
    });
    if (result.ok) {
      const stored = result.commit.widgetConfigInput as {
        widgetId: 'creative-variations';
        draft: WorkshopCreativeVariationsDraft;
      };
      expect(stored.draft.intent.aim).toBe('');
      expect(result.commit.roomText).toContain(
        'for “He set the mug down where her hand could reach it without asking. She smiled.”'
      );
      expect(result.commit.artifact.content).not.toContain(generatedDraft.subject.text);
    }
  });

  it('rejects a wrong feature arm instead of accepting a loose widget/draft pair', () => {
    const result = prepareCreativeVariationsOneShotCommit({
      widgetId: 'gesture-playground',
      requestToken: 'wrong-arm',
      draft: {} as never
    } as never);

    expect(result).toEqual({
      ok: false,
      reason: 'unsupported-one-shot-widget',
      message: 'That payload does not belong to Creative Variations.'
    });
  });

  it('lets the writer commit advisory and hard-conflict-labelled cards', () => {
    const draft = selectedDraft([
      { position: 2, carryMode: 'direction' },
      { position: 3, carryMode: 'full-prose' }
    ]);

    const result = prepareCreativeVariationsOneShotCommit(payload(draft));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commit.artifact.content).toContain(
        'Take 2 — advisory warning for Must survive: adds a fact — the chair'
      );
      expect(result.commit.artifact.content).toContain(
        'Take 3 — strong warning for Must not change: moves her closing line'
      );
    }
  });

  it('keeps host-derived identity integrity load-bearing on the commit path', () => {
    const draft = selectedDraft([{
      position: 2,
      carryMode: 'direction'
    }]);
    draft.workup!.cards[1].invariantFlags[0].id = 'forged-risk-id';

    expect(prepareCreativeVariationsOneShotCommit(payload(draft))).toEqual({
      ok: false,
      reason: 'invalid-draft',
      message:
        'The Creative Variations workup no longer matches its authored inputs. Regenerate it before committing.'
    });
  });

  it('accepts the exact artifact limit and rejects one character over it', () => {
    const withProseLength = (proseLength: number): WorkshopCreativeVariationsDraft => {
      const draft = selectedDraft([
        { position: 1, carryMode: 'full-prose' }
      ]);
      const cards = draft.workup!.cards.map((card) => card.position === 1
        ? { ...card, prose: 'x'.repeat(proseLength) }
        : card);
      return {
        ...draft,
        workup: {
          ...draft.workup!,
          cards,
          overlap: computeCreativeVariationsTextualOverlap(draft.subject.text, cards)
        }
      };
    };
    const oneCharacterDraft = withProseLength(1);
    const fixedCharacters = buildCreativeVariationsArtifact(oneCharacterDraft).length - 1;
    const exact = withProseLength(
      PROMPT_BUDGETS.workshopWidgets.creativeArtifactCharacters - fixedCharacters
    );
    const over = withProseLength(
      PROMPT_BUDGETS.workshopWidgets.creativeArtifactCharacters - fixedCharacters + 1
    );

    expect(buildCreativeVariationsArtifact(exact)).toHaveLength(20_000);
    expect(prepareCreativeVariationsOneShotCommit(payload(exact)).ok).toBe(true);
    expect(buildCreativeVariationsArtifact(over)).toHaveLength(20_001);
    expect(prepareCreativeVariationsOneShotCommit(payload(over))).toEqual({
      ok: false,
      reason: 'invalid-draft',
      message: 'The Creative Variations artifact exceeds 20,000 characters.'
    });
  });
});
