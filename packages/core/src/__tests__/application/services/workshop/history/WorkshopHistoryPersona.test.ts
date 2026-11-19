/**
 * `history.*` through the persona capability and a committed run (ADR
 * 2026-11-19 D15, D16, D17): the real engine runs a host turn and a guest's
 * join, each calling the family through real XML; the completion boundary
 * commits them; the room is saved and reopened.
 *
 * - The cards: one per call, their artifacts and family label.
 * - Publication follows reads: a diff is shared with the reply that used
 *   it; a log stays private.
 * - A diff adds a `history` manifest row; a log adds none.
 * - The evidence is framed as quoted writer data.
 * - A session holding the new artifacts and kind saves and reopens; one
 *   from before the change reads byte for byte.
 * - Logs carry no id, subject, author, path or diff text.
 */
import { WORKSHOP_TURN_ARTIFACTS } from '@messages';
import {
  isWorkshopPublishableCapabilityEvidence,
  workshopTurnAudience
} from '@/application/services/workshop/WorkshopRoomAudience';
import { WORKSHOP_HISTORY_EVIDENCE_FRAMING } from '@/application/services/workshop/history/WorkshopHistoryCopy';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { createRecallRunHarness, recallCall as call } from '@/__tests__/application/services/workshop/recall/workshopRecallRunHarness';
import type { WorkshopHistoryPorts } from '@/application/services/workshop/history/WorkshopHistoryCapability';
import { WorkshopHistoryDiffCache } from '@/application/services/workshop/history/WorkshopHistoryDiffCache';
import { aliceCommits, EXCERPT_FS_PATH, fakeHistory, prose } from './historyFixtures';

const [newest, oldest] = aliceCommits(2, 'AUTHOR-MARKER Lewis');
const SUBJECT = 'Trim the tea party';
const OLD = prose('Alice sat by the river bank.', 'The Rabbit ran past.');
const NEW = prose('Alice sat by the river bank.', 'The Rabbit DIFF-MARKER walked past.');

function historyPorts(): WorkshopHistoryPorts {
  return {
    history: fakeHistory({ commits: [newest, oldest], texts: new Map([[oldest.id, OLD], [newest.id, NEW]]) }),
    fileSystem: { readFile: async () => new TextEncoder().encode(NEW) },
    excerpt: { excerptFile: async () => ({ kind: 'file', fsPath: EXCERPT_FS_PATH, relativePath: 'Drafts/PATH-MARKER.md' }) },
    diffs: new WorkshopHistoryDiffCache()
  };
}

describe('a room whose host and guest read a file\'s history', () => {
  let room: ReturnType<typeof createRecallRunHarness>;
  afterEach(() => room.dispose());

  it('records cards, publishes the diff with its reply, adds a history row, and reopens', async () => {
    room = createRecallRunHarness({ history: historyPorts() });
    const { session, coordinator, manager, log } = room;
    await coordinator.initialize();
    session.setSessionScope('open');
    const from = oldest.id.slice(0, 10);

    const hostReply = await room.host('h-1', 'What did I change since last week?', [
      call('history.log', '<group>excerpt</group>'),
      call('history.diff', `<group>excerpt</group><from>${from}</from><to>current</to>`),
      // Refused by the codec: a card is left, and the persona corrects itself.
      call('history.diff', '<group>excerpt</group><from>HEAD</from><to>current</to>'),
      'HOST-FINAL: you changed one word.'
    ]);
    await room.join('cliff', 'j-cliff', 'Is the new line better?', [
      call('history.diff', `<group>excerpt</group><from>${from}</from><to>${newest.id.slice(0, 10)}</to>`),
      'GUEST-FINAL: it walks better.'
    ]);

    const ledger = () => session.readRoomLedger();
    const cards = ledger().filter((turn) => turn.capability && turn.capability.operation.startsWith('history.'));
    expect(cards.map((turn) => [turn.artifact, turn.toolLabel, turn.capability!.status, turn.capability!.invokedBy.kind])).toEqual([
      ['history_log', 'File History', 'success', 'host'],
      ['history_diff', 'File History', 'success', 'host'],
      ['history_diff', 'File History', 'rejected', 'host'],
      ['history_diff', 'File History', 'success', 'personaGuest']
    ]);

    // Publication follows reads (D15): the diff with the reply that used it, the log never.
    expect(cards[0].capability!.publishedWithTurnId).toBeUndefined();
    expect(workshopTurnAudience(cards[0])).toEqual({ kind: 'private', principal: { kind: 'host' } });
    expect(cards[1].capability!.publishedWithTurnId).toBe(hostReply.id);
    expect(isWorkshopPublishableCapabilityEvidence(cards[1].capability!)).toBe(true);
    expect(isWorkshopPublishableCapabilityEvidence(cards[2].capability!)).toBe(false);

    // A diff adds one `history` row, with its card; the log and the refusal add none.
    const rows = manager.getContextSources(session.getHostConversationId());
    expect(rows.map((row) => [row.kind, row.label, row.turnId])).toEqual([
      ['history', `Drafts/PATH-MARKER.md · ${from} → current`, cards[1].id]
    ]);

    // The evidence, as each provider request carried it: escaped, closed by the trust class.
    const sent = room.sent.join('\n');
    expect(sent).toContain('<workshop-capability-result name=\\"history.diff\\" status=\\"success\\"');
    expect(sent).toContain(JSON.stringify(`</workshop-capability-result>\n${WORKSHOP_HISTORY_EVIDENCE_FRAMING}`).slice(1, -1));

    // Saved and reopened: the forward-only artifacts, operations and manifest kind read back.
    const saved = await coordinator.saveNamed('History room');
    await coordinator.resetSession({ start: 'full-reset' });
    await coordinator.openNamed(saved.sessionId);
    const reopened = ledger().filter((turn) => turn.capability && turn.capability.operation.startsWith('history.'));
    expect(reopened.map((turn) => [turn.artifact, turn.capability!.operation, turn.capability!.status])).toEqual([
      ['history_log', 'history.log', 'success'],
      ['history_diff', 'history.diff', 'success'],
      ['history_diff', 'history.diff', 'rejected'],
      ['history_diff', 'history.diff', 'success']
    ]);
    expect(manager.getContextSources(session.getHostConversationId()).map((row) => row.kind)).toEqual(['history']);

    // Logs (D17): the operation, counts and outcomes; never an id, a subject, an author, a path or diff text.
    const logged = (log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
    expect(logged.some((line) => line.includes('capability=history.diff input=file=excerpt; to=current; startChange=1 outcome=success'))).toBe(true);
    expect(logged.some((line) => line.includes('historyMetrics=outcome=diff;commits=n/a;changes=1/1;'))).toBe(true);
    for (const fragment of ['AUTHOR-MARKER', SUBJECT, 'PATH-MARKER', 'DIFF-MARKER', EXCERPT_FS_PATH, from, newest.id.slice(0, 7)]) {
      expect([fragment, logged.filter((line) => line.includes(fragment))]).toEqual([fragment, []]);
    }
  });
});

describe('the persisted lists (D15)', () => {
  it('holds the two artifacts in the closed list', () => {
    expect(WORKSHOP_TURN_ARTIFACTS.filter((name) => name.startsWith('history_'))).toEqual(['history_log', 'history_diff']);
  });

  it('reads an authentic session from before the change byte for byte, with nothing to normalize', () => {
    const text = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-history.json'));
    expect(text).not.toContain('history_');
    expect(text).not.toContain('"kind":"history"');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
    expect(reopened.session.schemaVersion).toBe(2);
  });
});
