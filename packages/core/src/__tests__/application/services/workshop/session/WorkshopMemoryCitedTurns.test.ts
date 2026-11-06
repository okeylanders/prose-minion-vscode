/**
 * A suggestion's cited turns (ADR 2026-11-05 D10; Bookmark Recall Slice 3):
 *
 * - the trailer's `cites-turn` decoded, bounded, and refused in an edit;
 * - the card's optional `cites` field, which survives save and reopen and
 *   is refused when malformed, with no `schemaVersion` bump;
 * - the host's check at save (`workshopProposalProvenance`): a cited turn is
 *   kept only when the open room holds it and the proposing persona could
 *   see it, then joins the sources after the writer's message and the
 *   reply, each once, within the bound of 32.
 *
 * *Alice*, made-up ids.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  type WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { cloneWorkshopMemoryProposal } from '@/application/services/workshop/session/WorkshopMemoryProposalRecords';
import {
  workshopCitedTurns,
  workshopProposalProvenance
} from '@handlers/domain/workshop/WorkshopProjectMemoryProvenance';
import { decodeWorkshopMemoryProposal } from '@/utils/workshopMemoryProposalProtocol';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, type WorkshopMemoryProposal, type WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PROJECT_MEMORY_LIST_ENTRIES } from '@shared/types/projectMemory';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

const LIVE = 'live-alice-0001';
const cites = (...ids: string[]) => ids.map((id) => `<cites-turn>${id}</cites-turn>`).join('\n');
const inner = (frame: string) => frame.replace(/^<prose-minion-memory-proposal>\n?/, '').replace(/\n?<\/prose-minion-memory-proposal>$/, '');

const turn = (id: string, fields: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id,
  role: id.includes('-user-') ? 'user' : 'assistant',
  participant: id.includes('-user-') ? 'writer' : 'host',
  kind: 'message',
  content: '',
  timestamp: 1,
  ...fields
} as WorkshopTurn);

const proposal = (ids: string[]): WorkshopMemoryProposal => ({
  proposes: 'new', title: 'The pig', kind: 'canon', summary: 'The baby turns into a pig.', body: '', state: 'pending', cites: ids
});

describe('the trailer\'s cited turns', () => {
  it('decodes each cited turn once, in the order written; none is no field at all', () => {
    const decoded = decodeWorkshopMemoryProposal(inner(memoryFrame({ extra: cites('turn-2-user-5', 'turn-3-assistant-6', 'turn-2-user-5') })));
    expect(decoded).toMatchObject({ kind: 'proposal', proposal: { cites: ['turn-2-user-5', 'turn-3-assistant-6'] } });
    const plain = decodeWorkshopMemoryProposal(inner(memoryFrame()));
    expect(plain.kind === 'proposal' && 'cites' in plain.proposal).toBe(false);
  });

  it('keeps a ref of another shape for the host to drop by id, and refuses one that isn\'t a single token', () => {
    expect(decodeWorkshopMemoryProposal(inner(memoryFrame({ extra: cites('current@live/bookmark-1-1', 'saved-1/bookmark-2-2') }))))
      .toMatchObject({ kind: 'proposal', proposal: { cites: ['current@live/bookmark-1-1', 'saved-1/bookmark-2-2'] } });
    expect(decodeWorkshopMemoryProposal(inner(memoryFrame({ extra: cites('two words') })))).toEqual({ kind: 'rejected', fault: 'invalid-cites' });
    expect(decodeWorkshopMemoryProposal(inner(memoryFrame({ extra: cites('') })))).toEqual({ kind: 'rejected', fault: 'invalid-cites' });
  });

  it('refuses more than citedTurns', () => {
    const many = Array.from({ length: PROMPT_BUDGETS.workshopProjectMemory.citedTurns + 1 }, (_, index) => `turn-${index + 1}-user-1`);
    expect(decodeWorkshopMemoryProposal(inner(memoryFrame({ extra: cites(...many) })))).toEqual({ kind: 'rejected', fault: 'too-many-cites' });
    expect(decodeWorkshopMemoryProposal(inner(memoryFrame({ extra: cites(...many.slice(1)) }))).kind).toBe('proposal');
  });

  it('refuses a cited turn in a change to a saved note: a change keeps its note\'s sources', () => {
    expect(decodeWorkshopMemoryProposal(`<edit>mem-7f3c2a</edit>\n<append>More tea.</append>\n${cites('turn-2-user-5')}`))
      .toEqual({ kind: 'rejected', fault: 'edit-cites' });
  });
});

describe('a card\'s cited turns in the session', () => {
  function citedRoom() {
    const room = new ScriptedWorkshopRoom().start();
    room.memoryContext = { open: true, mode: 'ask', listed: new Map() };
    const earlier = room.hostMessage('The Duchess sneezes?', { reply: 'Pepper everywhere.' });
    const carded = room.hostMessage('Remember the pig?', { reply: `Yes.\n\n${memoryFrame({ extra: cites(earlier.id) })}` });
    return { room, earlier, carded };
  }

  it('a reply\'s card carries what it cites', () => {
    const { carded, earlier } = citedRoom();
    expect(carded.memoryProposals?.[0]).toMatchObject({ proposes: 'new', cites: [earlier.id] });
  });

  it('round-trips through save and reopen, and the reopened room keeps the cited turn as a source', () => {
    const { room, carded, earlier } = citedRoom();
    const text = JSON.stringify(scriptedCheckpoint('cited', room));
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);

    const session = new WorkshopSessionService(() => 9_000);
    session.hydrateCommittedState(
      decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session.workshop,
      { host: 'host-conversation' },
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );
    const ledger = session.readRoomLedger();
    const reopened = ledger.find((candidate) => candidate.id === carded.id)!;
    const provenance = workshopProposalProvenance(ledger, reopened, LIVE, 'proposed', reopened.memoryProposals![0]);
    expect(provenance.sourceTurns).toContain(earlier.id);
    expect(provenance.sourceTurns.slice(1, 2)).toEqual([carded.id]);
  });

  it('refuses a malformed list in a saved session', () => {
    for (const bad of [[], ['two words'], ['turn-1-user-1', 'turn-1-user-1'], [7]]) {
      const checkpoint = scriptedCheckpoint('cited', citedRoom().room) as unknown as { workshop: { turns: Array<Record<string, unknown>> } };
      const card = checkpoint.workshop.turns.find((candidate) => candidate.memoryProposals)!;
      (card.memoryProposals as Array<Record<string, unknown>>)[0].cites = bad;
      const text = JSON.stringify(checkpoint as unknown as WorkshopPersistedSessionV2);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(/memoryProposals\[0\]\.cites/);
    }
  });

  it('clones the list, and writes the field only when present', () => {
    const cloned = cloneWorkshopMemoryProposal(proposal(['turn-1-user-1']));
    expect(cloned).toMatchObject({ cites: ['turn-1-user-1'] });
    const { cites: _none, ...plain } = proposal([]) as Extract<WorkshopMemoryProposal, { proposes: 'new' }>;
    expect('cites' in cloneWorkshopMemoryProposal(plain as WorkshopMemoryProposal)).toBe(false);
  });
});

describe('the host\'s check of cited turns at save', () => {
  const writer = turn('turn-1-user-10');
  const hostReply = turn('turn-2-assistant-11');
  const sidecar = turn('turn-3-assistant-12', { participant: 'tool', artifact: 'direct_tool_response' } as Partial<WorkshopTurn>);
  const guestReply = turn('turn-4-assistant-13', { participant: 'guest', personaId: 'margot' } as Partial<WorkshopTurn>);
  const prompted = turn('turn-5-user-14');
  const carded = turn('turn-6-assistant-15');
  const ledger = [writer, hostReply, sidecar, guestReply, prompted, carded];

  it('keeps what the room holds and the persona could see; drops the rest, by id and reason', () => {
    const dropped = jest.fn();
    const provenance = workshopProposalProvenance(ledger, carded, LIVE, 'proposed',
      proposal([hostReply.id, sidecar.id, 'turn-99-user-1', `current@${LIVE}/bookmark-1-1`, 'saved-1/bookmark-2-2', guestReply.id]), dropped);
    expect(provenance).toEqual({
      origin: 'proposed',
      sourceSession: LIVE,
      sourceTurns: [prompted.id, carded.id, hostReply.id, guestReply.id]
    });
    expect(dropped).toHaveBeenCalledWith([
      { id: sidecar.id, reason: 'not-visible' },
      { id: 'turn-99-user-1', reason: 'not-in-room' },
      { id: `current@${LIVE}/bookmark-1-1`, reason: 'not-a-turn' },
      { id: 'saved-1/bookmark-2-2', reason: 'not-a-turn' }
    ]);
  });

  it('a guest sees its own private work and the room, never another participant\'s private work', () => {
    const hostPrivate = turn('turn-7-assistant-16', {
      capability: { invokedBy: { kind: 'host' }, operation: 'transcript.read', status: 'success' }
    } as Partial<WorkshopTurn>);
    const guestPrivate = turn('turn-8-assistant-17', {
      capability: { invokedBy: { kind: 'personaGuest', personaId: 'margot' }, operation: 'transcript.read', status: 'success' }
    } as Partial<WorkshopTurn>);
    const guestCard = turn('turn-9-assistant-18', { participant: 'guest', personaId: 'margot' } as Partial<WorkshopTurn>);
    const room = [...ledger, hostPrivate, guestPrivate, guestCard];
    expect(workshopCitedTurns(room, guestCard, [hostPrivate.id, guestPrivate.id, hostReply.id])).toEqual({
      kept: [guestPrivate.id, hostReply.id],
      dropped: [{ id: hostPrivate.id, reason: 'not-visible' }]
    });
  });

  it('deduplicates against the reply\'s own sources and holds the bound of 32', () => {
    const many = Array.from({ length: 40 }, (_, index) => turn(`turn-${index + 10}-user-${index}`));
    const room = [...ledger, ...many];
    const provenance = workshopProposalProvenance(room, carded, LIVE, 'auto',
      proposal([prompted.id, carded.id, ...many.map((candidate) => candidate.id).slice(0, 30)]));
    expect(provenance.sourceTurns).toHaveLength(PROJECT_MEMORY_LIST_ENTRIES.sourceTurns);
    expect(provenance.sourceTurns.slice(0, 2)).toEqual([prompted.id, carded.id]);
    expect(new Set(provenance.sourceTurns).size).toBe(provenance.sourceTurns.length);
  });

  it('cites nothing: exactly as before', () => {
    const dropped = jest.fn();
    expect(workshopProposalProvenance(ledger, carded, LIVE, 'proposed', undefined, dropped)).toEqual({
      origin: 'proposed', sourceSession: LIVE, sourceTurns: [prompted.id, carded.id]
    });
    expect(workshopProposalProvenance(ledger, carded, undefined, 'proposed', proposal([hostReply.id]))).toEqual({
      origin: 'proposed', sourceTurns: []
    });
    expect(dropped).not.toHaveBeenCalled();
  });
});
