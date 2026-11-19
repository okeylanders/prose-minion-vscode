import { workshopTurnAudience } from '@/application/services/workshop/WorkshopRoomAudience';
import { bundledHelpReference, helpDirectory, helpVersion } from '@/__tests__/application/services/workshop/help/bundledHelpReference';
import { createRecallRunHarness, recallCall } from '@/__tests__/application/services/workshop/recall/workshopRecallRunHarness';

it('answers the pin-file question from the bundled section, saves both private cards, and reopens them', async () => {
  const room = createRecallRunHarness({ help: bundledHelpReference });
  const { session, coordinator, manager, sent, log } = room;
  const question = 'How do I pin a file?';
  const query = 'pin a file';
  const unknownId = 'workshop#alice-missing-entry';
  const section = 'workshop#pinned-context';
  const cards = () => session.readRoomLedger().filter(turn => turn.capability?.operation.startsWith('help.'));
  try {
    await coordinator.initialize();
    session.setSessionScope('open');
    const reply = await room.host('help-host', question, [
      recallCall('help.search', `<query>${query}</query>`),
      () => {
        const hit = sent.at(-1)!.match(/workshop#pinned-context/);
        expect(hit).not.toBeNull();
        return recallCall('help.read', `<section>${hit![0]}</section>`);
      },
      () => {
        const evidence = sent.at(-1)!;
        expect(evidence).toContain(`Prose Minion reference, version ${helpVersion}`);
        expect(evidence).toContain('## Pinned context');
        const controls = ['Conversation settings', 'Pinned context', 'Add from project', 'Pin 1 file'];
        controls.forEach(control => expect(evidence).toContain(control));
        return `In the Workshop, open ${controls[0]} → ${controls[1]}. Choose ${controls[2]}, select the file, then press ${controls[3]}. See ${section}.`;
      }
    ]);
    expect(reply.content).toContain(`See ${section}`);
    await room.join('cliff', 'help-guest', 'Check the reference too.', [
      recallCall('help.read', `<section>${unknownId}</section><section>${section}</section>`),
      'The Pinned context section explains how to pin a project file.'
    ]);

    const summary = () => cards().map(turn => [turn.artifact, turn.capability!.status, turn.capability!.invokedBy.kind]);
    const expected = [['help_search', 'success', 'host'], ['help_read', 'success', 'host'], ['help_read', 'partial', 'personaGuest']];
    expect(summary()).toEqual(expected);
    expect(cards()[2].content).toContain(unknownId);
    expect(cards()[2].content).toContain('Pin 1 file');
    for (const card of cards()) {
      expect(workshopTurnAudience(card)).toEqual({ kind: 'private', principal: card.capability!.invokedBy });
      expect(card.capability!.publishedWithTurnId).toBeUndefined();
    }
    expect(manager.getContextSources(session.getHostConversationId())).toEqual([]);
    expect(manager.getContextSources(session.getPersonaGuestConversationId('cliff'))).toEqual([]);

    const saved = await coordinator.saveNamed('Reference room');
    await coordinator.resetSession({ start: 'full-reset' });
    expect(cards()).toHaveLength(0);
    await coordinator.openNamed(saved.sessionId);
    expect(summary()).toEqual(expected);

    const logged = (log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');
    expect(logged).toContain('[WorkshopHelpReference]');
    expect(logged).toContain('capability=help.search');
    expect(logged).toContain('capability=help.read');
    for (const privateText of [query, unknownId, helpDirectory, 'pinned-context.json', 'Add from project', 'Pin 1 file']) {
      expect(logged).not.toContain(privateText);
    }
  } finally {
    room.dispose();
  }
});
