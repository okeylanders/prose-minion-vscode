/**
 * A held card in the session (ADR 2026-11-04 D8; epic Slice 5): Save and
 * tell me's reason to wait survives a reload only through the optional
 * `memoryProposals[].held` field. No `schemaVersion` bump: a session saved
 * before it reads and saves byte for byte, and an unknown reason is refused.
 * *Alice*, made-up ids.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  type WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { cloneWorkshopMemoryProposal } from '@/application/services/workshop/session/WorkshopMemoryProposalRecords';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, WORKSHOP_MEMORY_HOLDS } from '@messages';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

const fixtureText = (): string => JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-memory.json'));

/** A room whose reply carries a card Save and tell me held, for `held`. */
function heldRoom(webResearchAttached: boolean) {
  const room = new ScriptedWorkshopRoom().start();
  room.memoryContext = { open: true, mode: 'auto', listed: new Map() };
  room.memoryAutoSave = jest.fn();
  room.webResearchAttached = webResearchAttached;
  const carded = room.hostMessage('So the watch runs backward?', { reply: `Yes.\n\n${memoryFrame()}` });
  return { room, carded };
}

describe('a held memory card in the session', () => {
  it('completion holds a reply whose run had web research attached, and asks for no save', () => {
    const { room, carded } = heldRoom(true);
    expect(carded.memoryProposals?.[0]).toMatchObject({ state: 'pending', held: 'web-research' });
    expect(room.memoryAutoSave).not.toHaveBeenCalled();
  });

  it('completion hands an unheld reply under Save and tell me to the saver, once it is recorded', () => {
    const { room, carded } = heldRoom(false);
    expect(carded.memoryProposals?.[0]?.held).toBeUndefined();
    expect(room.memoryAutoSave).toHaveBeenCalledTimes(1);
    expect(room.memoryAutoSave).toHaveBeenCalledWith(expect.objectContaining({ id: carded.id }), [0]);
    expect(room.session.readRoomLedger().some((turn) => turn.id === carded.id)).toBe(true);
  });

  it('the reason round-trips through save and reopen, so the card says why after a reload', () => {
    const { room, carded } = heldRoom(true);
    const text = JSON.stringify(scriptedCheckpoint('held', room));
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);

    const session = new WorkshopSessionService(() => 9_000);
    session.hydrateCommittedState(
      decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session.workshop,
      { host: 'host-conversation' },
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );
    expect(session.readRoomLedger().find((turn) => turn.id === carded.id)?.memoryProposals?.[0])
      .toMatchObject({ state: 'pending', held: 'web-research' });
  });

  it('the writer\'s Save keeps why it waited', () => {
    const { room, carded } = heldRoom(true);
    room.session.setMemoryProposalState(carded.id, 0, 'saved', 'mem-7f3c2a');
    expect(room.session.readRoomLedger().find((turn) => turn.id === carded.id)?.memoryProposals?.[0])
      .toMatchObject({ state: 'saved', memoryId: 'mem-7f3c2a', held: 'web-research' });
  });

  it('refuses a reason it doesn\'t know', () => {
    const checkpoint = scriptedCheckpoint('held', heldRoom(true).room) as unknown as {
      workshop: { turns: Array<Record<string, unknown>> };
    };
    const card = checkpoint.workshop.turns.find((turn) => turn.memoryProposals)!;
    (card.memoryProposals as Array<Record<string, unknown>>)[0].held = 'busy';
    const text = JSON.stringify(checkpoint as unknown as WorkshopPersistedSessionV2);
    expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(/memoryProposals\[0\]\.held/);
    expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text))).toThrow(/memoryProposals\[0\]\.held/);
  });

  it('holds a supersession under Save and tell me, and asks for no save: nothing is written (Slice 6b)', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.memoryContext = { open: true, mode: 'auto', listed: new Map([['mem-1a9e04', 'The Rabbit\'s watch stops at six']]) };
    room.memoryAutoSave = jest.fn();
    const carded = room.hostMessage('So it runs backward now?', { reply: `Yes.\n\n${memoryFrame({ supersedes: ['mem-1a9e04'] })}` });
    expect(carded.memoryProposals?.[0]).toMatchObject({ state: 'pending', held: 'supersedes' });
    expect(room.memoryAutoSave).not.toHaveBeenCalled();
  });

  it('routes several cards one by one: a supersession held, the rest handed over by index, in order (Slice 6b)', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.memoryContext = { open: true, mode: 'auto', listed: new Map([['mem-1a9e04', 'The Rabbit\'s watch stops at six']]) };
    room.memoryAutoSave = jest.fn();
    const carded = room.hostMessage('Three things settled?', {
      reply: `Yes.\n\n${memoryFrame({ title: 'One' })}\n${memoryFrame({ title: 'Two', supersedes: ['mem-1a9e04'] })}\n${memoryFrame({ title: 'Three' })}`
    });
    expect(carded.memoryProposals?.map((proposal) => proposal.held ?? 'saving')).toEqual(['saving', 'supersedes', 'saving']);
    expect(room.memoryAutoSave).toHaveBeenCalledWith(expect.objectContaining({ id: carded.id }), [0, 2]);
  });

  it('a session saved before memory still reads and saves byte for byte', () => {
    const text = fixtureText();
    expect(text).not.toContain('held');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    expect(JSON.stringify(decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session)).toBe(text);
  });

  it('clones each reason, and writes the field only when present', () => {
    for (const held of WORKSHOP_MEMORY_HOLDS) {
      expect(cloneWorkshopMemoryProposal({ proposes: 'new', title: 'T', kind: 'canon', summary: 'S', body: '', state: 'pending', held }).held).toBe(held);
    }
    expect('held' in cloneWorkshopMemoryProposal({ proposes: 'new', title: 'T', kind: 'canon', summary: 'S', body: '', state: 'pending' })).toBe(false);
  });
});
