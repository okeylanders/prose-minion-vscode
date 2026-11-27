/**
 * `memory.*` wired into the persona capability (ADR 2026-11-04 D1, D2, D3,
 * D8, D12): a model's XML call decodes, dispatches to the sub-adapter over
 * the real library and a real store, records a Project Memory artifact,
 * and returns evidence in the saved-note trust class. Off and unavailable
 * refuse every call; an unreadable or conflicting file never reaches any
 * output. *Alice*, with made-up ids.
 */
import { unavailableHelpReference } from '@/__tests__/application/services/workshop/help/unavailableHelpReference';
import { unavailableProjectLocations } from '@/__tests__/application/services/workshop/locations/unavailableProjectLocations';
import { unavailableFileHistory } from '@/__tests__/application/services/workshop/history/unavailableFileHistory';
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
import type { WorkshopResourceSources } from '@/application/services/workshop/WorkshopResourceCapability';
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
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { noProjectLenses } from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';

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
    { createProvider: jest.fn() } as unknown as WorkshopResourceSources,
    session,
    log,
    {} as WorkshopTranscriptRecallPort,
    host.library,
    noProjectLenses,
    unavailableHelpReference,
    unavailableFileHistory,
    unavailableProjectLocations
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

async function invoke(wired: ReturnType<typeof wire>, xml: string, window?: CapabilityContextWindow) {
  const inspected = wired.capability.inspectRequest(xml);
  if (inspected.kind !== 'request') {
    throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
  }
  return wired.capability.fulfill(inspected.request, window);
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
    const { readsPerTurn } = PROMPT_BUDGETS.workshopProjectMemory;
    const wired = wire(seeded());
    const ids = ['mem-7f3c2a', 'mem-1a9e04'];
    for (let index = 0; index < readsPerTurn; index += 1) {
      await invoke(wired, call('memory.read', `<memory>${ids[index % ids.length]}</memory>`));
    }
    const pastTheLimit = await invoke(wired, call('memory.read', '<memory>mem-0c0c0c</memory>'));
    expect(pastTheLimit.evidence).toContain('status="rejected"');
    expect(pastTheLimit.evidence).toContain(`Only ${readsPerTurn} memory reads are allowed per user turn.`);
    expect(pastTheLimit.evidence).toContain('memory-read-limit');
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

describe('fitting whole memory notes to the room left', () => {
  const window = (freeInputTokens: number): CapabilityContextWindow => ({
    contextLength: 128_000, freeInputTokens, requestTokens: 0, outputTokens: 0, headroomTokens: 0
  });
  const read = (...ids: string[]) => call('memory.read', ids.map(id => `<memory>${id}</memory>`).join(''));
  const largeId = 'mem-ffffff';
  const smallIds = ['mem-000001', 'mem-000002', 'mem-000003', 'mem-000004', 'mem-000005'];

  function notes() {
    const host = libraryHost();
    host.put(writerMemory({ id: largeId, title: 'OVERSIZE-TITLE', summary: 'OVERSIZE-SUMMARY',
      body: projectMemoryBody('OVERSIZE-BODY' + '<&>'.repeat(2_500)) }));
    smallIds.forEach((id, index) => host.put(writerMemory({ id, title: `Small ${index}`, body: projectMemoryBody(`Complete note ${index}.`) })));
    return host;
  }

  it('fits the complete escaped envelope at the exact boundary, including its summary, metadata and trust framing', async () => {
    const host = notes();
    const whole = await invoke(wire(host), read(largeId), window(120_000));
    const tokens = estimateTextTokens(whole.evidence);
    expect(whole.evidence).toContain('OVERSIZE-BODY&lt;&amp;&gt;');
    expect((await invoke(wire(host), read(largeId), window(2 * tokens))).evidence).toBe(whole.evidence);

    const wired = wire(host);
    const tooSmall = await invoke(wired, read(largeId), window(2 * tokens - 1));
    expect(tooSmall.evidence).toContain('memory-context-window');
    expect(tooSmall.evidence).toContain((tokens - 1).toLocaleString('en-US'));
    expect(tooSmall.evidence).toContain(largeId);
    expect(tooSmall.deliveredSources).toEqual([]);
    expect(JSON.stringify([tooSmall, wired.session.readRoomLedger(), wired.log.appendLine.mock.calls])).not.toMatch(/OVERSIZE-/);

    const narrower = await invoke(wired, read(...smallIds), window(6_000));
    expect(narrower.deliveredSources?.map(source => source.label)).toEqual(['Small 0', 'Small 1', 'Small 2', 'Small 3', 'Small 4']);
  });

  it('reserves room for the translated native-call notice on the wire', async () => {
    const host = notes();
    const whole = await invoke(wire(host), read(largeId), window(120_000));
    const enoughForPlainXml = window(2 * estimateTextTokens(whole.evidence));
    const wired = wire(host);
    const native = { name: 'memory.read', arguments: JSON.stringify({ memories: [largeId] }) };
    const translated = wired.capability.translateNativeToolCalls([native, native]);
    if (translated.kind !== 'translated') {
      throw new Error('expected a translated memory.read');
    }
    const result = await invoke(wired, translated.content, enoughForPlainXml);
    expect(result.evidence).toContain('memory-context-window');
    expect(result.evidence).toContain('Your reply held 1 more tool call');
    expect(result.deliveredSources).toEqual([]);
  });

  it('skips a larger first note, keeps later whole notes and the per-id refusal in order, and measures all notices', async () => {
    const wired = wire(notes());
    const ids = [largeId, smallIds[2], 'mem-abcdef', smallIds[0], smallIds[3]];
    const fitted = await invoke(wired, read(...ids), window(2_000));
    expect(fitted.evidence).toContain('status="partial"');
    expect(fitted.evidence).toContain('1,000 tokens, half the room left');
    expect(fitted.evidence).toContain(`${largeId}: did not fit`);
    expect(fitted.evidence).toContain('mem-abcdef: no note in this project has this id.');
    expect(estimateTextTokens(fitted.evidence)).toBeLessThanOrEqual(1_000);
    expect(fitted.deliveredSources?.map(source => source.label)).toEqual(['Small 2', 'Small 0', 'Small 3']);
    for (const id of [smallIds[2], smallIds[0], smallIds[3]]) {
      expect(fitted.evidence).toContain(`end of note ${id}`);
    }
    expect(JSON.stringify([fitted, wired.session.readRoomLedger(), wired.log.appendLine.mock.calls])).not.toMatch(/OVERSIZE-/);
  });

  it('keeps the missing-id outcome when every readable note is too large', async () => {
    const wired = wire(notes());
    const result = await invoke(wired, read(largeId, 'mem-abcdef'), window(1_600));
    expect(result.deliveredSources).toEqual([]);
    expect(result.evidence).toContain(`${largeId}: did not fit`);
    expect(result.evidence).toContain('mem-abcdef: no note in this project has this id.');
    expect(result.evidence).not.toMatch(/OVERSIZE-/);
    expect(estimateTextTokens(result.evidence)).toBeLessThanOrEqual(800);
  });

  it('preserves the unknown-window allowance when new model facts withhold a pending read', async () => {
    const contextLength = jest.spyOn(OpenRouterModels, 'getCachedContextLength').mockReturnValue(undefined);
    const host = libraryHost();
    const ids = smallIds.slice(0, 4);
    ids.forEach(id => host.put(writerMemory({ id, title: id, body: projectMemoryBody('<'.repeat(7_000)) })));
    const libraryRead = host.library.read.bind(host.library);
    jest.spyOn(host.library, 'read').mockImplementationOnce(async (...args) => {
      const result = await libraryRead(...args);
      // The model catalog becomes available while the first read is in flight.
      contextLength.mockReturnValue(16_384);
      return result;
    });
    const provider = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
    provider.createChatCompletion.mockResolvedValueOnce({ content: read(...ids), finishReason: 'stop' })
      .mockImplementationOnce(async () => {
        // Another catalog refresh clears the cached window before the next call.
        contextLength.mockReturnValue(undefined);
        return { content: read(...ids), finishReason: 'stop' };
      })
      .mockResolvedValueOnce({ content: 'All four notes arrived.', finishReason: 'stop' });
    const manager = new ConversationManager();
    const engine = new AgentRunEngine(provider as never, manager);
    try {
      const wired = wire(host);
      const result = await engine.runInitial({ toolName: 'workshop_persona_jill', systemMessage: 'System.',
        userMessage: 'Read the project notes.', policy: AGENT_RUN_POLICIES.workshopHost,
        capability: wired.capability, options: { maxTokens: 1_000 } });
      const [, withheld, delivered] = provider.createChatCompletion.mock.calls;
      expect(withheld[0].at(-1).content).toContain('did not fit');
      expect(withheld[0].at(-1).content).not.toContain('end of note');
      for (const id of ids) {
        expect(delivered[0].at(-1).content).toContain(`end of note ${id}`);
      }
      expect(manager.getContextSources(result.conversationId)).toHaveLength(4);
      expect(wired.session.readRoomLedger().filter(turn => turn.artifact === 'memory_read').map(turn => turn.capability?.status))
        .toEqual(['rejected', 'success']);
    } finally {
      contextLength.mockRestore();
      engine.dispose();
    }
  });

  it('shares one read of whole note blocks across unknown-window reads, while allowing a smaller later note and resetting next turn', async () => {
    const host = notes();
    const ids = smallIds.map((_, index) => `mem-80000${index}`);
    ids.forEach((id, index) => host.put(writerMemory({ id, title: `Large ${index}`, body: projectMemoryBody('a'.repeat(7_000)) })));
    const wired = wire(host);
    const first = await invoke(wired, read(...ids.slice(0, 4)));
    expect(first.deliveredSources).toHaveLength(4);
    const second = await invoke(wired, read(ids[4], ids[0], smallIds[0]));
    expect(second.deliveredSources?.map(source => source.label)).toEqual(['Large 4', 'Small 0']);
    expect(second.evidence).toContain('window size is unknown');
    expect(second.evidence).toContain('share 40,000 characters');
    expect(second.evidence).toContain(`${ids[0]}: not shown`);
    const third = await invoke(wired, read(ids[0]));
    expect(third.deliveredSources).toEqual([]);
    expect(third.evidence).toContain('in a later turn');
    expect((await invoke(wired, read(smallIds[1]))).deliveredSources).toHaveLength(1);
    expect((await invoke(wire(host), read(...ids.slice(0, 4)))).deliveredSources).toHaveLength(4);

    const known = wire(host);
    for (let index = 0; index < 2; index++) {
      expect((await invoke(known, read(...ids.slice(0, 4)), window(120_000))).deliveredSources).toHaveLength(4);
    }
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

    // Once the reply commits, the frame's record stands, so an unchanged folder sends nothing on a follow-up.
    wired.session.completeRun('host-request', 'The watch runs backward.', undefined, false, 'host-conv');
    const followUp = await wired.capability.appendTurnContract('<writer-message>Again</writer-message>');
    expect(followUp).not.toContain('<project-memory');
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
