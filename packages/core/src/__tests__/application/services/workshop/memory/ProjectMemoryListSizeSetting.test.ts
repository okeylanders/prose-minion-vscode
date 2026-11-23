/**
 * The list size, from the setting to the frame and the tab (Everyday
 * Conveniences, Round Two, item C; ADR 2026-11-17 D9, D10, D12), through
 * the real library, store, capability and conversation manager:
 *
 * - the frame is built at the size the setting holds when a conversation
 *   starts, and a later change leaves that conversation's first message
 *   byte for byte; the next conversation gets the new size;
 * - at every size the tab's view states exactly what the frame holds;
 * - the update note keeps Standard's bound at every size;
 * - a catalog page through the persona capability: its card's metadata and
 *   a log of counts alone.
 *
 * *Alice*, with made-up ids.
 */
import { unavailableHelpReference } from '@/__tests__/application/services/workshop/help/unavailableHelpReference';
import { unavailableProjectLocations } from '@/__tests__/application/services/workshop/locations/unavailableProjectLocations';
import { unavailableFileHistory } from '@/__tests__/application/services/workshop/history/unavailableFileHistory';
import { ConversationManager } from '@orchestration/ConversationManager';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS,
  WORKSHOP_PROJECT_MEMORY_LIST_SIZES
} from '@shared/constants/workshopProjectMemoryListSizes';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { WorkshopResourceSources } from '@/application/services/workshop/WorkshopResourceCapability';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { readProjectMemoryListSize, projectMemoryListSizeChoice } from '@/application/services/workshop/memory/ProjectMemoryListSize';
import { workshopMemoryTabView } from '@hooks/domain/workshop/memory/workshopMemoryTabView';
import { workshopMemoryTabInputOf } from '@hooks/domain/workshop/memory/workshopMemoryListingInputs';
import { allLines, libraryHost, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { noProjectLenses } from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';

const SENTINEL_TITLE = 'SENTINEL-TITLE-7c1d';
const id = (index: number): string => `mem-${index.toString(16).padStart(6, '0')}`;

/** A folder past every size's list: `count` notes with long summaries, newest last. */
function fill(host: ReturnType<typeof libraryHost>, count: number, summary = 'S'.repeat(160)): void {
  for (let index = 0; index < count; index += 1) {
    host.put(writerMemory({
      id: id(index),
      title: `${SENTINEL_TITLE} ${index}`,
      summary,
      created: '2025-06-01T00:00:00Z',
      // As a memory file writes a time: to the second.
      updated: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString().replace('.000Z', 'Z')
    }));
  }
}

function capabilityOver(host: ReturnType<typeof libraryHost>, session: WorkshopSessionService, requestId: string, message: string) {
  session.beginPersonaMessage(requestId, message);
  return new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService,
    {} as WorkshopAnalysisSidePass,
    { createProvider: jest.fn() } as unknown as WorkshopResourceSources,
    session,
    host.log,
    {} as WorkshopTranscriptRecallPort,
    host.library,
    noProjectLenses,
    unavailableHelpReference,
    unavailableFileHistory,
    unavailableProjectLocations
  ).create({
    requestId,
    excerptVersion: 0,
    personaId: 'jill',
    owner: { kind: 'host' },
    signal: new AbortController().signal,
    events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
  });
}

const openRoom = (): WorkshopSessionService => {
  const session = new WorkshopSessionService(() => Date.parse('2026-11-04T10:00:00.000Z'));
  session.setSessionScope('open');
  return session;
};
const frameOf = (message: string): string => message.slice(message.indexOf('<project-memory '), message.indexOf('</project-memory>') + '</project-memory>'.length);
const count = (text: string, tag: string): number => text.split('\n').filter((line) => line.trimStart().startsWith(`<${tag} `)).length;

