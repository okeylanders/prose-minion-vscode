import {
  prepareGesturePlaygroundOneShotCommit
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundOneShotCommit';
import type {
  WorkshopGesturePlaygroundCommitPayload,
  WorkshopGesturePlaygroundDraft
} from '@messages';

const oversizedContextAttachmentId = `ctx-${'9'.repeat(500)}`;

const menu = [
  {
    heading: 'Delay the answer',
    options: ['the smile arrived late', 'her mouth considered it', 'the answer waited']
  },
  {
    heading: 'Move it into the hands',
    options: ['she turned the mug once', 'her thumb found the seam', 'the spoon went still']
  },
  {
    heading: 'Let the observer read it',
    options: ['he knew that careful quiet', 'he mistook it for ease', 'the delay told him enough']
  },
  {
    heading: 'Use the room',
    options: ['the kettle clicked between them', 'silence took the chair', 'the doorway stayed open']
  }
];

const draft = (
  overrides: Partial<WorkshopGesturePlaygroundDraft> = {}
): WorkshopGesturePlaygroundDraft => ({
  targetPhrase: 'she smiled',
  writerInstructions: 'Keep it private.',
  contextText: '',
  characterNotes: '',
  sourceReferences: [],
  dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
  menu,
  selections: ['the smile arrived late'],
  note: '',
  includeDictionaryInCommit: false,
  ...overrides
});

const payload = (
  overrides: Partial<WorkshopGesturePlaygroundCommitPayload> = {}
): WorkshopGesturePlaygroundCommitPayload => ({
  widgetId: 'gesture-playground',
  requestToken: 'commit-1',
  draft: draft(),
  ...overrides
});

describe('GesturePlaygroundOneShotCommit', () => {
  it('compiles only selected directions into the mechanical one-shot request', () => {
    expect(prepareGesturePlaygroundOneShotCommit(payload())).toEqual({
      ok: true,
      commit: expect.objectContaining({
        widgetId: 'gesture-playground',
        widgetConfigInput: { widgetId: 'gesture-playground', draft: draft() },
        roomText: 'For “she smiled” — here are the gesture directions I want.',
        displayText: 'For “she smiled” — here are the gesture directions I want.',
        artifact: {
          label: 'Gesture Playground',
          content: expect.stringContaining(
            'Gesture directions I want for "she smiled":\n· the smile arrived late'
          ),
          selectionCount: 1
        }
      })
    });
  });

  it.each([
    [
      'without optional clauses',
      {},
      'For “she smiled” — here are the gesture directions I want.'
    ],
    [
      'with a writer note',
      { note: 'Keep the refusal quiet' },
      'For “she smiled” — here are the gesture directions I want — Keep the refusal quiet.'
    ],
    [
      'with the full dictionary',
      { includeDictionaryInCommit: true },
      'For “she smiled” — here are the gesture directions I want, with the full Gesture Dictionary shared as reference.'
    ]
  ])('keeps room and writer-visible text exact %s', (_label, overrides, expected) => {
    const result = prepareGesturePlaygroundOneShotCommit(payload({
      draft: draft(overrides as Partial<WorkshopGesturePlaygroundDraft>)
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.commit.roomText).toBe(expected);
    expect(result.commit.displayText).toBe(expected);
  });

  it('includes the full dictionary only when the writer explicitly opts in', () => {
    const withoutDictionary = prepareGesturePlaygroundOneShotCommit(payload());
    const withDictionary = prepareGesturePlaygroundOneShotCommit(payload({
      draft: draft({ includeDictionaryInCommit: true })
    }));

    expect(withoutDictionary.ok && withoutDictionary.commit.artifact.content)
      .not.toContain('Full Gesture Dictionary shared by the writer');
    expect(withDictionary.ok && withDictionary.commit.artifact.content).toContain(
      'Full Gesture Dictionary shared by the writer as reference:\n' +
      '# Gesture Dictionary\n\nA private deflection.'
    );
  });

  it.each([
    ['no selections', { selections: [] }],
    ['blank phrase', { targetPhrase: '   ' }],
    ['duplicate selections', { selections: ['same', 'same'] }],
    ['missing dictionary', { dictionaryMarkdown: '' }],
    ['missing menu', { menu: undefined as never }],
    ['missing source references', { sourceReferences: undefined as never }],
    ['missing dictionary-sharing choice', { includeDictionaryInCommit: undefined as never }],
    [
      'duplicate source references',
      { sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'active-excerpt' }] }
    ],
    [
      'path-bearing source reference',
      {
        sourceReferences: [{
          kind: 'context-attachment',
          attachmentId: 'ctx-1',
          path: '/workspace/secret.md'
        } as never]
      }
    ],
    [
      'serialized source references over budget',
      {
        sourceReferences: [{
          kind: 'context-attachment',
          attachmentId: oversizedContextAttachmentId
        }]
      }
    ],
    ['selection outside menu', { selections: ['invented client option'] }]
  ])('rejects an invalid draft before producing mechanics: %s', (_label, draftOverrides) => {
    const result = prepareGesturePlaygroundOneShotCommit(payload({
      draft: draft(draftOverrides as Partial<WorkshopGesturePlaygroundDraft>)
    }));

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-draft',
      message: expect.any(String)
    });
  });

  it.each([
    ['blank phrase', { targetPhrase: '   ' }, 'Gesture Playground needs a target phrase.'],
    ['no selections', { selections: [] }, 'Keep at least one direction before committing.']
  ])('keeps the writer-facing refusal exact: %s', (_label, overrides, expected) => {
    expect(prepareGesturePlaygroundOneShotCommit(payload({
      draft: draft(overrides)
    }))).toEqual({ ok: false, reason: 'invalid-draft', message: expected });
  });
});
