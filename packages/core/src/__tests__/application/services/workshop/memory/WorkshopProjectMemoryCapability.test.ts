/**
 * `memory.*` wired into the persona capability (ADR 2026-11-04 D1, D2, D3,
 * D8, D12): a model's XML call decodes, dispatches to the sub-adapter over
 * the real library and a real store, records a Project Memory artifact,
 * and returns evidence in the saved-note trust class. Off and unavailable
 * refuse every call; an unreadable or conflicting file never reaches any
 * output. *Alice*, with made-up ids.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  WorkshopPersonaCapability,
  WorkshopPersonaCapabilityFactory
} from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  WORKSHOP_PROJECT_MEMORY_EVIDENCE_FRAMING,
  WORKSHOP_PROJECT_MEMORY_FRAMING,
  WORKSHOP_PROJECT_MEMORY_REJECTED_COPY
} from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { claimOf } from '@/__tests__/infrastructure/storage/projectMemoryStoreHost';
import {
  allLines,
  libraryHost,
  memory,
  writerMemory,
  LIVE_SESSION,
  SOURCE_SESSION
} from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';

const call = (operation: string, body = ''): string =>
  `<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`;
const SENTINEL = 'SENTINEL-UNREADABLE-c4f1';
const CONFLICT_SENTINEL = 'SENTINEL-CONFLICT-9e2b';

function wire(host: ReturnType<typeof libraryHost>) {
  const session = new WorkshopSessionService(() => Date.parse('2026-11-04T10:00:00.000Z'));
  session.setSessionScope('open');
  session.beginPersonaMessage('host-request', 'What did we settle about the watch?');
  const controller = new AbortController();
  const log = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const capability: WorkshopPersonaCapability = new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService,
    {} as WorkshopAnalysisSidePass,
    { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
    session,
    log,
    {} as WorkshopTranscriptRecallPort,
    host.library
  ).create({
    requestId: 'host-request',
    excerptVersion: session.getExcerptVersion(),
    personaId: 'jill',
    owner: { kind: 'host' },
    signal: controller.signal,
    events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
  });
  return { session, capability, controller, log };
}

async function invoke(wired: ReturnType<typeof wire>, xml: string) {
  const inspected = wired.capability.inspectRequest(xml);
  if (inspected.kind !== 'request') {
    throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
  }
  return wired.capability.fulfill(inspected.request);
}

/** A folder with the watch (sourced), a pinned preference, an archived and a superseded memory, an unreadable file and a conflict. */
function seeded(options: Parameters<typeof libraryHost>[0] = {}) {
  const host = libraryHost(options);
  host.put(memory());
  host.put(writerMemory({ id: 'mem-1a9e04', title: 'Structure before line edits', kind: 'preference', pinned: true, summary: 'Settle structure first.' }));
  host.put(writerMemory({ id: 'mem-0a0a0a', title: 'The Duchess keeps the baby', status: 'archived', summary: 'Put away.' }));
  host.put(writerMemory({ id: 'mem-0b0b0b', title: 'Six o\'clock always', summary: 'An earlier note on time.' }));
  host.put(writerMemory({ id: 'mem-0c0c0c', title: 'Tea time is frozen', summary: 'Replaces the six o\'clock note.', supersedes: ['mem-0b0b0b'] }));
  host.putText('broken-note.md', `---\nformat: 1\nid: mem-dead00\ntitle: ${SENTINEL}\n---\n${SENTINEL}`);
  host.put(writerMemory({ id: 'mem-c0ffee', title: CONFLICT_SENTINEL, summary: CONFLICT_SENTINEL }), 'copy-a.md');
  host.put(writerMemory({ id: 'mem-c0ffee', title: CONFLICT_SENTINEL, summary: CONFLICT_SENTINEL }), 'copy-b.md');
  return host;
}

