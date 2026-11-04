/**
 * Update notes (ADR 2026-11-04 D14, D8), through the real persona
 * capability, library, store and session: each conversation turn begins a
 * writer message, builds its first message or follow-up as the engine
 * does, and commits its reply, so the record stands as it would in a room.
 * *Alice*, with made-up ids.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { claimOf } from '@/__tests__/infrastructure/storage/projectMemoryStoreHost';
import { libraryHost, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';

/** A host room over `host`'s folder; `say` runs one writer message to the host and returns what the model received. */
function room(host: ReturnType<typeof libraryHost>) {
  const session = new WorkshopSessionService(() => Date.parse('2026-11-04T10:00:00.000Z'));
  session.setSessionScope('open');
  let runs = 0;
  const started = new Set<string>();
  const say = async (text: string, guest?: 'cliff'): Promise<string> => {
    const requestId = `${guest ?? 'host'}-${++runs}`;
    if (guest && !started.has(guest)) {
      session.beginPersonaGuestJoin(guest, requestId, text);
    } else if (guest) {
      session.beginPersonaGuestMessage(guest, requestId, text);
    } else {
      session.beginPersonaMessage(requestId, text);
    }
    const capability = new WorkshopPersonaCapabilityFactory(
      {} as DictionaryService,
      {} as WorkshopAnalysisSidePass,
      { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
      session,
      { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() },
      {} as WorkshopTranscriptRecallPort,
      host.library
    ).create({
      requestId,
      excerptVersion: 0,
      personaId: 'jill',
      owner: guest ? { kind: 'personaGuest', personaId: guest } : { kind: 'host' },
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    const key = guest ?? 'host';
    const message = started.has(key) ? await capability.appendTurnContract(text) : await capability.appendContract(text);
    started.add(key);
    session.completeRun(requestId, 'Reply.', undefined, false, `${key}-conv`);
    return message;
  };
  return { session, say };
}

const noteOf = (message: string): string | undefined => /<project-memory-update[\s\S]*<\/project-memory-update>/.exec(message)?.[0];
const items = (note: string | undefined) => [...(note ?? '').matchAll(/<(entry|pinned|gone) id="(mem-[0-9a-f]{6})"[^>]*>([^<]*)/g)]
  .map((match) => `${match[1]}:${match[2]}${match[1] === 'gone' ? `:${match[3]}` : ''}`);

describe('update notes (ADR 2026-11-04 D14)', () => {
  it('sends nothing while nothing changed', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say } = room(host);
    expect(await say('Hello.')).toContain('<project-memory ');
    expect(noteOf(await say('Again.'))).toBeUndefined();
    expect(noteOf(await say('And again.'))).toBeUndefined();
  });

  it('tells a conversation once of a memory saved in another window, and never again', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say } = room(host);
    await say('Hello.');
    host.put(writerMemory({ id: 'mem-0d0d0d', title: 'Alice grows twice', updated: '2026-11-04T08:00:00Z' }));
    const note = noteOf(await say('Anything new?'));
    expect(note).toMatch(/^<project-memory-update note="Changes to this project's notes since this conversation last saw them\./);
    expect(items(note)).toEqual(['entry:mem-0d0d0d']);
    expect(noteOf(await say('And now?'))).toBeUndefined();
  });

  it('catches a hand edit that leaves `updated` alone, and a pinned body arrives whole', async () => {
    const host = libraryHost();
    const file = host.put(writerMemory({ pinned: true, body: projectMemoryBody('Structure before line edits.') }));
    host.put(writerMemory({ id: 'mem-1a9e04', title: 'Second' }));
    const { say } = room(host);
    await say('Hello.');
    host.fileSystem.files.delete(file);
    host.put(writerMemory({ pinned: true, body: projectMemoryBody('Structure before line edits, always.') }));
    const note = noteOf(await say('Anything new?'));
    expect(items(note)).toEqual(['pinned:mem-7f3c2a']);
    expect(note).toContain('>Structure before line edits, always.</pinned>');
  });

  it('says why a memory is no longer in effect: archived, superseded, or gone from the folder', async () => {
    const host = libraryHost();
    const archived = host.put(writerMemory({ id: 'mem-00000a', title: 'To archive' }));
    host.put(writerMemory({ id: 'mem-00000b', title: 'To supersede' }));
    const deleted = host.put(writerMemory({ id: 'mem-00000c', title: 'To delete' }));
    const { say } = room(host);
    await say('Hello.');
    host.fileSystem.files.delete(archived);
    host.put(writerMemory({ id: 'mem-00000a', title: 'To archive', status: 'archived' }));
    host.put(writerMemory({ id: 'mem-00000d', title: 'Replaces b', supersedes: ['mem-00000b'], updated: '2026-11-04T08:00:00Z' }));
    host.fileSystem.files.delete(deleted);

    expect(items(noteOf(await say('Anything new?')))).toEqual([
      'entry:mem-00000d',
      'gone:mem-00000a:No longer in effect: archived.',
      'gone:mem-00000b:No longer in effect: superseded by mem-00000d.',
      'gone:mem-00000c:No longer in effect: it is no longer among this project\'s notes.'
    ]);
  });

  it('never calls a memory gone while another window holds it under a live claim (PR #194 N-02)', async () => {
    const host = libraryHost();
    const file = host.put(writerMemory());
    const { say } = room(host);
    await say('Hello.');
    const bytes = host.fileSystem.files.get(file)!;
    host.fileSystem.files.delete(file);
    host.fileSystem.files.set(claimOf(file.split('/').pop()!, Date.parse('2026-11-04T09:29:50Z'), 'other'), bytes);
    expect(noteOf(await say('Anything new?'))).toBeUndefined();
  });

  it('is only the count line past the budget, records the whole set, and never repeats it', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say, session } = room(host);
    await say('Hello.');
    // Three pinned bodies near the body bound: together past pinnedTokens.
    for (const id of ['mem-0e0e01', 'mem-0e0e02', 'mem-0e0e03']) {
      host.put(writerMemory({ id, pinned: true, body: projectMemoryBody('teatime '.repeat(980)) }));
    }
    const note = noteOf(await say('Anything new?'));
    expect(note).toMatch(/ count="3">3 memories changed since this conversation last saw them; call memory\.catalog\.<\/project-memory-update>$/);
    expect(note).not.toContain('teatime');
    expect(noteOf(await say('And now?'))).toBeUndefined();
    const [, reply] = session.readRoomLedger().filter((turn) => turn.participant === 'host');
    expect(reply.projectMemoryDelivery?.[0]).toMatchObject({ kind: 'note' });
    expect(reply.projectMemoryDelivery?.[0].memories.map(({ id }) => id)).toEqual(['mem-0e0e01', 'mem-0e0e02', 'mem-0e0e03', 'mem-7f3c2a']);
  });

  it('sends no note, and writes no record, while the folder cannot be listed; the next message catches up', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say } = room(host);
    await say('Hello.');
    host.put(writerMemory({ id: 'mem-0d0d0d', title: 'New' }));
    const failing = jest.spyOn(host.fileSystem, 'readDirectory').mockRejectedValueOnce(new Error('EACCES'));
    expect(noteOf(await say('Anything new?'))).toBeUndefined();
    failing.mockRestore();
    expect(items(noteOf(await say('Now?')))).toEqual(['entry:mem-0d0d0d']);
  });
});

