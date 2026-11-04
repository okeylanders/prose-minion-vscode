/**
 * Receipts in the delivered view (ADR 2026-11-04 D7, D14; epic Slice 3's
 * fold), through the real persona capability, library, store, session and
 * room delivery: each conversation turn prepares its room catch-up, builds
 * its message as the engine does, commits its reply, then acknowledges the
 * delivery, as the room handler does. A save in the room appends its receipt
 * as the memory handler does. *Alice*, made-up ids.
 *
 * - A save in this room never comes back as an update note, to the host or
 *   to a guest, whether the receipt reached it before or in the same
 *   delivery.
 * - A receipt counts only once a conversation's own delivery reaches it: one
 *   guest's reading it never counts for another.
 * - A re-invited guest starts from its own frame, never its earlier
 *   membership's receipts.
 * - A receipt is its own turn: Rewind and Branch that cut it cut its effect.
 * - Past the record's bound, a receipt beside a digest explains a save, and
 *   nothing else is hidden.
 * - The receipt's version is exactly the listing's (2b's ProjectMemoryVersion).
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { WorkshopRoomDeliveryService, workshopRoomDeliveredThrough } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import type { WorkshopMemoryDraft, WorkshopTurn } from '@messages';
import { projectMemoryDeliveredView } from '@/application/services/workshop/memory/ProjectMemoryDeliveredView';
import { renderProjectMemoryUpdateNote } from '@/application/services/workshop/memory/ProjectMemoryUpdateNote';
import { projectMemoryVersion } from '@/application/services/workshop/memory/ProjectMemoryVersion';
import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { workshopProjectMemorySetDigest } from '@/application/services/workshop/session/WorkshopProjectMemoryDeliveryRecords';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { libraryHost, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

type Guest = 'cliff' | 'margot';

const draft = (title: string): WorkshopMemoryDraft => ({
  title, kind: 'canon', summary: `${title}: settled at the tea party.`, body: 'Alice noticed first.', supersedes: [], pinned: false
});

/** A room over `host`'s folder, with real room delivery; `say` returns what the model received. */
function room(host: ReturnType<typeof libraryHost>) {
  const session = new WorkshopSessionService(() => Date.parse('2026-11-04T10:00:00.000Z'));
  session.setSessionScope('open');
  const delivery = new WorkshopRoomDeliveryService(session);
  let runs = 0;
  const started = new Set<string>();
  const factory = new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService,
    {} as WorkshopAnalysisSidePass,
    { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
    session,
    { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() },
    {} as WorkshopTranscriptRecallPort,
    host.library
  );
  const say = async (text: string, guest?: Guest): Promise<string> => {
    const key = guest ?? 'host';
    const requestId = `${key}-${++runs}`;
    const reader: WorkshopCapabilityPrincipal = guest ? { kind: 'personaGuest', personaId: guest } : { kind: 'host' };
    const joining = guest !== undefined && !started.has(key);
    if (joining) {
      session.beginPersonaGuestJoin(guest, requestId, text);
    } else if (guest) {
      session.beginPersonaGuestMessage(guest, requestId, text);
    } else {
      session.beginPersonaMessage(requestId, text);
    }
    // A joining guest gets a join snapshot, not a catch-up; every later turn prepares one.
    const prepared = joining ? undefined : delivery.prepare(reader);
    const capability = factory.create({
      requestId,
      excerptVersion: 0,
      personaId: guest ?? 'jill',
      owner: reader,
      roomDeliveredThrough: workshopRoomDeliveredThrough(prepared),
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    const message = started.has(key) ? await capability.appendTurnContract(text) : await capability.appendContract(text);
    started.add(key);
    session.completeRun(requestId, 'Reply.', undefined, false, `${key}-conv`);
    if (prepared) {
      delivery.commit(prepared);
    }
    return message;
  };
  /** The writer saves a memory in this room: the file, then its receipt, as the memory handler does. */
  const save = async (title: string): Promise<WorkshopTurn> => {
    const written = await host.library.save(draft(title), { origin: 'writer', sourceTurns: [] });
    if (written.kind !== 'written') {
      throw new Error(`save refused: ${written.reason}`);
    }
    return session.appendMemoryReceipt({
      action: 'saved', memoryId: written.memory.id, title: written.memory.title, version: written.version, by: 'writer'
    });
  };
  const forget = async (id: string): Promise<WorkshopTurn> => {
    const written = await host.library.forget(id);
    if (written.kind !== 'written') {
      throw new Error(`forget refused: ${written.reason}`);
    }
    return session.appendMemoryReceipt({
      action: 'forgotten', memoryId: id, title: written.memory.title, version: written.version, by: 'writer'
    });
  };
  const dismiss = (guest: Guest): void => {
    session.dismissPersonaGuest(guest);
    started.delete(guest);
  };
  return { session, say, save, forget, dismiss };
}

const noteOf = (message: string): string | undefined => /<project-memory-update[\s\S]*<\/project-memory-update>/.exec(message)?.[0];

describe('receipts in the delivered view (ADR 2026-11-04 D7, D14)', () => {
  it('a save in this room never comes back as a note to the host', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say, save } = room(host);
    expect(await say('Hello.')).toContain('<project-memory ');

    await save('The watch runs backward');
    // The receipt rides this message's catch-up, so the note owes nothing for it.
    expect(noteOf(await say('And then?'))).toBeUndefined();
    expect(noteOf(await say('Anything new?'))).toBeUndefined();
  });

  it('a receipt one guest has read is still owed to another, and reaches each once', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say, save, session } = room(host);
    await say('Hello.');
    await say('Cliff, join us.', 'cliff');
    await say('Margot, join us.', 'margot');

    const receipt = await save('The watch runs backward');
    // Cliff's next delivery hands it over; Margot's offset hasn't reached it.
    expect(noteOf(await say('Cliff?', 'cliff'))).toBeUndefined();
    const ledger = session.readRoomLedger();
    const cliff = projectMemoryDeliveredView(ledger, { kind: 'personaGuest', personaId: 'cliff' }, {
      deliveredThroughTurnId: session.readRoomDeliveryState({ kind: 'personaGuest', personaId: 'cliff' }).lastSeenRoomTurnId
    });
    const margot = projectMemoryDeliveredView(ledger, { kind: 'personaGuest', personaId: 'margot' }, {
      deliveredThroughTurnId: session.readRoomDeliveryState({ kind: 'personaGuest', personaId: 'margot' }).lastSeenRoomTurnId
    });
    expect(cliff.memories.get(receipt.projectMemoryReceipt!.memoryId)).toBe(receipt.projectMemoryReceipt!.version);
    expect(margot.memories.has(receipt.projectMemoryReceipt!.memoryId)).toBe(false);

    // Margot gets it as the receipt in her catch-up, and no note for it.
    expect(noteOf(await say('Margot?', 'margot'))).toBeUndefined();
    expect(noteOf(await say('Margot, again?', 'margot'))).toBeUndefined();
  });

  it('a receipt counts only once delivery reaches it: without that, the change is owed as a note', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say, save, session } = room(host);
    await say('Hello.');
    const receipt = await save('The watch runs backward');
    const ledger = session.readRoomLedger();
    const before = projectMemoryDeliveredView(ledger, { kind: 'host' });
    expect(before.memories.has(receipt.projectMemoryReceipt!.memoryId)).toBe(false);
    const through = projectMemoryDeliveredView(ledger, { kind: 'host' }, { deliveredThroughTurnId: receipt.id });
    expect(through.memories.get(receipt.projectMemoryReceipt!.memoryId)).toBe(receipt.projectMemoryReceipt!.version);
  });

  it('a Forget\'s receipt tells the conversation the memory is gone, so no note repeats it', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say, forget } = room(host);
    await say('Hello.');
    await forget('mem-7f3c2a');
    expect(noteOf(await say('And then?'))).toBeUndefined();
  });

  it('a re-invited guest starts from its own frame, never its earlier membership\'s receipts', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say, save, dismiss, session } = room(host);
    await say('Hello.');
    await say('Cliff, join us.', 'cliff');
    const receipt = await save('The watch runs backward');
    await say('Cliff?', 'cliff');
    dismiss('cliff');

    // Saved while Cliff was away: his new membership's frame holds it, and no earlier receipt is replayed.
    await host.library.edit(receipt.projectMemoryReceipt!.memoryId, { ...draft('The watch runs backward, always'), pinned: false });
    const frame = await say('Cliff, back again.', 'cliff');
    expect(frame).toContain('The watch runs backward, always');
    expect(noteOf(await say('Cliff?', 'cliff'))).toBeUndefined();
    const view = projectMemoryDeliveredView(session.readRoomLedger(), { kind: 'personaGuest', personaId: 'cliff' });
    const listing = await host.store.list();
    const current = listing.kind === 'listed' ? listProjectMemories(listing.memories) : [];
    expect(view.memories.get(receipt.projectMemoryReceipt!.memoryId))
      .toBe(current.find((listed) => listed.memory.id === receipt.projectMemoryReceipt!.memoryId)?.version);
  });

  it('Rewind and Branch that cut a receipt cut its effect; ones that keep it keep it', async () => {
    const scripted = new ScriptedWorkshopRoom().start();
    const first = scripted.hostMessage('What did we settle?');
    const receipt = scripted.session.appendMemoryReceipt({
      action: 'saved', memoryId: 'mem-7f3c2a', title: 'The watch runs backward', version: 'bbbbbbbbbbbb', by: 'writer'
    });
    const second = scripted.hostMessage('And then?');
    const viewOf = (turns: readonly WorkshopTurn[]) =>
      projectMemoryDeliveredView(turns, { kind: 'host' }, { deliveredThroughTurnId: turns.at(-1)?.id }).memories.get('mem-7f3c2a');
    expect(viewOf(scripted.session.readRoomLedger())).toBe('bbbbbbbbbbbb');

    const cutBefore = rewindWorkshopSession({
      workshop: scripted.session.exportCommittedState(), conversations: scripted.archive(), cut: { kind: 'afterTurn', turnId: first.id }
    });
    expect(cutBefore.workshop.turns.some((turn) => turn.id === receipt.id)).toBe(false);
    expect(viewOf(cutBefore.workshop.turns)).toBeUndefined();
    const keptAfter = rewindWorkshopSession({
      workshop: scripted.session.exportCommittedState(), conversations: scripted.archive(), cut: { kind: 'afterTurn', turnId: second.id }
    });
    expect(viewOf(keptAfter.workshop.turns)).toBe('bbbbbbbbbbbb');

    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('receipted', scripted));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('receipted');
    const branched = await harness.coordinator.branchFrom({ kind: 'afterTurn', turnId: first.id });
    expect(viewOf((await harness.store.readNamed(branched.branch.sessionId))!.workshop.turns)).toBeUndefined();
    expect(viewOf((await harness.store.readNamed('receipted'))!.workshop.turns)).toBe('bbbbbbbbbbbb');
  });

  it('the receipt\'s version is exactly the listing\'s, 2b\'s ProjectMemoryVersion', async () => {
    const host = libraryHost();
    const { save } = room(host);
    const receipt = (await save('The watch runs backward')).projectMemoryReceipt!;
    const listing = await host.store.list();
    const listed = listing.kind === 'listed' ? listProjectMemories(listing.memories).find((entry) => entry.memory.id === receipt.memoryId) : undefined;
    expect(receipt.version).toBe(listed!.version);
    expect(receipt.version).toBe(projectMemoryVersion(listed!.memory, false));
  });
});

