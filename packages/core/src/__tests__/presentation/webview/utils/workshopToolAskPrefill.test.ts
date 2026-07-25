import { buildWorkshopToolAskPrefill } from '@utils/workshopToolAskPrefill';
import { WorkshopTurn } from '@messages';

const turn = (overrides: Partial<WorkshopTurn>): WorkshopTurn => ({
  id: 'turn-1',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_synthesis',
  excerptVersion: 0,
  content: 'Try ending one beat earlier.',
  timestamp: 1,
  personaId: 'jill',
  personaLabel: 'Jill',
  ...overrides
});

describe('buildWorkshopToolAskPrefill', () => {
  it('points to a suggestion only when a persona reply is the semantic tail', () => {
    expect(buildWorkshopToolAskPrefill('stock-and-signature', 'Jill', [
      turn({ participant: 'session', role: 'system', kind: 'divider', artifact: 'session_start' }),
      turn({})
    ])).toBe(
      "Hey Jill! Run Stock & Signature on your last suggestion and let's see what it finds."
    );
  });

  it.each([
    ['empty thread', []],
    ['writer tail', [turn({ role: 'user', participant: 'writer', personaId: undefined })]],
    ['tool tail', [turn({ participant: 'tool', personaId: undefined, artifact: 'tool_report' })]]
  ])('stays target-neutral for an %s', (_label, turns) => {
    expect(buildWorkshopToolAskPrefill('stock-and-signature', 'Jill', turns))
      .toBe('Hey Jill! Run Stock & Signature and tell me what it finds.');
  });
});
