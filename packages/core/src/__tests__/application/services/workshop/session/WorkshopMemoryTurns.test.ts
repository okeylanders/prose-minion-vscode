/**
 * A memory card and a memory receipt in the session (ADR 2026-11-04 D6, D7,
 * D12; epic Slice 3): two optional, additive turn fields with no
 * `schemaVersion` bump.
 *
 * - A session saved before them reads and saves byte for byte.
 * - Both round-trip; each is refused on a turn that can't carry it.
 * - Rewind and Branch carry a card with its turn; New clears it. Memory
 *   files are not room state, so nothing here un-saves a memory.
 * - The transcript projection (and export and recall through it) shows a
 *   receipt as an event line and never a card's body.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  type WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { projectWorkshopTranscript, projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, type WorkshopProjectMemoryReceipt } from '@messages';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const BODY = 'NOTE-BODY-SENTINEL: we settled this at the tea party.';
const RECEIPT: WorkshopProjectMemoryReceipt = {
  action: 'saved',
  memoryId: 'mem-7f3c2a',
  title: 'The Rabbit\'s watch runs backward',
  version: '0123456789ab',
  by: 'writer',
  proposedBy: 'jill'
};

const fixtureText = (): string => JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-memory.json'));

/** A room whose second reply carries a card, saved, with its receipt after it. */
function roomWithCardAndReceipt() {
  const room = new ScriptedWorkshopRoom().start();
  room.memoryContext = { open: true, listed: new Map() };
  const first = room.hostMessage('Where is the cup?');
  const carded = room.hostMessage('So the watch runs backward?', {
    reply: `Yes.\n\n${memoryFrame({ body: BODY })}`
  });
  expect(carded.memoryProposal?.state).toBe('pending');
  room.session.setMemoryProposalState(carded.id, 'saved', 'mem-7f3c2a');
  const receipt = room.session.appendMemoryReceipt(RECEIPT);
  const last = room.hostMessage('And the Cat?');
  return { room, first, carded, receipt, last };
}

