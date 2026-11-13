/**
 * The phrasing fence holds; it never withholds (ADR 2026-11-04 D9, amended
 * 2026-11-11). A note whose sentence about the writer holds a listed word
 * shows its card, held `personal` with that word, under Ask first and Save
 * and tell me alike; it is never saved automatically, it comes before every
 * other hold, and the word reaches the card and the session, never a log.
 * *Alice*, made-up ids.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  type WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { settleWorkshopMemoryProposals } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import { WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM } from '@/application/services/workshop/memory/WorkshopMemoryAutoSave';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, type WorkshopProjectMemoryMode } from '@messages';
import { workshopMemoryHeldReason } from '@shared/constants/workshopProjectMemoryWrites';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

/** Fiction's vocabulary in a craft note to the writer: the bug's shape. */
const QUARREL = 'You\'ve kept Alice\'s family quarrel unresolved through chapter 9.';
const RELEASE = 'You\'ve kept the Duchess\'s release separate from the unresolved relationship question.';

type Mode = Exclude<WorkshopProjectMemoryMode, 'off'>;

function room(mode: Mode, options: { webResearchAttached?: boolean } = {}) {
  const scripted = new ScriptedWorkshopRoom().start();
  scripted.memoryContext = { open: true, mode, listed: new Map([['mem-1a9e04', 'The Rabbit\'s watch stops at six']]) };
  scripted.memoryAutoSave = jest.fn();
  scripted.webResearchAttached = options.webResearchAttached ?? false;
  return scripted;
}

