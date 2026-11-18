import { createNativeToolCallHarness, native } from '@/__tests__/application/services/workshop/nativeToolCalls/nativeToolCallHarness';
import { createFakeSettings } from '@/__tests__/mocks/platform';

const marker = 'private-writer-query';
const unknownField = 'private-field-from-manuscript';
const search = (body: string) => `<prose-minion-tool-call name="help.search">${body}</prose-minion-tool-call>`;

describe('help requests through the real persona engine with debug logging on', () => {
  it.each([
    ['typed help search', search(`<query>${marker}</query>`), 'Accepted'],
    ['native help search', native('help_search', { query: marker }), 'Accepted'],
    ['typed help read', '<prose-minion-tool-call name="help.read"><section>workshop#private-writer-query</section></prose-minion-tool-call>', 'Accepted'],
    ['rejected help search', search(`<query>${marker}</query><${unknownField}/>`), 'Rejected'],
    ['rejected native help read', native('help_read', { sections: [marker] }), 'Rejected'],
    ['unidentified mixed call', search(`<query>${marker}</query>`) + search('<query>a</query>'), 'Rejected']
  ] as const)('keeps %s out of the log', async (_label, reply, outcome) => {
    const room = createNativeToolCallHarness(createFakeSettings({ debugLogging: true }));
    try {
      await room.coordinator.initialize();
      room.session.setSessionScope('open');
      const turn = await room.hostTurn('Check the reference.', [reply, 'No additional information.']);
      expect(turn.unusedReplies).toBe(0);
      const logs = room.logLines().join('\n');
      expect(logs).toContain(`[AgentRunEngine] ${outcome} workshopPersona capability request`);
      expect(logs).not.toContain(marker);
      expect(logs).not.toContain(unknownField);
      expect(logs).not.toContain('BEGIN REJECTED CAPABILITY RESPONSE');
    } finally {
      room.dispose();
    }
  });
});
