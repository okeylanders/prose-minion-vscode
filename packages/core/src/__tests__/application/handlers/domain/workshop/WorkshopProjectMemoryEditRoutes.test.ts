/**
 * A persona's suggested change to a saved memory, through the real router,
 * room handler, completion, slice composition and library (epic Slice 6c):
 *
 * - Save applies it with the existing `updated` receipt, whose version D14
 *   counts as told; the file says the result.
 * - Under Save and tell me it is held, pending, and nothing is written.
 * - A note changed since it was suggested refuses the Save, writes
 *   nothing, and leaves the card stale; Save is refused again after that.
 * - The sheet's version of the result saves as an ordinary update.
 * - Logs carry ids and reasons, never text.
 *
 * *Alice*, made-up ids.
 */

import * as path from 'node:path';
import { MessageType, type WorkshopMemoryDraft, type WorkshopMemoryEditProposal, type WorkshopTurn } from '@messages';
import { WORKSHOP_MEMORY_EDIT_CHANGED } from '@shared/constants/workshopProjectMemoryWrites';
import { decodeProjectMemory } from '@/infrastructure/storage/ProjectMemoryCodec';
import { projectMemoryDeliveredView } from '@/application/services/workshop/memory/ProjectMemoryDeliveredView';
import { MEMORY } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const SENTINEL = 'EDIT-TEXT-ONLY-IN-THE-FILE';
const NOTE: WorkshopMemoryDraft = {
  title: 'The Rabbit\'s watch runs backward',
  kind: 'canon',
  summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
  body: 'Settled at the tea party. The reader notices before Alice does.',
  supersedes: [],
  pinned: false
};