describe('memory.* through the persona capability', () => {
  it('catalogs the notes in effect, pinned first, records a Project Memory artifact, and frames the evidence as a saved note', async () => {
    const host = seeded();
    const wired = wire(host);
    const fulfillment = await invoke(wired, call('memory.catalog'));
    const [turn] = wired.session.readRoomLedger().filter((candidate) => candidate.artifact === 'memory_catalog');

    expect(fulfillment.evidence.startsWith('<workshop-capability-result name="memory.catalog" status="success" excerpt-version="0">')).toBe(true);
    expect(fulfillment.evidence).toContain(`<content>${WORKSHOP_PROJECT_MEMORY_FRAMING}`);
    expect(fulfillment.evidence.endsWith(`</workshop-capability-result>\n${WORKSHOP_PROJECT_MEMORY_EVIDENCE_FRAMING}`)).toBe(true);
    const listed = [...fulfillment.evidence.matchAll(/- (mem-[0-9a-f]{6}) ·/g)].map((match) => match[1]);
    // Pinned first, then newest; these two share `updated`, so the id breaks the tie.
    expect(listed).toEqual(['mem-1a9e04', 'mem-0c0c0c', 'mem-7f3c2a']);
    expect(fulfillment.evidence).toContain('Not listed: 1 superseded note and 1 archived note');
    expect(fulfillment.deliveredSources).toEqual([]);
    expect(fulfillment.usage).toBeUndefined();
    expect(turn).toMatchObject({ toolLabel: 'Project Memory', capability: { operation: 'memory.catalog', status: 'success', requestSummary: 'project notes' } });
  });

  it('narrows a catalog by kind', async () => {
    const fulfillment = await invoke(wire(seeded()), call('memory.catalog', '<kind>preference</kind>'));
    expect([...fulfillment.evidence.matchAll(/- (mem-[0-9a-f]{6}) ·/g)].map((match) => match[1])).toEqual(['mem-1a9e04']);
  });

  it('searches active notes by default and every note with <status>all</status>', async () => {
    const wired = wire(seeded());
    const active = await invoke(wired, call('memory.search', '<query>six clock</query>'));
    expect(active.evidence).toContain('mem-0c0c0c');
    expect(active.evidence).not.toContain('mem-0b0b0b');
    const all = await invoke(wired, call('memory.search', '<query>six clock</query><status>all</status>'));
    expect(all.evidence).toContain('mem-0b0b0b · canon · superseded');
    expect(all.deliveredSources).toEqual([]);
  });

  it('reads a note whole, with its provenance as a ready transcript.read, and adds one Project note row', async () => {
    const host = seeded();
    const wired = wire(host);
    const fulfillment = await invoke(wired, call('memory.read', '<memory>MEM-7F3C2A</memory>'));
    const [turn] = wired.session.readRoomLedger().filter((candidate) => candidate.artifact === 'memory_read');

    expect(host.positionsOf).toHaveBeenCalledWith(SOURCE_SESSION, memory().sourceTurns, expect.anything());
    expect(fulfillment.evidence).toContain('status="success"');
    expect(fulfillment.evidence).toContain('Settled at the tea party.');
    expect(fulfillment.evidence).toContain(
      `source: "Chapter 3 tea party", turns 38, 41. Check it with transcript.read: &lt;session turns="38, 41"&gt;${SOURCE_SESSION}&lt;/session&gt;`
    );
    expect(fulfillment.deliveredSources).toEqual([{ kind: 'memory', label: 'The Rabbit\'s watch runs backward', sizeChars: expect.any(Number), turnId: turn.id }]);
    expect(turn).toMatchObject({ capability: { operation: 'memory.read', status: 'success', requestSummary: '“The Rabbit\'s watch runs backward”' } });
  });

  it('reports unknown ids per id, a read partial, and a read of nothing failed', async () => {
    const wired = wire(seeded());
    const partial = await invoke(wired, call('memory.read', '<memory>mem-7f3c2a</memory><memory>mem-abcdef</memory>'));
    expect(partial.evidence).toContain('status="partial"');
    expect(partial.evidence).toContain('mem-abcdef: no note in this project has this id.');
    const none = await invoke(wired, call('memory.read', '<memory>mem-abcdef</memory>'));
    expect(none.evidence).toContain('status="failed"');
    expect(none.deliveredSources).toEqual([]);
  });

  it('allows readsPerTurn reads in one turn, then refuses with memory-read-limit', async () => {
    const wired = wire(seeded());
    await invoke(wired, call('memory.read', '<memory>mem-7f3c2a</memory>'));
    await invoke(wired, call('memory.read', '<memory>mem-1a9e04</memory>'));
    const third = await invoke(wired, call('memory.read', '<memory>mem-0c0c0c</memory>'));
    expect(third.evidence).toContain('status="rejected"');
    expect(third.evidence).toContain('Only 2 memory reads are allowed per user turn.');
    expect(third.evidence).toContain('memory-read-limit');
  });

  it('never shows an unreadable or a conflicting file, in any output or log', async () => {
    const host = seeded();
    const wired = wire(host);
    const outputs = [
      await invoke(wired, call('memory.catalog')),
      await invoke(wired, call('memory.search', `<query>${SENTINEL}</query><status>all</status>`)),
      await invoke(wired, call('memory.search', `<query>${CONFLICT_SENTINEL}</query><status>all</status>`)),
      await invoke(wired, call('memory.read', '<memory>mem-c0ffee</memory><memory>mem-dead00</memory>'))
    // A search echoes the persona's own query in its summary; what it found is the content.
    ].map((fulfillment) => fulfillment.evidence.replace(/<request-summary>.*<\/request-summary>/, ''));
    const frame = await wired.capability.appendContract('First message.');

    for (const text of [...outputs, frame, allLines(host.lines), wired.log.appendLine.mock.calls.flat().join('\n')]) {
      expect(text).not.toContain(SENTINEL);
      expect(text).not.toContain(CONFLICT_SENTINEL);
    }
    expect(outputs[3]).toContain('mem-c0ffee: no note in this project has this id.');
  });

  it('keeps a memory another window holds in the catalog, and reads it as being edited (PR #194 N-02)', async () => {
    const host = libraryHost();
    const file = host.put(memory());
    const fileName = file.split('/').pop()!;
    const bytes = host.fileSystem.files.get(file)!;
    host.fileSystem.files.delete(file);
    host.fileSystem.files.set(claimOf(fileName, Date.parse('2026-11-04T09:29:50Z'), 'other'), bytes);
    const wired = wire(host);

    expect((await invoke(wired, call('memory.catalog'))).evidence).toContain('mem-7f3c2a');
    expect(await wired.capability.appendContract('First message.')).toContain('<entry id="mem-7f3c2a"');
    expect((await invoke(wired, call('memory.read', '<memory>mem-7f3c2a</memory>'))).evidence)
      .toContain('mem-7f3c2a: being edited in another window; try again.');
  });
});