describe('the one reader of the list size', () => {
  it('reads the setting now, and anything but a known size as Standard', () => {
    const host = libraryHost();
    expect(readProjectMemoryListSize(host.settings)).toBe('standard');
    for (const size of WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS) {
      host.setListSize(size);
      expect(projectMemoryListSizeChoice(host.settings)).toEqual({ size, budgets: WORKSHOP_PROJECT_MEMORY_LIST_SIZES[size] });
    }
    for (const bad of ['Largest', 'huge', 3, null, { size: 'largest' }]) {
      host.setListSize(bad);
      expect(readProjectMemoryListSize(host.settings)).toBe('standard');
    }
  });
});

describe('the frame is built at the chosen size', () => {
  it.each(WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS)('%s: each tier within the size\'s budget, and the frame the library sends is the one the tab is told of', async (size) => {
    const host = libraryHost({ listSize: size });
    fill(host, 900);
    host.put(writerMemory({ id: 'mem-aaaaaa', title: 'Structure first', pinned: true }));
    host.put(writerMemory({ id: 'mem-bbbbbb', title: 'Put away', status: 'archived' }));
    const budgets = WORKSHOP_PROJECT_MEMORY_LIST_SIZES[size];

    const result = await host.library.frame();
    if (result.kind !== 'frame') {
      throw new Error(`expected a frame, got ${result.kind}`);
    }
    const { frame } = result;
    expect(frame.estimate.catalogTokens).toBeLessThanOrEqual(budgets.catalogTokens);
    expect(frame.entries.length).toBeLessThanOrEqual(budgets.catalogEntries);
    expect(frame.estimate.titleTokens).toBeLessThanOrEqual(budgets.titleTokens);
    expect(frame.estimate.pinnedLoadedTokens).toBeLessThanOrEqual(budgets.pinnedTokens);
    // The list filled: one more entry or title would not have fit.
    expect(frame.entries.length === budgets.catalogEntries || frame.estimate.catalogTokens > budgets.catalogTokens - 80).toBe(true);
    expect(frame.estimate.titleTokens).toBeGreaterThan(budgets.titleTokens - 60);
    expect(frame.unlisted).toBe(900 - frame.entries.length - frame.titles.length);
    expect(frame.more).toBe(1);

    // The tab: the listing's estimate is this frame's, and its budgets are this size's.
    const listing = await host.library.managerListing('');
    expect(listing.estimate).toEqual(frame.estimate);
    expect(listing).toMatchObject({ listSize: size, budgets });
    expect(await host.library.estimateProjectMemoryFrame()).toEqual({ kind: 'estimate', ...frame.estimate });

    const view = workshopMemoryTabView({ mode: 'ask', ...workshopMemoryTabInputOf({ requestId: 'r1', ...listing }) });
    const lines = (tag: string) => frame.text.split('\n').map((line) => line.trim()).filter((line) => line.startsWith(`<${tag} `));
    const tokens = (tag: string) => lines(tag).reduce((sum, line) => sum + estimateTextTokens(line), 0);
    expect(view.load.meters.map((meter) => [meter.key, meter.value, meter.max])).toEqual([
      ['full', tokens('pinned'), budgets.pinnedTokens],
      ['list', tokens('entry'), budgets.catalogTokens],
      ['titles', tokens('title-only'), budgets.titleTokens]
    ]);
    expect(view.load.meters[1].left).toBe(`Titles and summaries · ${lines('entry').length} of 900 fit`);
    expect(view.load.meters[2].left).toBe(`Titles only · ${lines('title-only').length.toLocaleString('en-US')} of ${(900 - lines('entry').length).toLocaleString('en-US')} fit`);
    // The "searchable" line counts exactly the notes in effect the frame shows in no tier.
    expect(view.load.more).toEqual([
      `${frame.unlisted.toLocaleString('en-US')} more are searchable. Personas find them with memory search when the conversation needs them.`
    ]);
    expect(frame.text).toContain(`<unlisted count="${frame.unlisted}">`);
  });

  it('gives more of the same folder at each larger size', async () => {
    const shown: number[][] = [];
    for (const size of WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS) {
      const host = libraryHost({ listSize: size });
      fill(host, 900);
      const result = await host.library.frame();
      const frame = (result as Extract<typeof result, { kind: 'frame' }>).frame;
      shown.push([frame.entries.length, frame.titles.length]);
    }
    expect(shown[0][0]).toBeLessThan(shown[1][0]);
    expect(shown[1][0]).toBeLessThan(shown[2][0]);
    expect(shown[0][1]).toBeLessThan(shown[1][1]);
    expect(shown[1][1]).toBeLessThan(shown[2][1]);
    // Larger and Largest pass Standard's entry cap: the cap grows with the size.
    expect(shown[1][0]).toBeGreaterThan(PROMPT_BUDGETS.workshopProjectMemory.catalogEntries);
  });

  it('logs the size and counts, never a title', async () => {
    const host = libraryHost({ listSize: 'larger' });
    fill(host, 200);
    await host.library.frame();
    await host.library.managerListing('');
    const frameLine = host.lines.find((line) => line.includes('frame size='));
    expect(frameLine).toMatch(/frame size=larger pinned=0 entries=\d+ titles=\d+ unlisted=\d+ more=0 tokens=\d+ pinnedOver=false$/);
    expect(allLines(host.lines)).not.toContain(SENTINEL_TITLE);
  });
});