describe('Workshop routes — a suggested change to a saved memory', () => {
  let harness: WorkshopRouteTestHarness;
  let sent = 0;
  let noteId = '';

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const results = () => harness.posted(MessageType.WORKSHOP_MEMORY_WRITE_RESULT).map((entry) => entry.payload);
  const ledger = () => harness.session.readRoomLedger();
  const receipts = () => ledger().filter((turn) => turn.projectMemoryReceipt);
  const logged = () => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');
  const noteFile = () => [...harness.memory.fileSystem.files.keys()].find((file) => file.startsWith(MEMORY) && file.endsWith('.md'))!;
  const noteText = () => new TextDecoder().decode(harness.memory.fileSystem.files.get(noteFile()));
  const savedNote = () => {
    const decoded = decodeProjectMemory(noteText());
    if (decoded.kind !== 'memory') {
      throw new Error('unreadable');
    }
    return decoded.memory;
  };
  const card = (turnId: string) => ledger().find((turn) => turn.id === turnId)!.memoryProposals![0] as WorkshopMemoryEditProposal;
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const editFrame = (...elements: string[]) =>
    `<prose-minion-memory-proposal>\n<edit>${noteId}</edit>\n${elements.join('\n')}\n</prose-minion-memory-proposal>`;

  async function reply(trailer: string, extra: Record<string, unknown> = {}): Promise<WorkshopTurn> {
    sent += 1;
    const call = sent === 1 ? harness.service.startWorkshopPersonaConversation : harness.service.continueConversation;
    call.mockResolvedValueOnce(analysisResult(`Good.\n\n${trailer}`, { conversationId: 'host-conv', ...extra }) as never);
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: `Fix the watch note (${sent})` });
    await settle();
    return [...ledger()].reverse().find((turn) => turn.memoryProposals)!;
  }

  beforeEach(async () => {
    sent = 0;
    harness = createWorkshopRouteTestHarness();
    await harness.pin();
    await route(MessageType.WORKSHOP_MEMORY_CREATE, { requestId: 'c1', draft: NOTE });
    noteId = results()[0].memoryId!;
    harness.postMessage.mockClear();
  });

  it('shows the change as a card, and Save applies it with an updated receipt D14 counts as told', async () => {
    const turn = await reply(editFrame('<find-in-body>The reader notices before Alice does</find-in-body>', `<replace-with>Alice notices first. ${SENTINEL}</replace-with>`));
    expect(turn.content).toBe('Good.');
    expect(card(turn.id)).toMatchObject({ proposes: 'edit', state: 'pending', target: { id: noteId }, before: { body: NOTE.body } });

    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 's1', turnId: turn.id, index: 0, action: 'save' });

    expect(results()).toEqual([{ requestId: 's1', ok: true, memoryId: noteId }]);
    expect(savedNote().body.trim()).toBe(`Settled at the tea party. Alice notices first. ${SENTINEL}.`);
    expect(card(turn.id)).toMatchObject({ state: 'saved', memoryId: noteId });
    const receipt = receipts().at(-1)!;
    expect(receipt.projectMemoryReceipt).toMatchObject({ action: 'updated', memoryId: noteId, by: 'writer', proposedBy: 'jill' });
    expect(receipt.content).toBe(`Updated in project memory: ${NOTE.title} (${noteId}).`);
    const listed = await harness.memory.library.catalog();
    const version = listed.kind === 'catalog' ? listed.set.memories.find((entry) => entry.memory.id === noteId)?.version : undefined;
    expect(receipt.projectMemoryReceipt?.version).toBe(version);
    // D14: once delivered, the receipt is what the conversation was told; no update note repeats it.
    const view = projectMemoryDeliveredView(ledger(), { kind: 'host' }, { deliveredThroughTurnId: receipt.id });
    expect(view.memories.get(noteId)).toBe(version);
    expect(JSON.stringify(receipts())).not.toContain(SENTINEL);
    expect(logged()).not.toContain(SENTINEL);
  });

  it('under Save and tell me the change is held, pending, and nothing is written', async () => {
    harness.memory.state.mode = 'auto';
    const before = noteText();
    const turn = await reply(editFrame('<append>Also at six.</append>'));
    expect(card(turn.id)).toMatchObject({ state: 'pending', held: 'edit' });
    expect(noteText()).toBe(before);
    expect(receipts().filter((entry) => entry.projectMemoryReceipt?.action !== 'saved')).toEqual([]);
  });

  it('a note changed since it was suggested: the Save writes nothing, says why, and leaves only Dismiss', async () => {
    const turn = await reply(editFrame('<append>Also at six.</append>'));
    await route(MessageType.WORKSHOP_MEMORY_UPDATE, { requestId: 'w1', memoryId: noteId, patch: { ...NOTE, summary: 'Alice changed this by hand.' } });
    const byHand = noteText();
    harness.postMessage.mockClear();

    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 's2', turnId: turn.id, index: 0, action: 'save' });
    expect(results()).toEqual([{ requestId: 's2', ok: false, error: WORKSHOP_MEMORY_EDIT_CHANGED }]);
    expect(noteText()).toBe(byHand);
    expect(card(turn.id)).toMatchObject({ state: 'pending', stale: true });

    // Never re-anchored: a second Save is refused without writing, and Dismiss still works.
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 's3', turnId: turn.id, index: 0, action: 'save' });
    expect(results().at(-1)).toEqual({ requestId: 's3', ok: false, error: WORKSHOP_MEMORY_EDIT_CHANGED });
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'd1', turnId: turn.id, index: 0, action: 'dismiss' });
    expect(card(turn.id).state).toBe('dismissed');
    expect(noteText()).toBe(byHand);
    expect(logged()).toMatch(new RegExp(`proposal edit turnId=\\S+ index=0 memoryId=${noteId} refused reason=changed`));
  });

  it('the sheet\'s version of the result saves as an update, checked against the same version', async () => {
    const turn = await reply(editFrame('<append>Also at six.</append>'));
    const edited = { ...NOTE, body: `${NOTE.body}\n\nAlso at six, always.`, title: 'The Rabbit\'s watch, backward' };
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'e1', turnId: turn.id, index: 0, action: 'save', edited });
    expect(results()).toEqual([{ requestId: 'e1', ok: true, memoryId: noteId }]);
    expect(savedNote()).toMatchObject({ title: 'The Rabbit\'s watch, backward' });
    expect(savedNote().body.trim()).toBe(edited.body);
    expect(receipts().at(-1)?.projectMemoryReceipt).toMatchObject({ action: 'updated', memoryId: noteId });
  });

  it('a change to a note the listing doesn\'t hold makes no card, logged by reason', async () => {
    noteId = 'mem-0d0d0d';
    sent = 0;
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`Good.\n\n${editFrame('<append>x</append>')}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Fix it' });
    expect(ledger().some((turn) => turn.memoryProposals)).toBe(false);
    expect(logged()).toContain('Memory edit dropped (target=mem-0d0d0d; reason=unknown-target)');
    expect(path.basename(noteFile())).toMatch(/\.md$/);
  });
});
