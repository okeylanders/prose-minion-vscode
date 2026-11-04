/**
 * Project memory's write routes through the real router, room handler,
 * slice composition and library (ADR 2026-11-04 D6, D7, D8; epic Slice 3):
 * a persona's card saved, edited then saved, dismissed and shown again;
 * Save to memory… on a bubble; New; Edit; Forget and Restore. Each runs
 * behind the session-operation gate, posts a snapshot, and leaves a receipt
 * every participant receives. *Alice*, made-up ids.
 */

import { MessageType, type WorkshopMemoryDraft, type WorkshopTurn } from '@messages';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { MEMORY } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { projectWorkshopRoomTurns } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const BODY_SENTINEL = 'BODY-ONLY-IN-THE-FILE';

describe('Workshop routes — project memory writes', () => {
  let harness: WorkshopRouteTestHarness;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const results = () => harness.posted(MessageType.WORKSHOP_MEMORY_WRITE_RESULT).map((entry) => entry.payload);
  const memoryFiles = () => [...harness.memory.fileSystem.files.keys()].filter((file) => file.startsWith(MEMORY) && file.endsWith('.md'));
  const ledger = () => harness.session.readRoomLedger();
  const receipts = () => ledger().filter((turn) => turn.projectMemoryReceipt);
  const snapshots = () => harness.posted(MessageType.WORKSHOP_SESSION_STATE).length;

  /** The host replies with prose and a valid trailer; the reply carries a pending card. */
  async function cardedReply(frame = memoryFrame({ body: BODY_SENTINEL })): Promise<WorkshopTurn> {
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`Good.\n\n${frame}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'So the watch runs backward?' });
    const reply = ledger().find((turn) => turn.memoryProposal);
    expect(reply?.memoryProposal?.state).toBe('pending');
    expect(reply?.content).toBe('Good.');
    return reply!;
  }

  const draft = (changes: Partial<WorkshopMemoryDraft> = {}): WorkshopMemoryDraft => ({
    title: 'Tea is served at six',
    kind: 'decision',
    summary: 'The Hatter\'s table stays set for six o\'clock tea.',
    body: 'Every scene that visits the table keeps it.',
    supersedes: [],
    pinned: false,
    ...changes
  });

  beforeEach(async () => {
    harness = createWorkshopRouteTestHarness();
    await harness.pin();
  });

  it('Save writes a file and a receipt, settles the card, and posts a snapshot', async () => {
    const reply = await cardedReply();
    const before = snapshots();

    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r1', turnId: reply.id, action: 'save' });

    expect(memoryFiles()).toHaveLength(1);
    const [result] = results();
    expect(result).toMatchObject({ requestId: 'r1', ok: true, memoryId: expect.stringMatching(/^mem-[0-9a-f]{6}$/) });
    const card = ledger().find((turn) => turn.id === reply.id)!.memoryProposal!;
    expect(card).toMatchObject({ state: 'saved', memoryId: result.memoryId });
    expect(receipts()).toHaveLength(1);
    expect(receipts()[0]).toMatchObject({
      artifact: 'memory_receipt',
      content: `Saved to project memory: The Rabbit's watch runs backward (${result.memoryId}).`,
      projectMemoryReceipt: { action: 'saved', memoryId: result.memoryId, by: 'writer', proposedBy: 'jill' }
    });
    expect(snapshots()).toBeGreaterThan(before);
    expect(harness.persistence.markDirty).toHaveBeenCalledWith('project memory receipt');

    const saved = await harness.memory.store.read(result.memoryId);
    expect(saved).toMatchObject({
      kind: 'memory',
      entry: { memory: { origin: 'proposed', proposedBy: 'jill', sourceSession: 'live-room-0001' } }
    });
    const turns = saved.kind === 'memory' ? saved.entry.memory.sourceTurns : [];
    expect(turns.at(-1)).toBe(reply.id);
    expect(turns[0]).toMatch(/^turn-\d+-user-/);
  });

  it('the receipt is room history for every participant, and its line is never the memory\'s body', async () => {
    const reply = await cardedReply();
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r1', turnId: reply.id, action: 'save' });
    const receipt = receipts()[0];

    const forGuest = projectWorkshopRoomTurns(ledger(), { kind: 'personaGuest', personaId: 'margot' });
    const forHost = projectWorkshopRoomTurns(ledger(), { kind: 'host' });
    expect(forGuest.map((turn) => turn.id)).toContain(receipt.id);
    expect(forHost.map((turn) => turn.id)).toContain(receipt.id);
    expect(JSON.stringify(receipt)).not.toContain(BODY_SENTINEL);
  });

  it('Edit then Save writes the sheet\'s version', async () => {
    const reply = await cardedReply();
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, {
      requestId: 'r2', turnId: reply.id, action: 'save', edited: draft({ title: 'The watch runs backward, always' })
    });
    const [result] = results();
    expect(result.ok).toBe(true);
    const saved = await harness.memory.store.read(result.memoryId);
    expect(saved.kind === 'memory' && saved.entry.memory.title).toBe('The watch runs backward, always');
    expect(receipts()[0].projectMemoryReceipt?.title).toBe('The watch runs backward, always');
  });

  it('two Saves of one card at once (Edit → Save, Escape, Save) write one file and one receipt, and both are answered (PR #200 F-05)', async () => {
    const reply = await cardedReply();
    await Promise.all([
      route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, {
        requestId: 'r-edit', turnId: reply.id, action: 'save', edited: draft({ title: 'The watch runs backward, always' })
      }),
      route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r-card', turnId: reply.id, action: 'save' })
    ]);

    expect(memoryFiles()).toHaveLength(1);
    expect(receipts()).toHaveLength(1);
    const byId = Object.fromEntries(results().map((result) => [result.requestId, result]));
    expect(byId['r-edit']).toMatchObject({ ok: true });
    expect(byId['r-card']).toMatchObject({ ok: true, memoryId: byId['r-edit'].memoryId });
    expect(ledger().find((turn) => turn.id === reply.id)?.memoryProposal).toMatchObject({ state: 'saved', memoryId: byId['r-edit'].memoryId });
  });

  it('a Dismiss sent while the card saves waits it out, and is refused once it is saved (PR #200 F-05)', async () => {
    const reply = await cardedReply();
    await Promise.all([
      route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r-save', turnId: reply.id, action: 'save' }),
      route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r-dismiss', turnId: reply.id, action: 'dismiss' })
    ]);
    const byId = Object.fromEntries(results().map((result) => [result.requestId, result]));
    expect(byId['r-save'].ok).toBe(true);
    expect(byId['r-dismiss'].ok).toBe(false);
    expect(ledger().find((turn) => turn.id === reply.id)?.memoryProposal?.state).toBe('saved');
  });

  it('Dismiss writes nothing, and Show it again brings the card back', async () => {
    const reply = await cardedReply();
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r3', turnId: reply.id, action: 'dismiss' });
    expect(ledger().find((turn) => turn.id === reply.id)?.memoryProposal?.state).toBe('dismissed');
    expect(memoryFiles()).toEqual([]);
    expect(receipts()).toEqual([]);

    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r4', turnId: reply.id, action: 'reopen' });
    expect(ledger().find((turn) => turn.id === reply.id)?.memoryProposal?.state).toBe('pending');
    expect(results().map((result) => result.ok)).toEqual([true, true]);
  });

  it('every write waits behind the session-operation gate, and answers its request', async () => {
    const reply = await cardedReply();
    (harness.persistence.isSessionOperationPending as jest.Mock).mockReturnValue(true);
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r5', turnId: reply.id, action: 'save' });
    await route(MessageType.WORKSHOP_MEMORY_CREATE, { requestId: 'r6', draft: draft() });
    await route(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, { requestId: 'r7', turnId: reply.id, draft: draft() });
    await route(MessageType.WORKSHOP_MEMORY_UPDATE, { requestId: 'r8', memoryId: 'mem-7f3c2a', patch: draft() });
    await route(MessageType.WORKSHOP_MEMORY_FORGET, { requestId: 'r9', memoryId: 'mem-7f3c2a', action: 'forget' });
    expect(results().map(({ requestId, ok }) => [requestId, ok])).toEqual([
      ['r5', false], ['r6', false], ['r7', false], ['r8', false], ['r9', false]
    ]);
    expect(memoryFiles()).toEqual([]);
    expect(ledger().find((turn) => turn.id === reply.id)?.memoryProposal?.state).toBe('pending');
  });

  it('a card stays saveable with memory turned off: the writer acts (D8)', async () => {
    const reply = await cardedReply();
    harness.memory.state.mode = 'off';
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r1', turnId: reply.id, action: 'save' });
    expect(results()[0].ok).toBe(true);
    expect(memoryFiles()).toHaveLength(1);
  });

  it('a reply with memory off shows no card', async () => {
    harness.memory.state.mode = 'off';
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`Good.\n\n${memoryFrame()}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'So the watch runs backward?' });
    expect(ledger().some((turn) => turn.memoryProposal)).toBe(false);
    expect(ledger().at(-1)?.content).toBe('Good.');
  });

  it('Save to memory… saves an eligible bubble as the writer\'s own, with the turn as its source', async () => {
    const reply = await cardedReply();
    await route(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, { requestId: 's1', turnId: reply.id, draft: draft() });
    const [result] = results();
    const saved = await harness.memory.store.read(result.memoryId);
    expect(saved).toMatchObject({ kind: 'memory', entry: { memory: { origin: 'writer', sourceTurns: [reply.id], sourceSession: 'live-room-0001' } } });
    expect(receipts()[0].projectMemoryReceipt).toMatchObject({ action: 'saved', by: 'writer' });
    expect(receipts()[0].projectMemoryReceipt?.proposedBy).toBeUndefined();

    const divider = ledger().find((turn) => turn.kind === 'divider')!;
    await route(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, { requestId: 's2', turnId: divider.id, draft: draft() });
    expect(results()[1]).toMatchObject({ requestId: 's2', ok: false, error: 'That message can\'t be saved to memory.' });
  });

  it('New, Edit, Forget and Restore each leave a receipt; a load-in-full toggle alone leaves none', async () => {
    await route(MessageType.WORKSHOP_MEMORY_CREATE, { requestId: 'n1', draft: draft() });
    const id = results()[0].memoryId as string;
    await route(MessageType.WORKSHOP_MEMORY_UPDATE, { requestId: 'n2', memoryId: id, patch: draft({ pinned: true }) });
    await route(MessageType.WORKSHOP_MEMORY_UPDATE, { requestId: 'n3', memoryId: id, patch: draft({ pinned: true, title: 'Tea is at six, always' }) });
    await route(MessageType.WORKSHOP_MEMORY_FORGET, { requestId: 'n4', memoryId: id, action: 'forget' });
    await route(MessageType.WORKSHOP_MEMORY_FORGET, { requestId: 'n5', memoryId: id, action: 'restore' });

    expect(results().every((result) => result.ok)).toBe(true);
    expect(receipts().map((turn) => turn.projectMemoryReceipt?.action)).toEqual(['saved', 'updated', 'forgotten', 'restored']);
    expect(receipts()[2].content).toBe(`Forgotten from project memory: Tea is at six, always (${id}). It's archived, not deleted.`);
  });

  it('refuses a draft the sheet would refuse, writing nothing', async () => {
    await route(MessageType.WORKSHOP_MEMORY_CREATE, { requestId: 'b1', draft: draft({ title: '' }) });
    await route(MessageType.WORKSHOP_MEMORY_CREATE, { requestId: 'b2', draft: draft({ summary: 'two\nlines' }) });
    expect(results()).toEqual([
      { requestId: 'b1', ok: false, error: 'A memory needs a title.' },
      { requestId: 'b2', ok: false, error: 'A memory\'s summary is one line.' }
    ]);
    expect(memoryFiles()).toEqual([]);
  });

  it('answers the sheet\'s reads: a memory\'s fields, and the host\'s pinned estimate', async () => {
    await route(MessageType.WORKSHOP_MEMORY_CREATE, { requestId: 'n1', draft: draft() });
    const id = results()[0].memoryId as string;
    await route(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT, { requestId: 'e1', memoryId: id });
    expect(harness.posted(MessageType.WORKSHOP_MEMORY_EDIT_DATA)[0].payload).toMatchObject({
      requestId: 'e1', memoryId: id, draft: { title: 'Tea is served at six', body: 'Every scene that visits the table keeps it.', pinned: false }
    });
    await route(MessageType.WORKSHOP_MEMORY_ESTIMATE, { requestId: 'x1', memoryId: id, draft: draft({ pinned: true }) });
    expect(harness.posted(MessageType.WORKSHOP_MEMORY_ESTIMATE_RESULT)[0].payload).toMatchObject({
      requestId: 'x1', estimate: { budgetTokens: 5_000, refused: false }
    });
  });

  it('logs ids and reasons, never the memory\'s text', async () => {
    const reply = await cardedReply();
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r1', turnId: reply.id, action: 'save' });
    const lines = (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n')
      + harness.memory.lines.join('\n');
    expect(lines).not.toContain(BODY_SENTINEL);
    expect(lines).not.toContain('The Rabbit\'s watch runs backward');
  });
});
