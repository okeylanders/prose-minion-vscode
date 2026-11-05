/**
 * The model stamp at the completion boundary (ADR 2026-11-03 D7; Astra's
 * F-02 and its completion-stage note). A turn is stamped only when the text
 * it shows is the provider's: never the engine's stand-in, and never the note
 * completion writes for a widget-only reply.
 */
import {
  completeWorkshopRun,
  workshopMessageCompletionCopy
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const MODEL = {
  scope: 'assistant' as const,
  requestedModelId: 'vendor/requested',
  servedModelIds: ['vendor/served']
};

const gestureFrame = (writerInstructions = 'Preserve recognition breaking through control.'): string => [
  '### Try a widget',
  '<workshop-widget-recommendation version="1">',
  '<widget-id>', 'gesture-playground', '</widget-id>',
  '<target-phrase>', 'His eyes stretched wide.', '</target-phrase>',
  '<writer-instructions>', writerInstructions, '</writer-instructions>',
  '<surrounding-context>', 'Micah looked past Jasper.\nHis eyes stretched wide.', '</surrounding-context>',
  '<source-references>', 'none', '</source-references>',
  '<character-notes>', 'Micah has concealed his fear.', '</character-notes>',
  '</workshop-widget-recommendation>'
].join('\n');

describe('completeWorkshopRun model stamp', () => {
  let session: WorkshopSessionService;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'His eyes stretched wide.', source: { kind: 'manual' } });
    session.beginPersonaMessage('req-1', 'Prepare the widget.');
  });

  const settle = (content: string, extra: Partial<AnalysisResult> = {}) => completeWorkshopRun({
    session,
    requestId: 'req-1',
    label: 'Jill',
    result: {
      toolName: 'workshop-test',
      content,
      timestamp: new Date(0),
      conversationId: 'host-conv',
      model: MODEL,
      replySource: 'provider',
      ...extra
    },
    aborted: false,
    createsRetainedConversation: true,
    copy: workshopMessageCompletionCopy('Jill'),
    discardConversation: jest.fn(),
    readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
    log: jest.fn(),
    events: {
      streamCompleted: jest.fn(),
      turnCompleted: jest.fn(),
      status: jest.fn(),
      error: jest.fn(),
      widgetRecommendationRejected: jest.fn()
    }
  });

  it('stamps an ordinary provider reply', () => {
    expect(settle('It lands late.')?.model).toEqual(MODEL);
  });

  it('stamps a provider note that came with an accepted widget setup', () => {
    const turn = settle(`The stillness carries it.\n\n${gestureFrame()}`)!;

    expect(turn.widgetRecommendation?.widgetId).toBe('gesture-playground');
    expect(turn.content).toContain('The stillness carries it.');
    expect(turn.model).toEqual(MODEL);
  });

  it('does not stamp the note completion writes for an accepted widget-only reply', () => {
    const turn = settle(gestureFrame())!;

    expect(turn.widgetRecommendation?.widgetId).toBe('gesture-playground');
    expect(turn.content).toBe('Jill returned a widget setup without an accompanying note.');
    expect(turn.model).toBeUndefined();
  });

  it('does not stamp the note completion writes for a rejected widget-only reply', () => {
    const maximum = PROMPT_BUDGETS.workshopWidgets.gestureWriterInstructionsCharacters;
    const turn = settle(gestureFrame('x'.repeat(maximum + 1)))!;

    expect(turn.widgetRecommendation).toBeUndefined();
    expect(turn.content).toBe("Jill's widget setup could not be displayed on that pass. Ask Jill to try again.");
    expect(turn.model).toBeUndefined();
  });

  it('does not stamp the engine\'s stand-in for an unusable reply', () => {
    const turn = settle('The assistant returned no usable final response. Please try again.', {
      replySource: 'host-fallback'
    })!;

    expect(turn.content).toContain('no usable final response');
    expect(turn.model).toBeUndefined();
  });

  it('does not stamp a reply whose source is unknown', () => {
    expect(settle('It lands late.', { replySource: undefined })?.model).toBeUndefined();
  });
});
