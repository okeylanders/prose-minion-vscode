import {
  WorkshopApplyStandingWidgetPayload,
  WorkshopCommitWidgetPayload,
  WorkshopGesturePlaygroundGeneratePayload,
  WorkshopGesturePlaygroundGenerationProgressPayload,
  WorkshopGesturePlaygroundMenuResultPayload,
  WorkshopLexicalGravityDraft,
  WorkshopWidgetActionResultPayload
} from '@messages';

describe('Workshop widget contract exactness', () => {
  it('makes Gesture-only bodies impossible to pair with a sibling widget id', () => {
    const generate: WorkshopGesturePlaygroundGeneratePayload = {
      widgetId: 'gesture-playground',
      token: 'generate-1',
      mode: 'full',
      targetPhrase: 'she smiled',
      writerInstructions: '',
      contextText: '',
      characterNotes: '',
      sourceReferences: []
    };
    const progress: WorkshopGesturePlaygroundGenerationProgressPayload = {
      widgetId: 'gesture-playground',
      token: 'generate-1',
      phase: 'started',
      stage: 'dictionary',
      outputCharacters: 0,
      estimatedOutputTokens: 0,
      outputTokenLimit: 1_000
    };
    const result: WorkshopGesturePlaygroundMenuResultPayload = {
      widgetId: 'gesture-playground',
      token: 'generate-1',
      mode: 'full',
      ok: false,
      error: 'Stopped.'
    };

    const invalidGenerate: WorkshopGesturePlaygroundGeneratePayload = {
      ...generate,
      // @ts-expect-error Gesture generation cannot claim a sibling widget.
      widgetId: 'lexical-gravity'
    };
    const invalidProgress: WorkshopGesturePlaygroundGenerationProgressPayload = {
      ...progress,
      // @ts-expect-error Gesture progress cannot claim a sibling widget.
      widgetId: 'lexical-gravity'
    };
    const invalidResult: WorkshopGesturePlaygroundMenuResultPayload = {
      ...result,
      // @ts-expect-error Gesture menu results cannot claim a sibling widget.
      widgetId: 'lexical-gravity'
    };
    const invalidCommit: WorkshopCommitWidgetPayload = {
      widgetId: 'gesture-playground',
      requestToken: 'commit-1',
      // @ts-expect-error A Lexical draft cannot travel under the Gesture commit arm.
      draft: {} as WorkshopLexicalGravityDraft
    };
    const invalidApply: WorkshopApplyStandingWidgetPayload = {
      requestToken: 'apply-1',
      // @ts-expect-error A standing draft cannot claim the one-shot Gesture rail.
      widgetId: 'gesture-playground',
      draft: {} as WorkshopLexicalGravityDraft
    };
    // @ts-expect-error Apply acknowledgements cannot claim the Gesture identity.
    const invalidAction: WorkshopWidgetActionResultPayload = {
      action: 'apply-standing',
      requestToken: 'apply-1',
      widgetId: 'gesture-playground',
      ok: true
    };

    expect([
      generate.widgetId,
      progress.widgetId,
      result.widgetId
    ]).toEqual([
      'gesture-playground',
      'gesture-playground',
      'gesture-playground'
    ]);
    void invalidGenerate;
    void invalidProgress;
    void invalidResult;
    void invalidCommit;
    void invalidApply;
    void invalidAction;
  });
});
