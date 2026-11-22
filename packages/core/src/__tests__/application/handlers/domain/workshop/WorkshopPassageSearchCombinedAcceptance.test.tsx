/**
 * The combined acceptance case for a persona's passage search over the
 * organizing pass's engine (PR #295 + PR #296; Astra's case). A search over
 * two chapters: the short one's read returns a match; the long one's read is
 * refused by the engine's own context preflight before dispatch.
 *
 * Through the production engine (`ProjectPassageSearchEngine`, its scope
 * files, `PassageSearchService`, the organizer and `AIResourceManager`) and
 * the real Workshop routes, room handler and session. The only stand-ins are
 * the provider's transport, the catalog's window (unknown when the plan is
 * priced, 16,384 tokens when the reads are sent: #295's scenario, which the
 * Workshop's re-plan at Run cannot otherwise reach), the project's listing
 * and files, and the persona's own conversation (the route harness's mock).
 *
 * One read reaches the provider and one is refused, with no usage or charge
 * for it; one file has an instance and one of the two was searched; coverage
 * is incomplete, so the card waits as `ready` with "Send partial results".
 * The card, the shared report, the receipt saved and reopened through the
 * session codec, and the directive delivered by Send all say the same counts
 * and that one file was not searched. Model ids and keys are placeholders;
 * the texts adapt *Alice*.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order, so the provider's replies are taken in a known order.
  default: () => {
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageType, type PassageSearchResultView, type TokenUsage, type WorkshopTurn } from '@messages';
import type { ContextResourceCandidate } from '@/domain/models/ContextGeneration';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { PassageSearchModelOrganizer } from '@services/search/passage/PassageSearchModelOrganizer';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import { ProjectPassageSearchEngine } from '@/application/services/passageSearch/PassageSearchEngine';
import { PassageSearchScopeFiles } from '@/application/services/passageSearch/PassageSearchScopeFiles';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { parseWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import type { WorkshopPassageSearchPorts } from '@handlers/domain/workshop/WorkshopPassageSearchHandler';
import { WorkshopPassageSearchCard, type WorkshopPassageSearchControls } from '@components/workshop/passageSearch/WorkshopPassageSearchCard';
import { formatPassageSearchReport } from '@shared/utils/passageSearchReport';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { renderWorkshopPassageSearchDirective } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchDirective';
import { QUESTION, RABBIT_CHAPTER, fillerParagraph, replyOf } from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';
import { passageSearchRouteDriver } from './passageSearchRouteDriver';

const PASSAGE = 'placeholder/passage-model';
const WINDOW = 16_384;
const METERED: TokenUsage = { promptTokens: 8, completionTokens: 4, totalTokens: 12, costUsd: 0.01 };
const LONG = Array.from({ length: 6 }, (_unused, index) => fillerParagraph(`Hatter${index + 1}-`, 1_000)).join('\n\n');
const PASS = JSON.stringify({ headline: 'The Rabbit keeps checking the hour.', sections: [{ title: 'The watch', claims: [{ text: 'It "took a watch out of its waistcoat-pocket".', cites: [1] }] }] });
/** The same counts and coverage, said everywhere. */
const TOO_LARGE = '1 call did not fit the model\'s window and was not sent, so the text it covers was not searched.';
const NOT_SEARCHED = '1 of 2 files was not searched.';
const READ = '1 of 2 calls answered, over 1 of 2 files.';
const CARD_WORDS = `Found 1 instance in 1 file. 1 of 2 files was searched. ${TOO_LARGE}`;
const RESULTS_LINE = 'Passage search finished: 1 instance in 1 file; 1 of 2 files searched.';

const managers: AIResourceManager[] = [];

