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
  expect(carded.memoryProposals?.[0]?.state).toBe('pending');
  room.session.setMemoryProposalState(carded.id, 0, 'saved', 'mem-7f3c2a');
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
    expect(turns.find((turn) => turn.id === carded.id)?.memoryProposals).toMatchObject([{ proposes: 'new', state: 'saved', memoryId: 'mem-7f3c2a', body: BODY }]);
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
    const card = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.memoryProposals)!;
    const first = (turns: Array<Record<string, unknown>>) => (card(turns).memoryProposals as Array<Record<string, unknown>>)[0];
    const receipt = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.projectMemoryReceipt)!;
    const writer = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.participant === 'writer')!;

    it.each<[string, (turns: Array<Record<string, unknown>>) => void, RegExp]>([
      ['a card on a writer turn', (turns) => { writer(turns).memoryProposals = card(turns).memoryProposals; }, /memoryProposals must be a host or guest persona reply/],
      ['a saved card naming no memory', (turns) => { delete first(turns).memoryId; }, /memoryProposals\[0\]\.memoryId must be a memory id/],
      ['a pending card naming a memory', (turns) => { first(turns).state = 'pending'; }, /memoryProposals\[0\]\.memoryId must be absent/],
      ['a card with an unknown field', (turns) => { first(turns).origin = 'proposed'; }, /unknown field origin/],
      ['a card of an unknown kind', (turns) => { first(turns).kind = 'secret'; }, /memoryProposals\[0\]\.kind/],
      ['a card proposing something unknown', (turns) => { first(turns).proposes = 'rename'; }, /memoryProposals\[0\]\.proposes/],
      ['a card that names what it proposes nowhere', (turns) => { delete first(turns).proposes; }, /memoryProposals\[0\]/],
      ['an empty list of cards', (turns) => { card(turns).memoryProposals = []; }, /memoryProposals/],
      ['more cards than a reply may carry', (turns) => {
        card(turns).memoryProposals = Array.from({ length: 11 }, () => ({ ...first(turns) }));
      }, /memoryProposals/],
      ['the single card of before the list, in the current shape', (turns) => {
        const turn = card(turns);
        const { proposes: _proposes, ...single } = first(turns);
        delete turn.memoryProposals;
        turn.memoryProposal = single;
      }, /memoryProposal must be absent/],
      ['a receipt on a writer turn', (turns) => { writer(turns).projectMemoryReceipt = receipt(turns).projectMemoryReceipt; }, /projectMemoryReceipt must be a receipt only on a session memory_receipt divider/],
      ['a memory_receipt divider with no receipt', (turns) => { delete receipt(turns).projectMemoryReceipt; }, /projectMemoryReceipt must be a receipt on a memory_receipt divider/],
      ['a receipt with a bad version', (turns) => { (receipt(turns).projectMemoryReceipt as Record<string, unknown>).version = 'v1'; }, /version must be a memory version/],
      ['a receipt carrying a body', (turns) => { (receipt(turns).projectMemoryReceipt as Record<string, unknown>).body = BODY; }, /unknown field body/]
    ])('%s', (name, mutate, message) => {
      const session = withTurn(mutate);
      expect(() => parseWorkshopPersistedSession(JSON.parse(JSON.stringify(session)))).toThrow(message);
      if (!name.startsWith('the single card')) {
        expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(session)))).toThrow(message);
      }
    });

    it('a development checkpoint\'s single card is listed as its only card, and logged by name (Slice 6b)', () => {
      const session = withTurn((turns) => {
        const turn = card(turns);
        const { proposes: _proposes, ...single } = first(turns);
        delete turn.memoryProposals;
        turn.memoryProposal = single;
      });
      const text = JSON.stringify(session);
      expect(text).toContain('"memoryProposal"');
      const decoded = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
      expect(decoded.normalizations).toEqual(['listed-single-memory-proposal']);
      const listed = decoded.session.workshop.turns.find((turn) => turn.memoryProposals)!;
      expect(listed.memoryProposals).toEqual([expect.objectContaining({ proposes: 'new', state: 'saved', memoryId: 'mem-7f3c2a', body: BODY })]);
      expect(JSON.stringify(decoded.session)).not.toContain('"memoryProposal"');
      // What it writes back is the current shape, read whole.
      expect(() => parseWorkshopPersistedSession(JSON.parse(JSON.stringify(decoded.session)))).not.toThrow();
    });

    it('a development checkpoint can\'t hold both shapes', () => {
      const session = withTurn((turns) => {
        const { proposes: _proposes, ...single } = first(turns);
        card(turns).memoryProposal = single;
      });
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(session)))).toThrow(/memoryProposal must be absent beside memoryProposals/);
    });
  });

  describe('an edit card (Slice 6c)', () => {
    const EDIT = {
      proposes: 'edit',
      title: 'The Rabbit\'s watch runs backward',
      kind: 'canon',
      summary: 'From chapter 2 on, the White Rabbit\'s watch runs backward.',
      body: 'Settled at the tea party. Alice notices first.',
      state: 'pending',
      held: 'edit',
      target: {
        id: 'mem-7f3c2a',
        token: '0123456789ab',
        pinned: true,
        supersedes: ['mem-1a9e04', 'mem-0e0e0e'],
        replaces: [{ id: 'mem-1a9e04', title: 'The watch stops at six' }]
      },
      before: { title: 'The Rabbit\'s watch runs backward', kind: 'canon', summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.', body: BODY }
    };
    const withEdit = (changes: Record<string, unknown> = {}): string => {
      const checkpoint = scriptedCheckpoint('memory', roomWithCardAndReceipt().room) as unknown as { workshop: { turns: Array<Record<string, unknown>> } };
      checkpoint.workshop.turns.find((turn) => turn.memoryProposals)!.memoryProposals = [{ ...EDIT, ...changes }];
      return JSON.stringify(checkpoint);
    };

    it('round-trips through save and reopen, byte for byte, and hydrates as it was', () => {
      const text = withEdit({ stale: true });
      expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
      const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
      expect(JSON.stringify(reopened.session)).toBe(text);
      expect(reopened.normalizations).toEqual([]);
      const session = new WorkshopSessionService(() => 9_000);
      session.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
      expect(session.readRoomLedger().find((turn) => turn.memoryProposals)?.memoryProposals).toEqual([{ ...EDIT, stale: true }]);
    });

    it.each<[string, Record<string, unknown>, RegExp]>([
      ['a token that is not one', { target: { ...EDIT.target, token: 'v1' } }, /target\.token must be an edit token/],
      ['no complete list of what the note supersedes', { target: { id: 'mem-7f3c2a', token: '0123456789ab', pinned: true } }, /missing required field supersedes/],
      ['a title for a memory the note does not supersede', {
        target: { ...EDIT.target, replaces: [{ id: 'mem-000009', title: 'Elsewhere' }] }
      }, /target\.replaces must be only memories the note supersedes/],
      ['a target that is not a memory id', { target: { ...EDIT.target, id: 'the watch' } }, /target\.id must be a memory id/],
      ['no before', { before: undefined }, /missing required field before/],
      ['a new note\'s field', { supersedes: [{ id: 'mem-1a9e04', title: 'x' }] }, /unknown field supersedes/],
      ['a saved edit naming another memory', { state: 'saved', memoryId: 'mem-000001' }, /memoryId must be the memory the edit changed/],
      ['stale that is not true', { stale: false }, /stale must be true or absent/],
      ['a result past its bound', { summary: 'x'.repeat(281) }, /summary/]
    ])('refuses %s', (_name, changes, message) => {
      const text = withEdit(changes);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(message);
    });

    it('a saved edit names its target as the memory it changed', () => {
      const text = withEdit({ state: 'saved', memoryId: 'mem-7f3c2a', held: undefined });
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).not.toThrow();
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
      expect(kept.workshop.turns.find((turn) => turn.id === carded.id)?.memoryProposals?.[0]?.state).toBe('saved');
      expect(kept.workshop.turns.some((turn) => turn.projectMemoryReceipt)).toBe(false);

      const cut = rewindWorkshopSession({
        workshop: room.session.exportCommittedState(),
        conversations: room.archive(),
        cut: { kind: 'afterTurn', turnId: first.id }
      });
      expect(cut.workshop.turns.some((turn) => turn.memoryProposals)).toBe(false);
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
      expect(branch.workshop.turns.filter((turn) => turn.memoryProposals)).toHaveLength(1);
      expect(branch.workshop.turns.filter((turn) => turn.projectMemoryReceipt)).toHaveLength(1);

      await harness.coordinator.resetSession();
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