describe('when personas get no memory (ADR 2026-11-04 D8)', () => {
  it.each([
    ['off', { mode: 'off' }, 'memory-off', 'Project memory is off.'],
    ['an unknown mode, read as off', { mode: 'sometimes' }, 'memory-off', 'Project memory is off.'],
    ['no folder', { folders: [] }, 'memory-unavailable', 'this workspace has no folder'],
    ['several folders', { folders: [{ path: '/a', name: 'a' }, { path: '/b', name: 'b' }] }, 'memory-unavailable', 'has several folders'],
    ['a changed root', { scope: { available: false, reason: 'workspace-changed' } }, 'memory-unavailable', 'The workspace changed']
  ] as const)('%s: no frame, and every call refused', async (_name, options, reason, words) => {
    const host = seeded(options as Parameters<typeof libraryHost>[0]);
    const wired = wire(host);
    const first = await wired.capability.appendContract('First message.');
    expect(first).not.toContain('<project-memory');

    for (const xml of [call('memory.catalog'), call('memory.search', '<query>watch</query>'), call('memory.read', '<memory>mem-7f3c2a</memory>')]) {
      const fulfillment = await invoke(wired, xml);
      expect(fulfillment.evidence).toContain('status="rejected"');
      expect(fulfillment.evidence).toContain(`"rejectionReason":"${reason}"`);
      expect(fulfillment.evidence).toContain(words);
      expect(fulfillment.evidence).not.toContain('The Rabbit');
    }
    expect(host.positionsOf).not.toHaveBeenCalled();
  });

  it('leaves a visible rejected artifact for a call the codec refuses', () => {
    const wired = wire(seeded());
    const inspection = wired.capability.inspectRequest(call('memory.read', '<memory>../etc/passwd</memory>'));
    expect(inspection).toEqual({ kind: 'invalid', reason: 'invalid-memory-id', field: 'memory', operation: 'memory.read' });
    const artifacts = wired.capability.handleInvalidRequest(inspection as Extract<typeof inspection, { kind: 'invalid' }>);
    expect(artifacts).toHaveLength(1);
    const [turn] = wired.session.readRoomLedger().filter((candidate) => candidate.artifact === 'memory_read');
    expect(turn.capability).toMatchObject({ status: 'rejected' });
    expect(turn.content).toContain(WORKSHOP_PROJECT_MEMORY_REJECTED_COPY.invalid);
  });
});