/** The production engine over two listed chapters; the transport and the catalog's window are the stand-ins. */
function productionEngine() {
  jest.spyOn(OpenRouterModels, 'getCachedContextLength').mockReturnValue(WINDOW);
  const queue = [replyOf({ quote: 'took a watch out of its waistcoat-pocket' }), PASS];
  const provider = jest.spyOn(OpenRouterClient.prototype, 'createChatCompletion').mockImplementation(async () => {
    const content = queue.shift();
    if (content === undefined) {
      throw new Error('no reply queued');
    }
    return { content, finishReason: 'stop', usage: METERED } as never;
  });
  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    { getApiKey: jest.fn().mockResolvedValue('sk-placeholder') } as never,
    { get: jest.fn((_section, key, fallback) => (key === 'passageSearchModel' ? PASSAGE : fallback)) } as never,
    { createProvider: jest.fn() } as never
  );
  managers.push(manager);
  const prompts = { loadPrompts: jest.fn(async (files: string[]) => `SYSTEM ${files.join(' + ')}`) };
  // The plan's catalog read knows no window yet; the reads' preflight measures the model's 16,384.
  const prices = { facts: jest.fn(async () => ({ pricing: { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000004 } })) };
  const log = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const service = new PassageSearchService(manager, prompts as never, prices, log, new PassageSearchModelOrganizer(manager, prompts as never, prices, log));
  // eslint-disable-next-line @typescript-eslint/naming-convention -- files keyed by their made-up paths.
  const texts: Record<string, string> = { '/book/chapters/long.md': LONG, '/book/chapters/1.md': RABBIT_CHAPTER };
  const listed: ContextResourceCandidate[] = Object.entries(texts).map(([absolutePath, text]) => ({
    group: 'chapters', relativePath: absolutePath.replace('/book/', ''), workspaceFolderPath: '/book', absolutePath, sizeBytes: text.length
  }));
  const listing = { listGroupFiles: jest.fn(async () => listed), listPatternFiles: jest.fn(async () => []) };
  const scopeFiles = new PassageSearchScopeFiles({
    listing,
    fileSystem: {
      readFile: jest.fn(async (filePath: string) => new TextEncoder().encode(texts[filePath])),
      stat: jest.fn(async (filePath: string) => ({ type: 1, ctime: 0, mtime: 0, size: texts[filePath].length }))
    },
    workspace: { workspaceFolders: () => [{ path: '/book', name: 'book' }] },
    editor: { currentSelection: () => undefined }
  });
  const saved: PassageSearchResultView[] = [];
  const ports: WorkshopPassageSearchPorts = {
    engine: new ProjectPassageSearchEngine(scopeFiles, service, log),
    listing,
    reports: { save: jest.fn(async (view: PassageSearchResultView) => { saved.push(view); return { status: 'saved' as const, filePath: 'prose-minion/reports/r.md', opened: true }; }) }
  };
  return { ports, provider, saved };
}

/** The card as the webview draws it, from the turn the host posted. */
function drawn(turn: WorkshopTurn): string {
  const controls: WorkshopPassageSearchControls = {
    estimates: new Map(), busy: new Map(), progress: new Map(), feedback: new Map(), locked: false,
    onEstimate: () => undefined, onRun: () => undefined, onStop: () => undefined, onCancel: () => undefined,
    onSend: () => undefined, onDiscard: () => undefined, onOpenReport: () => undefined
  };
  return renderToStaticMarkup(<WorkshopPassageSearchCard turn={turn} controls={controls} />);
}

/** The case up to the card waiting, ready: the production engine and the real routes. */
async function searchedToReady() {
  const engine = productionEngine();
  const driver = await passageSearchRouteDriver({ passageSearch: engine.ports }, undefined,
    `<prose-minion-passage-search>\n<question>${QUESTION}</question>\n<group>chapters</group>\n</prose-minion-passage-search>`);
  const [priced] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE);
  await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: priced.estimate.planKey });
  return { engine, driver };
}

afterEach(() => {
  managers.splice(0).forEach((manager) => manager.dispose());
  jest.restoreAllMocks();
});

