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
      carryCuesThroughSession: true,
      proactiveAssistance: false
    };

    expect(coerceWorkshopConversationBehavior(behavior)).toEqual(behavior);
  });

  it('accepts Amplified as the third closed expression level', () => {
    const behavior = {
      interactionMode: 'conversational',
      expressionLevel: 'amplified',
      relationalDepth: 'reflective',
      carryCuesThroughSession: false,
      proactiveAssistance: true
    } as const;

    expect(coerceWorkshopConversationBehavior(behavior)).toEqual(behavior);
  });

  it('defaults proactive assistance on without discarding older explicit choices', () => {
    expect(coerceWorkshopConversationBehavior({
      interactionMode: 'conversational',
      expressionLevel: 'subtle',
      relationalDepth: 'reserved',
      carryCuesThroughSession: false
    })).toEqual({
      interactionMode: 'conversational',
      expressionLevel: 'subtle',
      relationalDepth: 'reserved',
      carryCuesThroughSession: false,
      proactiveAssistance: true
    });
  });

  it.each([
    undefined,
    {},
    { interactionMode: 'analysis' },
    {
      interactionMode: 'invented',
      expressionLevel: 'full',
      relationalDepth: 'attuned',
      carryCuesThroughSession: true,
      proactiveAssistance: true
    },
    {
      interactionMode: 'balanced',
      expressionLevel: 'full',
      relationalDepth: 'intrusive',
      carryCuesThroughSession: true,
      proactiveAssistance: true
    },
    {
      interactionMode: 'balanced',
      expressionLevel: 'full',
      relationalDepth: 'attuned',
      carryCuesThroughSession: true,
      proactiveAssistance: 'yes'
    },
    {
      interactionMode: 'balanced',
      expressionLevel: 'full',
      relationalDepth: 'attuned',
      carryCuesThroughSession: true,
      proactiveAssistance: true,
      inferredMood: 'do-not-persist'
    }
  ])('fails an invalid boundary value closed to the complete approved default', (raw) => {
    expect(coerceWorkshopConversationBehavior(raw)).toEqual(
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );
  });
});