describe('the phrasing fence\'s hold, "personal"', () => {
  it.each<Mode>(['ask', 'auto'])('under %s, two flagged notes show as held cards, each with its word, and nothing is saved', (mode) => {
    const scripted = room(mode);
    const carded = scripted.hostMessage('Where did we land on the arc?', {
      reply: `Two notes.\n\n${memoryFrame({ title: 'The quarrel stays open', body: QUARREL })}\n` +
        `${memoryFrame({ title: 'Release apart from the question', summary: RELEASE })}`
    });
    expect(carded.memoryProposals?.map((proposal) => [proposal.state, proposal.held, proposal.heldWord])).toEqual([
      ['pending', 'personal', 'family'],
      ['pending', 'personal', 'relationship']
    ]);
    expect(scripted.memoryAutoSave).not.toHaveBeenCalled();
    const lines = scripted.log.filter((line) => line.startsWith('Memory proposal'));
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.startsWith('Memory proposal held (reason=personal-inference; '))).toBe(true);
    const logged = scripted.log.join('\n');
    expect(logged).not.toMatch(/withheld|family|relationship|quarrel|Duchess/);
  });

  it('under Save and tell me, a flagged note is never handed to the saver, while an unflagged one beside it is', () => {
    const scripted = room('auto');
    const carded = scripted.hostMessage('Two things?', {
      reply: `Yes.\n\n${memoryFrame({ title: 'Quarrel', body: QUARREL })}\n${memoryFrame({ title: 'The watch' })}`
    });
    expect(carded.memoryProposals?.map((proposal) => proposal.held ?? 'saving')).toEqual(['personal', 'saving']);
    expect(scripted.memoryAutoSave).toHaveBeenCalledTimes(1);
    expect(scripted.memoryAutoSave).toHaveBeenCalledWith(expect.objectContaining({ id: carded.id }), [1]);
  });

  describe('comes before every other hold', () => {
    const settle = (reply: string, mode: Mode, webResearchAttached: boolean, autoSaves: number) => {
      const autoSavesInRoom = jest.fn(() => autoSaves);
      const settled = settleWorkshopMemoryProposals(
        extractWorkshopReplyControls(reply, { memoryOpen: true }).memory,
        { open: true, mode, listed: new Map([['mem-1a9e04', 'The Rabbit\'s watch stops at six']]) },
        { webResearchAttached, autoSavesInRoom }
      );
      return { settled, autoSavesInRoom };
    };

    it.each<[string, string, boolean, number]>([
      ['web-research', memoryFrame({ body: QUARREL }), true, 0],
      ['supersedes', memoryFrame({ body: QUARREL, supersedes: ['mem-1a9e04'] }), false, 0],
      ['room-cap', memoryFrame({ body: QUARREL }), false, WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM]
    ])('over %s', (_other, frame, webResearchAttached, autoSaves) => {
      const { settled, autoSavesInRoom } = settle(`Good.\n\n${frame}`, 'auto', webResearchAttached, autoSaves);
      expect(settled.proposals[0]).toMatchObject({ held: 'personal', heldWord: 'family' });
      expect(settled.autoSave).toEqual([]);
      expect(autoSavesInRoom).not.toHaveBeenCalled();
    });

    it('and takes no place under the cap: the next note still saves', () => {
      const { settled } = settle(
        `Good.\n\n${memoryFrame({ body: QUARREL })}\n${memoryFrame({ title: 'The watch' })}`,
        'auto', false, WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM - 1
      );
      expect(settled.proposals.map((proposal) => proposal.held ?? 'saving')).toEqual(['personal', 'saving']);
      expect(settled.autoSave).toEqual([1]);
    });

    it('under Ask first, it is the only hold recorded', () => {
      const { settled } = settle(
        `Good.\n\n${memoryFrame({ body: QUARREL, supersedes: ['mem-1a9e04'] })}\n${memoryFrame({ title: 'The watch', supersedes: ['mem-1a9e04'] })}`,
        'ask', true, 0
      );
      expect(settled.proposals.map((proposal) => proposal.held)).toEqual(['personal', undefined]);
    });
  });

  it('the card says why, naming the word', () => {
    expect(workshopMemoryHeldReason('personal', 'relationship')).toBe(
      'This note speaks of you near a word about personal life (“relationship”), so it waits for you to check it before saving.'
    );
    expect(workshopMemoryHeldReason('personal')).toBe(
      'This note speaks of you near a word about personal life, so it waits for you to check it before saving.'
    );
  });

  describe('in the session', () => {
    const checkpointOf = () => {
      const scripted = room('ask');
      const carded = scripted.hostMessage('The arc?', { reply: `Yes.\n\n${memoryFrame({ body: QUARREL })}` });
      return { scripted, carded, checkpoint: scriptedCheckpoint('personal', scripted) };
    };

    it('the hold and its word round-trip through save and reopen', () => {
      const { carded, checkpoint } = checkpointOf();
      const text = JSON.stringify(checkpoint);
      expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);

      const session = new WorkshopSessionService(() => 9_000);
      session.hydrateCommittedState(
        decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session.workshop,
        { host: 'host-conversation' },
        DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
      );
      expect(session.readRoomLedger().find((turn) => turn.id === carded.id)?.memoryProposals?.[0])
        .toMatchObject({ state: 'pending', held: 'personal', heldWord: 'family' });
    });

    it('the writer\'s Save keeps why it waited, and its word', () => {
      const { scripted, carded } = checkpointOf();
      scripted.session.setMemoryProposalState(carded.id, 0, 'saved', 'mem-7f3c2a');
      expect(scripted.session.readRoomLedger().find((turn) => turn.id === carded.id)?.memoryProposals?.[0])
        .toMatchObject({ state: 'saved', held: 'personal', heldWord: 'family' });
    });

    const mutated = (change: (card: Record<string, unknown>) => void): string => {
      const checkpoint = checkpointOf().checkpoint as unknown as { workshop: { turns: Array<Record<string, unknown>> } };
      const turn = checkpoint.workshop.turns.find((candidate) => candidate.memoryProposals)!;
      change((turn.memoryProposals as Array<Record<string, unknown>>)[0]);
      return JSON.stringify(checkpoint as unknown as WorkshopPersistedSessionV2);
    };

    it.each<[string, (card: Record<string, unknown>) => void]>([
      ['a personal hold without its word', (card) => { delete card.heldWord; }],
      ['a word that is not one lower-case word', (card) => { card.heldWord = 'Family quarrel'; }],
      ['a word on another hold', (card) => { card.held = 'web-research'; }],
      ['a word with no hold', (card) => { delete card.held; }]
    ])('refuses %s', (_name, change) => {
      const text = mutated(change);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(/memoryProposals\[0\]\.heldWord/);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text))).toThrow(/memoryProposals\[0\]\.heldWord/);
    });
  });
});