describe('memory cards and receipts in the session', () => {
  it('a session saved before them reads and saves byte for byte', () => {
    const text = fixtureText();
    expect(text).not.toContain('memoryProposal');
    expect(text).not.toContain('projectMemoryReceipt');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
  });

  it('a receipt is a session divider whose line names the memory, never its body', () => {
    const { receipt, carded } = roomWithCardAndReceipt();
    expect(receipt).toMatchObject({
      role: 'system',
      kind: 'divider',
      participant: 'session',
      artifact: 'memory_receipt',
      content: 'Saved to project memory: The Rabbit\'s watch runs backward (mem-7f3c2a).',
      projectMemoryReceipt: RECEIPT
    });
    expect(receipt.content).not.toContain('NOTE-BODY-SENTINEL');
    expect(carded.content).toBe('Yes.');
  });

  it('both round-trip through save and reopen, and hydrate as they were', () => {
    const { room, carded, receipt } = roomWithCardAndReceipt();
    const checkpoint = scriptedCheckpoint('memory', room);
    const text = JSON.stringify(checkpoint);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);

    const session = new WorkshopSessionService(() => 9_000);
    session.hydrateCommittedState(
      decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session.workshop,
      { host: 'host-conversation' },
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );
    const turns = session.readRoomLedger();
    expect(turns.find((turn) => turn.id === carded.id)?.memoryProposal).toMatchObject({ state: 'saved', memoryId: 'mem-7f3c2a', body: BODY });
    expect(turns.find((turn) => turn.id === receipt.id)?.projectMemoryReceipt).toEqual(RECEIPT);
  });

  describe('refused on a turn that can\'t carry it', () => {
    const withTurn = (mutate: (turns: Array<Record<string, unknown>>) => void): WorkshopPersistedSessionV2 => {
      const checkpoint = scriptedCheckpoint('memory', roomWithCardAndReceipt().room) as unknown as {
        workshop: { turns: Array<Record<string, unknown>> };
      };
      mutate(checkpoint.workshop.turns);
      return checkpoint as unknown as WorkshopPersistedSessionV2;
    };
    const card = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.memoryProposal)!;
    const receipt = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.projectMemoryReceipt)!;
    const writer = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.participant === 'writer')!;

    it.each<[string, (turns: Array<Record<string, unknown>>) => void, RegExp]>([
      ['a card on a writer turn', (turns) => { writer(turns).memoryProposal = card(turns).memoryProposal; }, /memoryProposal must be a host or guest persona reply/],
      ['a saved card naming no memory', (turns) => { delete (card(turns).memoryProposal as Record<string, unknown>).memoryId; }, /memoryProposal\.memoryId must be a memory id/],
      ['a pending card naming a memory', (turns) => { (card(turns).memoryProposal as Record<string, unknown>).state = 'pending'; }, /memoryProposal\.memoryId must be absent/],
      ['a card with an unknown field', (turns) => { (card(turns).memoryProposal as Record<string, unknown>).origin = 'proposed'; }, /unknown field origin/],
      ['a card of an unknown kind', (turns) => { (card(turns).memoryProposal as Record<string, unknown>).kind = 'secret'; }, /memoryProposal\.kind/],
      ['a receipt on a writer turn', (turns) => { writer(turns).projectMemoryReceipt = receipt(turns).projectMemoryReceipt; }, /projectMemoryReceipt must be a receipt only on a session memory_receipt divider/],
      ['a memory_receipt divider with no receipt', (turns) => { delete receipt(turns).projectMemoryReceipt; }, /projectMemoryReceipt must be a receipt on a memory_receipt divider/],
      ['a receipt with a bad version', (turns) => { (receipt(turns).projectMemoryReceipt as Record<string, unknown>).version = 'v1'; }, /version must be a memory version/],
      ['a receipt carrying a body', (turns) => { (receipt(turns).projectMemoryReceipt as Record<string, unknown>).body = BODY; }, /unknown field body/]
    ])('%s', (_name, mutate, message) => {
      const session = withTurn(mutate);
      expect(() => parseWorkshopPersistedSession(JSON.parse(JSON.stringify(session)))).toThrow(message);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(session)))).toThrow(message);
    });
  });

  describe('whole-room operations', () => {
    it('Rewind carries a card with the turn it keeps, and cuts it with the turn it cuts', () => {
      const { room, first, carded } = roomWithCardAndReceipt();
      const kept = rewindWorkshopSession({
        workshop: room.session.exportCommittedState(),
        conversations: room.archive(),
        cut: { kind: 'afterTurn', turnId: carded.id }
      });
      expect(kept.workshop.turns.find((turn) => turn.id === carded.id)?.memoryProposal?.state).toBe('saved');
      expect(kept.workshop.turns.some((turn) => turn.projectMemoryReceipt)).toBe(false);

      const cut = rewindWorkshopSession({
        workshop: room.session.exportCommittedState(),
        conversations: room.archive(),
        cut: { kind: 'afterTurn', turnId: first.id }
      });
      expect(cut.workshop.turns.some((turn) => turn.memoryProposal)).toBe(false);
    });

    it('Branch keeps the card and the receipt up to the cut; New clears them', async () => {
      const { room } = roomWithCardAndReceipt();
      const lastQuestion = room.session.readRoomLedger().filter((turn) => turn.participant === 'writer').at(-1)!;
      const harness = setupCoordinator();
      await harness.store.saveNamed(scriptedCheckpoint('carded', room));
      await harness.coordinator.initialize();
      await harness.coordinator.openNamed('carded');

      const outcome = await harness.coordinator.branchFrom({ kind: 'beforeTurn', turnId: lastQuestion.id });
      const branch = (await harness.store.readNamed(outcome.branch.sessionId))!;
      expect(branch.workshop.turns.filter((turn) => turn.memoryProposal)).toHaveLength(1);
      expect(branch.workshop.turns.filter((turn) => turn.projectMemoryReceipt)).toHaveLength(1);

      await harness.coordinator.resetSession({ start: 'carry' });
      const current = await harness.store.readCurrent();
      expect(JSON.stringify(current)).not.toContain('memoryProposal');
      expect(JSON.stringify(current)).not.toContain('projectMemoryReceipt');
    });
  });

  describe('the transcript projection, and export and recall through it', () => {
    it('shows a receipt as an event line and omits a card\'s body', () => {
      const { room, receipt, carded } = roomWithCardAndReceipt();
      expect(projectWorkshopTranscriptTurn(receipt)).toEqual({
        kind: 'event',
        turnId: receipt.id,
        timestamp: receipt.timestamp,
        text: 'Saved to project memory: The Rabbit\'s watch runs backward (mem-7f3c2a).'
      });
      expect(JSON.stringify(projectWorkshopTranscriptTurn(carded))).not.toContain('NOTE-BODY-SENTINEL');
      expect(JSON.stringify(workshopTurnPreview(carded))).not.toContain('NOTE-BODY-SENTINEL');

      const transcript = projectWorkshopTranscript(room.session.readRoomLedger(), { title: 'Memory', exportedAt: 0 });
      const markdown = renderWorkshopTranscriptMarkdown(transcript);
      expect(markdown).toContain('Saved to project memory: The Rabbit\'s watch runs backward (mem-7f3c2a).');
      expect(markdown).not.toContain('NOTE-BODY-SENTINEL');
      expect(markdown).not.toContain('prose-minion-memory-proposal');
    });

    it('recall reads the receipt as an event and never the card\'s body', () => {
      const { room, receipt } = roomWithCardAndReceipt();
      const document = buildWorkshopRecallDocument(scriptedCheckpoint('memory', room));
      expect(document.entries.find((entry) => entry.turnId === receipt.id)?.entry).toMatchObject({ kind: 'event' });
      expect(JSON.stringify(document)).not.toContain('NOTE-BODY-SENTINEL');
    });
  });
});