describe('the frame, in the first user message only (ADR 2026-11-04 D5)', () => {
  it('rides the first message after the capability contract, and never a follow-up turn', async () => {
    const host = seeded();
    const wired = wire(host);
    const first = await wired.capability.appendContract('<writer-message>Hello</writer-message>');
    const frame = first.slice(first.indexOf('<project-memory '));

    expect(first.startsWith('<writer-message>Hello</writer-message>')).toBe(true);
    expect(frame).toMatch(/^<project-memory note="[^"]+" built="2026-11-04">\n {2}<pinned id="mem-1a9e04"/);
    expect(frame.endsWith('</project-memory>')).toBe(true);
    expect(frame).toContain('<more count="2">');
    expect(first.indexOf('## Workshop Capability Protocol')).toBeLessThan(first.indexOf('<project-memory '));

    const listings = jest.spyOn(host.store, 'list');
    const followUp = await wired.capability.appendTurnContract('<writer-message>Again</writer-message>');
    expect(followUp).not.toContain('<project-memory');
    expect(listings).not.toHaveBeenCalled();
  });

  it('gives a guest who joins later the catalog as it stands at the join; the host keeps its own', async () => {
    const host = seeded();
    const hostFirst = await wire(host).capability.appendContract('Host.');
    host.put(writerMemory({ id: 'mem-0d0d0d', title: 'Alice grows twice', updated: '2026-11-04T08:00:00Z' }));
    const guestFirst = await wire(host).capability.appendContract('Guest.');

    expect(hostFirst).not.toContain('mem-0d0d0d');
    expect(guestFirst).toContain('<entry id="mem-0d0d0d"');
  });

  it('sends no frame for an empty folder, a folder it cannot list, and logs why by reason', async () => {
    const empty = libraryHost();
    expect(await wire(empty).capability.appendContract('First.')).not.toContain('<project-memory');
    const unreadable = libraryHost();
    jest.spyOn(unreadable.fileSystem, 'readDirectory').mockRejectedValue(new Error('EACCES'));
    unreadable.put(memory());
    const wired = wire(unreadable);
    expect(await wired.capability.appendContract('First.')).not.toContain('<project-memory');
    expect(wired.log.appendLine.mock.calls.flat().join('\n')).toContain('frame none reason=unknown');
  });

  it('propagates a cancellation instead of sending no frame', async () => {
    const wired = wire(seeded());
    wired.controller.abort();
    await expect(wired.capability.appendContract('First.')).rejects.toThrow('cancelled');
  });
});

