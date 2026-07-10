import {
  WorkshopSessionService,
  WORKSHOP_SNAPSHOT_TURN_WINDOW
} from '@/application/services/WorkshopSessionService';

describe('WorkshopSessionService — Sprint 05 participants', () => {
  let clock: number;
  let service: WorkshopSessionService;

  beforeEach(() => {
    clock = 1_000;
    service = new WorkshopSessionService(() => ++clock);
  });

  const pin = (text = 'She leaves the letter on the table.') => service.setExcerpt({
    text,
    sourceUri: 'file:///chapter-one.md',
    relativePath: 'chapters/one.md'
  });

  it('starts with a private, id-free Jill host snapshot', () => {
    const snapshot = service.getSnapshot();

    expect(snapshot.participants).toEqual({
      host: { personaId: 'jill', hasConversation: false },
      toolSidecars: [],
      chatTarget: { kind: 'host' }
    });
    expect(JSON.stringify(snapshot)).not.toContain('conversationId');
  });

  it('selects a host before its first run and defensively snapshots it', () => {
    service.selectPersona('margot');
    const snapshot = service.getSnapshot();

    expect(snapshot.participants.host.personaId).toBe('margot');
    snapshot.participants.host.personaId = 'jill';
    expect(service.getSnapshot().participants.host.personaId).toBe('margot');
  });

  it('locks selection while a host request runs and after its retained conversation lands', () => {
    pin();
    service.beginPersonaMessage('host-1', 'Does this POV drift?');
    expect(() => service.selectPersona('quinn')).toThrow(/Cannot change/);

    service.completeRun('host-1', 'The camera stays close.', undefined, false, 'host-conv');
    expect(service.getHostConversationId()).toBe('host-conv');
    expect(service.getSnapshot().participants.host).toEqual({ personaId: 'jill', hasConversation: true });
    expect(() => service.selectPersona('quinn')).toThrow(/Cannot change/);
  });

  it('enforces the host-versus-tool-run invariant inside the aggregate', () => {
    pin();
    service.beginPersonaMessage('host-1', 'Stay with this scene.');
    service.completeRun('host-1', 'I am here.', undefined, false, 'host-conv');

    expect(() => service.beginToolRun('prose', 'tool-1')).toThrow(/persona host conversation/);
  });

  it('attributes host turns to the selected persona and preserves its conversation on follow-up', () => {
    pin();
    service.selectPersona('wren');
    service.beginPersonaMessage('host-1', 'Where does this line flatten?');
    const first = service.completeRun('host-1', 'Show me her hands.', undefined, false, 'host-conv');
    service.beginPersonaMessage('host-2', 'Give me another angle.');
    const followUp = service.completeRun('host-2', 'Try the physical anchor.');

    expect(first).toMatchObject({ personaId: 'wren', personaLabel: 'Wren', toolId: undefined });
    expect(followUp).toMatchObject({ personaId: 'wren', personaLabel: 'Wren', kind: 'message' });
    expect(service.getHostConversationId()).toBe('host-conv');
  });

  it('requires a usable excerpt before starting a persona message', () => {
    expect(() => service.beginPersonaMessage('host-1', 'Hello?')).toThrow(/pinned excerpt/);
  });

  it('adopts a successful pre-host tool run into its sidecar and direct target', () => {
    pin();
    service.beginToolRun('continuity', 'tool-1');
    const report = service.completeRun('tool-1', 'The cup teleports.', undefined, false, 'tool-conv');

    expect(report).toMatchObject({ toolId: 'continuity', personaId: undefined });
    expect(service.getToolSidecarConversationId('continuity')).toBe('tool-conv');
    expect(service.getSnapshot().participants).toEqual({
      host: { personaId: 'jill', hasConversation: false },
      toolSidecars: [{ toolId: 'continuity', hasConversation: true }],
      chatTarget: { kind: 'tool', toolId: 'continuity' }
    });
  });

  it('continues only a live direct tool target and attributes its assistant turn to the tool', () => {
    pin();
    service.beginToolRun('cliche', 'tool-1');
    service.completeRun('tool-1', 'One tired phrase.', undefined, false, 'tool-conv');
    service.beginDirectToolMessage('cliche', 'tool-2', 'What could replace it?');
    const reply = service.completeRun('tool-2', 'Use the image already present.');

    expect(reply).toMatchObject({ toolId: 'cliche', toolLabel: 'Cliché', personaId: undefined });
    expect(() => service.beginDirectToolMessage('prose', 'tool-3', 'Hello?')).toThrow(/without a retained sidecar/);
  });

  it('replaces only the same tool sidecar and keeps other direct routes available', () => {
    pin();
    service.beginToolRun('prose', 'prose-1');
    service.completeRun('prose-1', 'Report one.', undefined, false, 'prose-old');
    service.beginToolRun('continuity', 'cont-1');
    service.completeRun('cont-1', 'Report two.', undefined, false, 'cont-conv');
    service.beginToolRun('prose', 'prose-2');
    service.completeRun('prose-2', 'Replacement.', undefined, false, 'prose-new');

    expect(service.getToolSidecarConversationId('prose')).toBe('prose-new');
    expect(service.getToolSidecarConversationId('continuity')).toBe('cont-conv');
    expect(service.setChatTarget({ kind: 'tool', toolId: 'continuity' })).toBe(true);
    expect(service.getChatTarget()).toEqual({ kind: 'tool', toolId: 'continuity' });
  });

  it('rejects a direct target whose sidecar is absent', () => {
    pin();
    expect(service.setChatTarget({ kind: 'tool', toolId: 'style' })).toBe(false);
  });

  it('never adopts a zombie completion after preemption', () => {
    pin();
    service.beginPersonaMessage('host-1', 'First question');
    service.abandonRun('host-1');

    expect(service.completeRun('host-1', 'late', undefined, false, 'zombie')).toBeUndefined();
    expect(service.getHostConversationId()).toBeUndefined();
  });

  it('reset disposes all participants, clears the thread, and returns to Jill while preserving the excerpt', () => {
    const excerpt = pin();
    service.selectPersona('theo');
    service.beginToolRun('prose', 'tool-1');
    service.completeRun('tool-1', 'Tool report.', undefined, false, 'tool-conv');
    service.beginPersonaMessage('host-1', 'Does this move?');
    service.completeRun('host-1', 'It needs a turn.', undefined, false, 'host-conv');

    expect(service.reset().sort()).toEqual(['host-conv', 'tool-conv']);
    expect(service.getSnapshot()).toMatchObject({
      excerpt,
      turns: [],
      participants: {
        host: { personaId: 'jill', hasConversation: false },
        toolSidecars: [],
        chatTarget: { kind: 'host' }
      }
    });
  });

  it('excerpt replacement disposes conversations but preserves the selected pre-existing host choice', () => {
    pin();
    service.selectPersona('penny');
    service.beginToolRun('fresh', 'tool-1');
    service.completeRun('tool-1', 'A fresh read.', undefined, false, 'tool-conv');

    expect(service.replaceExcerpt({ text: 'A new excerpt.' })).toEqual(['tool-conv']);
    expect(service.getSnapshot().participants).toEqual({
      host: { personaId: 'penny', hasConversation: false },
      toolSidecars: [],
      chatTarget: { kind: 'host' }
    });
  });

  it('bounds long snapshot threads without leaking stored turn references', () => {
    pin();
    for (let i = 0; i < WORKSHOP_SNAPSHOT_TURN_WINDOW / 2 + 2; i++) {
      service.beginToolRun('prose', `tool-${i}`);
      service.completeRun(`tool-${i}`, `report ${i}`);
    }
    const snapshot = service.getSnapshot();
    expect(snapshot.turns).toHaveLength(WORKSHOP_SNAPSHOT_TURN_WINDOW);
    expect(snapshot.totalTurns).toBeGreaterThan(snapshot.turns.length);
    snapshot.turns[0].content = 'mutated';
    expect(service.getSnapshot().turns[0].content).not.toBe('mutated');
  });
});