describe('a persona\'s passage search where one read is refused by the engine\'s preflight (the combined acceptance case)', () => {
  it('says the same counts and that one file was not searched on the card, in the report, the reopened receipt and the delivered directive', async () => {
    const engine = productionEngine();
    const driver = await passageSearchRouteDriver({ passageSearch: engine.ports }, undefined,
      `<prose-minion-passage-search>\n<question>${QUESTION}</question>\n<group>chapters</group>\n</prose-minion-passage-search>`);
    const { harness } = driver;
    expect(driver.card.passageSearchRequest?.scopes).toEqual([{ kind: 'group', group: 'chapters' }]);

    // Priced: two reads and an allowance for organizing, nothing sent.
    const [priced] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE);
    expect(priced).toEqual(expect.objectContaining({ outcome: 'done', estimate: expect.objectContaining({ calls: 3, files: 2, organizes: true }) }));
    expect(engine.provider).not.toHaveBeenCalled();

    const ran = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: priced.estimate.planKey });
    expect(ran.map((answer) => answer.outcome)).toEqual(['started', 'finished']);
    expect(ran.at(-1).message).toBe(CARD_WORDS);

    // One read reached the provider, and the organizing pass after it; the long chapter was never sent.
    expect(engine.provider).toHaveBeenCalledTimes(2);
    const sentTexts = engine.provider.mock.calls.map((call) => JSON.stringify(call));
    expect(sentTexts.some((text) => text.includes('Hatter1-'))).toBe(false);
    expect(sentTexts[0]).toContain('waistcoat-pocket');

    // Not sent by the host: the coverage is incomplete. The card waits, ready, with Send partial results.
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    expect(driver.requestTurns()).toHaveLength(0);
    const ready = await driver.view();
    expect(ready).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
    expect((ready as { counts: unknown }).counts).toEqual(expect.objectContaining({
      instances: 1, files: 1, searched: 1, filesPlanned: 2, requests: 2,
      calls: { planned: 2, answered: 1, failed: 0, cut: 0, unsent: 0, cancelled: 0, tooLarge: 1, dispatched: 1 }, ended: 'complete', organized: true
    }));
    const posted = harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns as WorkshopTurn[];
    const card = drawn(posted.find((turn) => turn.id === driver.card.id)!);
    expect(card).toContain('Send partial results to Jill');
    expect(card).toContain(CARD_WORDS.replace(/'/g, '&#x27;'));

    // The shared report: the same counts, and the file not searched; no usage or charge for the refused read.
    expect((await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT))[0].outcome).toBe('done');
    const [view] = engine.saved;
    expect(view.calls).toEqual({ planned: 2, answered: 1, failed: 0, cut: 0, cancelled: 0, unsent: 0, tooLarge: 1, dispatched: 1 });
    expect(view.files).toEqual(expect.objectContaining({ planned: 2, withInstances: 1, searched: { full: 1, partial: 0, none: 1 } }));
    expect(view.usage).toEqual(expect.objectContaining({ requestCount: 2, costUsd: 0.02 }));
    const report = formatPassageSearchReport(view);
    for (const line of ['- **Found:** 1 instance in 1 file', `- **Read:** ${READ}`, NOT_SEARCHED, TOO_LARGE]) {
      expect(report).toContain(line);
    }

    // Send: the writer's press delivers the partial result, and the directive says the same.
    const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent.outcome).toBe('done');
    const [, directive] = harness.service.continueConversation.mock.calls.at(-1) as unknown as [string, string];
    for (const line of ['Found: 1 instance in 1 file', READ, NOT_SEARCHED, TOO_LARGE, 'Headline: The Rabbit keeps checking the hour.']) {
      expect(directive).toContain(line);
    }
    expect(driver.requestTurns()[0].content).toBe(RESULTS_LINE);
    const transcript = projectWorkshopTranscript(driver.ledger(), { title: 'Alice', exportedAt: 0, timezone: 'UTC' } as never);
    expect(transcript.entries.map((entry) => (entry as { text?: string }).text)).toContain(RESULTS_LINE);

    // Saved and reopened through the strict session codec, in a window that holds no result: the receipt says the same.
    const reopened = new WorkshopSessionService(() => 1);
    reopened.hydrateCommittedState(parseWorkshopSessionStateV1(JSON.parse(JSON.stringify(harness.session.exportCommittedState()))), {}, reopened.getConversationBehavior());
    const later = createWorkshopRouteTestHarness({ session: reopened, passageSearch: engine.ports });
    await later.router.route(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as never);
    const turns = later.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns as WorkshopTurn[];
    const receiptCard = turns.find((turn) => turn.id === driver.card.id)!;
    expect(receiptCard.passageSearchRequest?.view).toEqual(expect.objectContaining({
      status: 'delivered', shown: 1, reportHeld: false,
      counts: expect.objectContaining({ instances: 1, files: 1, searched: 1, filesPlanned: 2, requests: 2, calls: expect.objectContaining({ tooLarge: 1, dispatched: 1 }) })
    }));
    expect(drawn(receiptCard)).toContain(CARD_WORDS.replace(/'/g, '&#x27;'));
    expect(turns.find((turn) => turn.passageSearchResults)?.content).toBe(RESULTS_LINE);
  });

  it('sent into a conversation where only the compact summary fits, the directive still says the file was not searched', async () => {
    const { engine, driver } = await searchedToReady();
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
    await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
    const [view] = engine.saved;
    // One token short of the smallest frame by whole instances (none, or the one): only the summary fits.
    const least = Math.min(...[0, 1].map((shown) => estimateTextTokens(renderWorkshopPassageSearchDirective(view, shown))));
    driver.harness.service.measureWorkshopReplyWindow.mockReturnValue({
      contextLength: 200_000, requestTokens: 190_000, outputTokens: 9_000, headroomTokens: 920, freeInputTokens: (least - 1) * 2
    } as never);

    const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent.outcome).toBe('done');
    const [, directive] = driver.harness.service.continueConversation.mock.calls.at(-1) as unknown as [string, string];
    expect(directive).toContain('The writer\'s report has all of it');
    expect(directive).not.toContain('Headline: ');
    for (const line of ['Found: 1 instance in 1 file', READ, NOT_SEARCHED, TOO_LARGE]) {
      expect(directive).toContain(line);
    }
    expect(driver.ledger().at(-1)!.passageSearchDelivery).toEqual(expect.objectContaining({ shown: 0, filesPlanned: 2, searched: 1 }));
  });
});