describe('a change applies from the next conversation', () => {
  it('leaves an open conversation\'s first message byte for byte, through later turns, a prompt rebuild and a reopen', async () => {
    const host = libraryHost();
    fill(host, 900);
    const session = openRoom();
    const first = await capabilityOver(host, session, 'host-request', 'What did we settle?')
      .appendContract('<writer-message>What did we settle?</writer-message>');
    session.completeRun('host-request', 'The watch runs backward.', undefined, false, 'host-conv');
    const standardFrame = frameOf(first);
    expect(count(standardFrame, 'entry')).toBeLessThanOrEqual(WORKSHOP_PROJECT_MEMORY_LIST_SIZES.standard.catalogEntries);

    const manager = new ConversationManager();
    const conversation = manager.startConversation('workshop_persona_jill', 'System prompt');
    manager.pinConversation(conversation);
    manager.addMessages(conversation, [{ role: 'user', content: first }, { role: 'assistant', content: 'The watch runs backward.' }]);

    // The writer picks Largest mid-conversation. Nothing rebuilds the frame, and nothing is announced.
    host.setListSize('largest');
    const second = await capabilityOver(host, session, 'host-second', 'And the Hatter?')
      .appendTurnContract('<writer-message>And the Hatter?</writer-message>');
    session.completeRun('host-second', 'Always six.', undefined, false, 'host-conv');
    manager.addMessages(conversation, [{ role: 'user', content: second }, { role: 'assistant', content: 'Always six.' }]);
    expect(second).not.toContain('<project-memory');
    expect(manager.getMessages(conversation)[1].content).toBe(first);

    manager.replaceSystemMessages([{ conversationId: conversation, systemMessage: 'System prompt, rebuilt' }]);
    expect(manager.getMessages(conversation)[1].content).toBe(first);
    const [archive] = manager.exportConversations([{ key: 'host' as const, conversationId: conversation }]);
    const reopened = new ConversationManager();
    const [outcome] = reopened.importConversations([{ entry: archive, systemMessage: 'Rebuilt current system prompt' }]);
    expect(reopened.getMessages((outcome as { conversationId: string }).conversationId)[1].content).toBe(first);
    expect(Buffer.from(frameOf(reopened.getMessages((outcome as { conversationId: string }).conversationId)[1].content), 'utf8')
      .equals(Buffer.from(standardFrame, 'utf8'))).toBe(true);

    // The next conversation is built at the new size.
    const next = await capabilityOver(host, openRoom(), 'next-request', 'A new conversation.')
      .appendContract('<writer-message>A new conversation.</writer-message>');
    const largestFrame = frameOf(next);
    expect(count(largestFrame, 'entry')).toBeGreaterThan(count(standardFrame, 'entry'));
    expect(count(largestFrame, 'title-only')).toBeGreaterThan(count(standardFrame, 'title-only'));
    expect(largestFrame).not.toBe(standardFrame);
  });

  it('builds the same bytes again for the same folder, date and size', async () => {
    const build = async () => {
      const host = libraryHost({ listSize: 'larger' });
      fill(host, 400);
      return frameOf(await capabilityOver(host, openRoom(), 'host-request', 'Hello.').appendContract('<writer-message>Hello.</writer-message>'));
    };
    const first = await build();
    expect(first).toContain('<title-only ');
    expect(await build()).toBe(first);
  });

  it('keeps the update note to Standard\'s bound at every size', async () => {
    const host = libraryHost({ listSize: 'largest' });
    fill(host, 3);
    const session = openRoom();
    await capabilityOver(host, session, 'host-request', 'Hello.').appendContract('<writer-message>Hello.</writer-message>');
    session.completeRun('host-request', 'Hello.', undefined, false, 'host-conv');

    // 60 new notes with full-length summaries: within Largest's list, past Standard's 2,000 tokens.
    for (let index = 0; index < 60; index += 1) {
      host.put(writerMemory({ id: id(0x500 + index), title: `New note ${index}`, summary: 'S'.repeat(PROMPT_BUDGETS.workshopProjectMemory.summaryCharacters) }));
    }
    const second = await capabilityOver(host, session, 'host-second', 'Anything new?').appendTurnContract('<writer-message>Anything new?</writer-message>');
    const note = second.slice(second.indexOf('<project-memory-update'));
    expect(note).toContain('call memory.catalog.</project-memory-update>');
    expect(note).not.toContain('<entry ');
  });
});