describe('a receipt beside a digest (PR #198 F-03)', () => {
  const entry = (n: number, version = 'aaaaaaaaaaaa') => ({ id: `mem-${n.toString(16).padStart(6, '0')}`, version });
  const BIG = Array.from({ length: 4_100 }, (_, n) => entry(n + 1));
  const setOf = (snapshot: Array<{ id: string; version: string }>) => ({
    memories: snapshot.map(({ id, version }) => ({
      memory: writerMemory({ id }), superseded: false, supersededBy: [], busy: false, version
    })),
    unreadable: 0,
    conflicts: 0
  });
  const viewWith = (receipted: Array<[string, string | null]>) => ({
    memories: new Map<string, string>(),
    recorded: true,
    digest: workshopProjectMemorySetDigest(BIG),
    receipted: new Map(receipted)
  });

  it('explains a save: the set without the saved memory is the digest, so no note', () => {
    const saved = entry(0xfffff0, 'bbbbbbbbbbbb');
    const update = renderProjectMemoryUpdateNote(viewWith([[saved.id, saved.version]]), setOf([...BIG, saved]));
    expect(update.text).toBeUndefined();
  });

  it('never hides another change behind it: a save plus an edit is the count line', () => {
    const saved = entry(0xfffff0, 'bbbbbbbbbbbb');
    const edited = [...BIG.slice(1), entry(1, 'cccccccccccc')];
    expect(renderProjectMemoryUpdateNote(viewWith([[saved.id, saved.version]]), setOf([...edited, saved])).text)
      .toContain('call memory.catalog');
  });

  it('never trusts a receipt the memory has moved past: the count line', () => {
    const saved = entry(0xfffff0, 'bbbbbbbbbbbb');
    expect(renderProjectMemoryUpdateNote(viewWith([[saved.id, saved.version]]), setOf([...BIG, { ...saved, version: 'dddddddddddd' }])).text)
      .toContain('call memory.catalog');
  });

  it('an edit or a Forget past the bound is the count line once (a digest keeps no versions to compare)', () => {
    const edited = [...BIG.slice(1), entry(1, 'cccccccccccc')];
    expect(renderProjectMemoryUpdateNote(viewWith([[entry(1).id, 'cccccccccccc']]), setOf(edited)).text).toContain('call memory.catalog');
    expect(renderProjectMemoryUpdateNote(viewWith([[entry(1).id, null]]), setOf(BIG.slice(1))).text).toContain('call memory.catalog');
  });

  it('the fold keeps the digest and carries the receipts beside it, cleared by the next snapshot', () => {
    const turns = [
      { id: 'turn-2-assistant-1', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message', content: '', timestamp: 1, excerptVersion: 0,
        projectMemoryDelivery: [{ participant: { kind: 'host' }, kind: 'frame', memories: [], digest: workshopProjectMemorySetDigest(BIG) }] },
      { id: 'turn-3-system-2', role: 'system', kind: 'divider', participant: 'session', artifact: 'memory_receipt', content: '', timestamp: 2, excerptVersion: 0,
        projectMemoryReceipt: { action: 'saved', memoryId: 'mem-fffff0', title: 'T', version: 'bbbbbbbbbbbb', by: 'writer' } }
    ] as WorkshopTurn[];
    const view = projectMemoryDeliveredView(turns, { kind: 'host' }, { deliveredThroughTurnId: 'turn-3-system-2' });
    expect(view.digest).toEqual(workshopProjectMemorySetDigest(BIG));
    expect([...view.receipted!]).toEqual([['mem-fffff0', 'bbbbbbbbbbbb']]);
  });
});
