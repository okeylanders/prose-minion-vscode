import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  coerceWorkshopConversationBehavior
} from '@messages';

describe('Workshop conversation behavior validation', () => {
  it('accepts only a complete closed behavior object', () => {
    const behavior = {
      interactionMode: 'analysis',
      expressionLevel: 'subtle',
      reactToCurrentMessage: false,
      carryCuesThroughSession: true
    };

    expect(coerceWorkshopConversationBehavior(behavior)).toEqual(behavior);
  });

  it.each([
    undefined,
    {},
    { interactionMode: 'analysis' },
    {
      interactionMode: 'invented',
      expressionLevel: 'full',
      reactToCurrentMessage: true,
      carryCuesThroughSession: true
    },
    {
      interactionMode: 'balanced',
      expressionLevel: 'full',
      reactToCurrentMessage: 'yes',
      carryCuesThroughSession: true
    },
    {
      interactionMode: 'balanced',
      expressionLevel: 'full',
      reactToCurrentMessage: true,
      carryCuesThroughSession: true,
      inferredMood: 'do-not-persist'
    }
  ])('fails an invalid boundary value closed to the complete approved default', (raw) => {
    expect(coerceWorkshopConversationBehavior(raw)).toEqual(
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );
  });
});
