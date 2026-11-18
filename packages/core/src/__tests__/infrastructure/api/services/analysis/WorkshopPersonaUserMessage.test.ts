/**
 * A fresh host's envelope tallies the frames it places (ADR 2026-11-18 D3):
 * the excerpt block, standing context, the time and behavior frames. The
 * envelope is byte for byte the same with or without a recorder, and the
 * writer's message is never tallied. *Alice*.
 */
import { buildWorkshopPersonaUserMessage } from '@services/analysis/WorkshopPersonaUserMessage';
import { WorkshopContextTallyRecorder } from '@services/analysis/WorkshopContextTally';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import type { WorkshopPersonaConversationInput } from '@services/analysis/AssistantToolService';

const input = (excerpt: boolean): WorkshopPersonaConversationInput => ({
  personaId: 'jill',
  ...(excerpt ? {
    excerpt: {
      text: 'Alice was beginning to get very tired of sitting by her sister on the bank.',
      version: 1,
      source: { kind: 'file', sourceUri: 'file:///alice.md', relativePath: 'alice.md' },
      pinnedAt: 1
    }
  } : {}),
  message: 'What does Alice want?',
  behavior: DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  writerProfile: DEFAULT_WORKSHOP_WRITER_PROFILE,
  contextAttachmentsFrame: '<context-attachments count="1">The rabbit hole notes.</context-attachments>',
  timeFrame: '<workshop-time-context reason="session-start">Tea time.</workshop-time-context>',
  activationFrame: '<workshop-behavior-activation mode="balanced">Act.</workshop-behavior-activation>'
} as WorkshopPersonaConversationInput);

describe('buildWorkshopPersonaUserMessage tally (ADR 2026-11-18 D3)', () => {
  it.each([true, false])('tallies each frame it places and writes the same envelope (excerpt=%s)', (excerpt) => {
    const tally = new WorkshopContextTallyRecorder();
    const plain = buildWorkshopPersonaUserMessage(input(excerpt));
    expect(buildWorkshopPersonaUserMessage(input(excerpt), tally)).toBe(plain);
    const pieces = tally.snapshot();
    expect(pieces['context.attachments']).toBe(estimateTextTokens(input(excerpt).contextAttachmentsFrame!));
    expect(pieces['room.time']).toBe(estimateTextTokens(input(excerpt).timeFrame!));
    expect(pieces['room.behavior']).toBe(estimateTextTokens(input(excerpt).activationFrame!));
    expect(pieces['context.excerpt']).toBeGreaterThan(0);
    const total = Object.values(pieces).reduce((sum, tokens) => sum + tokens, 0);
    expect(total).toBeLessThan(estimateTextTokens(plain));
  });

  it('measures the excerpt block as the envelope writes it', () => {
    const tally = new WorkshopContextTallyRecorder();
    const message = buildWorkshopPersonaUserMessage(input(true), tally);
    const block = message.slice(message.indexOf('The following material is quoted'), message.indexOf('</pinned-excerpt>') + '</pinned-excerpt>'.length);
    expect(tally.snapshot()['context.excerpt']).toBe(estimateTextTokens(block));
  });
});