describe('each conversation is told on its own record', () => {
  it('a guest who joins after a change gets it in its frame; a later change reaches host and guest once each', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const { say } = room(host);
    await say('Hello.');
    host.put(writerMemory({ id: 'mem-0d0d0d', title: 'Before the join', updated: '2026-11-04T08:00:00Z' }));
    expect(await say('Join us.', 'cliff')).toContain('<entry id="mem-0d0d0d"');
    host.put(writerMemory({ id: 'mem-0e0e0e', title: 'After the join', updated: '2026-11-04T09:00:00Z' }));

    expect(items(noteOf(await say('Host, anything new?')))).toEqual(['entry:mem-0e0e0e', 'entry:mem-0d0d0d']);
    expect(items(noteOf(await say('Cliff, anything new?', 'cliff')))).toEqual(['entry:mem-0e0e0e']);
    expect(noteOf(await say('Host again.'))).toBeUndefined();
    expect(noteOf(await say('Cliff again.', 'cliff'))).toBeUndefined();
  });
});

describe('mid-room switches (ADR 2026-11-04 D8)', () => {
  it('Off → on sends the whole catalog as a note; on → off sends nothing and keeps the record; on again sends only what changed', async () => {
    const host = libraryHost({ mode: 'off' });
    host.put(writerMemory());
    host.put(writerMemory({ id: 'mem-1a9e04', title: 'Pinned', pinned: true }));
    const { say, session } = room(host);
    expect(await say('Hello.')).not.toContain('<project-memory');
    expect(session.readRoomLedger().some((turn) => turn.projectMemoryDelivery)).toBe(false);

    host.state.mode = 'ask';
    expect(items(noteOf(await say('Memory is on now.')))).toEqual(['pinned:mem-1a9e04', 'entry:mem-7f3c2a']);

    host.state.mode = 'off';
    host.put(writerMemory({ id: 'mem-0d0d0d', title: 'Saved while off' }));
    expect(noteOf(await say('Memory is off now.'))).toBeUndefined();

    host.state.mode = 'auto';
    expect(items(noteOf(await say('On again.')))).toEqual(['entry:mem-0d0d0d']);
  });

  it('an empty folder at the start still records a frame, so the first memory saved is one entry', async () => {
    const host = libraryHost();
    const { say } = room(host);
    expect(await say('Hello.')).not.toContain('<project-memory');
    host.put(writerMemory());
    expect(items(noteOf(await say('Now?')))).toEqual(['entry:mem-7f3c2a']);
  });
});
