import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  coerceWorkshopConversationBehavior
} from '@messages';

describe('Workshop conversation behavior validation', () => {
  it('accepts only a complete closed behavior object', () => {
    const behavior = {
      interactionMode: 'analysis',
      expressionLevel: 'subtle',
      relationalDepth: 'reserved',
      carryCuesThroughSession: true
    };

    expect(coerceWorkshopConversationBehavior(behavior)).toEqual(behavior);
  });

  it('accepts Amplified as the third closed expression level', () => {
    const behavior = {
      interactionMode: 'conversational',
      expressionLevel: 'amplified',
      relationalDepth: 'reflective',
      carryCuesThroughSession: false
    } as const;

    expect(coerceWorkshopConversationBehavior(behavior)).toEqual(behavior);
  });

  it.each([
    undefined,
    {},
    { interactionMode: 'analysis' },
    {
      interactionMode: 'invented',
      expressionLevel: 'full',
      relationalDepth: 'attuned',
      carryCuesThroughSession: true
    },
    {
      interactionMode: 'balanced',
      expressionLevel: 'full',
      relationalDepth: 'intrusive',
      carryCuesThroughSession: true
    },
    {
      interactionMode: 'balanced',
      expressionLevel: 'full',
      relationalDepth: 'attuned',
      carryCuesThroughSession: true,
      inferredMood: 'do-not-persist'
    }
  ])('fails an invalid boundary value closed to the complete approved default', (raw) => {
    expect(coerceWorkshopConversationBehavior(raw)).toEqual(
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );
  });
});