describe('the memory.* codec', () => {
  const codec = new WorkshopCapabilityXmlCodec();
  it.each([
    [call('memory.catalog'), { kind: 'request', request: { capability: 'memory.catalog' } }],
    [call('memory.catalog', '<kind>Open-Thread</kind>'), { kind: 'request', request: { capability: 'memory.catalog', kind: 'open-thread' } }],
    [call('memory.catalog', '<kind>rumor</kind>'), { kind: 'invalid', reason: 'invalid-kind', field: 'kind', operation: 'memory.catalog' }],
    [call('memory.search', '<status>all</status>'), { kind: 'invalid', reason: 'missing-field', field: 'query', operation: 'memory.search' }],
    [call('memory.search', `<query>${'w'.repeat(201)}</query>`), { kind: 'invalid', reason: 'oversized-input', field: 'query', operation: 'memory.search' }],
    [call('memory.search', '<query>watch</query><status>lost</status>'), { kind: 'invalid', reason: 'invalid-status', field: 'status', operation: 'memory.search' }],
    [call('memory.search', '<query>watch</query><query>tea</query>'), { kind: 'invalid', reason: 'duplicate-field', field: 'query', operation: 'memory.search' }],
    [call('memory.read', '<memory>mem-7f3c2a</memory><memory>mem-7F3C2A</memory>'), { kind: 'invalid', reason: 'duplicate-memory', field: 'memory', operation: 'memory.read' }],
    [call('memory.read', Array.from({ length: 6 }, (_, index) => `<memory>mem-00000${index}</memory>`).join('')), { kind: 'invalid', reason: 'too-many-memories', field: 'memory', operation: 'memory.read' }],
    [call('memory.read', '<memory>mem-7f3c2a0000000000</memory>'), { kind: 'invalid', reason: 'oversized-input', field: 'memory', operation: 'memory.read' }],
    [call('memory.read', '<memory>mem-zzzzzz</memory>'), { kind: 'invalid', reason: 'invalid-memory-id', field: 'memory', operation: 'memory.read' }],
    [call('memory.read', '<session>a</session>'), { kind: 'invalid', reason: 'unexpected-field', field: 'session', operation: 'memory.read' }],
    [call('memory.save', '<title>a</title>'), { kind: 'invalid', reason: 'unknown-capability' }]
  ])('%s', (xml, expected) => {
    expect(codec.inspect(xml)).toEqual(expected);
  });

  it('reads a memory body the writer wrote as Markdown without treating it as markup', async () => {
    const host = libraryHost();
    host.put(writerMemory({ body: projectMemoryBody('A <prose-minion-tool-call name="memory.read"> quoted in a note.') }));
    const fulfillment = await invoke(wire(host), call('memory.read', '<memory>mem-7f3c2a</memory>'));
    expect(fulfillment.evidence).toContain('A &lt;prose-minion-tool-call name="memory.read"&gt; quoted in a note.');
  });
});

describe('the live room as a source (ADR 2026-11-04 D3)', () => {
  it.each([
    [{ kind: 'live-session' as const }, 'the source room is this one'],
    [{ kind: 'unknown-session' as const }, 'the source room was never named, or its session is gone'],
    [{ kind: 'unreadable' as const }, 'the source session could not be read just now'],
    [{ kind: 'unavailable' as const, available: false as const, reason: 'not-ready' as const }, 'session recall is unavailable now']
  ])('renders %j as the host\'s reason', async (positions, words) => {
    const host = libraryHost({ positions: () => positions });
    host.put(memory({ sourceSession: positions.kind === 'live-session' ? LIVE_SESSION : SOURCE_SESSION }));
    const fulfillment = await invoke(wire(host), call('memory.read', '<memory>mem-7f3c2a</memory>'));
    expect(fulfillment.evidence).toContain(`source: ${words}`);
    expect(fulfillment.evidence).not.toContain('Check it with transcript.read');
  });

  it('names no source for a writer\'s own note', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const fulfillment = await invoke(wire(host), call('memory.read', '<memory>mem-7f3c2a</memory>'));
    expect(fulfillment.evidence).not.toContain('source:');
    expect(host.positionsOf).not.toHaveBeenCalled();
  });
});