describe('a catalog page through the persona capability', () => {
  it('answers the page asked, records its page and pages for the card, and logs counts alone', async () => {
    const host = libraryHost();
    fill(host, 93, 'A short line.');
    const session = openRoom();
    const capability = capabilityOver(host, session, 'host-request', 'List the notes.');
    const codec = new WorkshopCapabilityXmlCodec();

    const inspected = capability.inspectRequest('<prose-minion-tool-call name="memory.catalog"><page>2</page></prose-minion-tool-call>');
    if (inspected.kind !== 'request') {
      throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
    }
    // The persona reads the evidence with its markup escaped; unescaped, the hint is the call to send.
    const unescape = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const metadataOf = (evidence: string) => JSON.parse(unescape(/<metadata>(.*)<\/metadata>/.exec(evidence)![1])) as Record<string, unknown>;
    const result = await capability.fulfill(inspected.request);
    expect(result.evidence.startsWith('<workshop-capability-result name="memory.catalog" status="success"')).toBe(true);
    expect(metadataOf(result.evidence)).toMatchObject({ outcome: 'catalog', memoryCount: 40, page: 2, pages: 3, notShown: 13, truncated: true });
    const [card] = session.readRoomLedger().filter((turn) => turn.artifact === 'memory_catalog');
    expect(card.capability).toMatchObject({ operation: 'memory.catalog', status: 'success', requestSummary: 'project notes, page 2' });
    const content = unescape(result.evidence);
    expect(content).toContain('Notes 41–80 of 93 in effect, pinned first, then newest:');
    const hint = /The next page: (<prose-minion-tool-call .*?<\/prose-minion-tool-call>)/.exec(content)![1];
    expect(codec.inspect(hint)).toEqual({ kind: 'request', request: { capability: 'memory.catalog', page: 3 } });

    // The last page is whole: nothing more is one call away.
    const last = capability.inspectRequest(hint);
    const lastResult = await capability.fulfill((last as Extract<typeof last, { kind: 'request' }>).request);
    expect(metadataOf(lastResult.evidence)).toMatchObject({ memoryCount: 13, page: 3, pages: 3, notShown: 0, truncated: false });
    expect(lastResult.evidence).not.toContain('The next page:');

    // A malformed page is refused before anything is read.
    expect(capability.inspectRequest('<prose-minion-tool-call name="memory.catalog"><page>0</page></prose-minion-tool-call>'))
      .toMatchObject({ kind: 'invalid', reason: 'invalid-page' });

    expect(host.lines.some((line) => /catalog page=2 pages=3 shown=40 notShown=13$/.test(line))).toBe(true);
    expect(allLines(host.lines)).not.toContain(SENTINEL_TITLE);
  });
});
