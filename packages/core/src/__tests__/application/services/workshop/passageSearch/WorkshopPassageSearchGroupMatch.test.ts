/**
 * A persona's narrowed group (ADR 2026-11-20 S42, S44, S45), from the
 * reply to the card and the line the persona reads next: the trailer's
 * codec, settlement against the real resolver's listing and walk, the three
 * drops, the stored card's codec, the engine request, the card's and the
 * directive's words, and the transcript. Made-up text: Alice.
 */
/* eslint-disable @typescript-eslint/naming-convention -- made-up roots and setting keys, keyed by their paths and names. */

import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { completeWorkshopRun, workshopMessageCompletionCopy } from '@/application/services/workshop/WorkshopRunCompletion';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { resolveWorkshopReplyPassageSearch, type WorkshopPassageSearchListing } from '@/application/services/workshop/passageSearch/WorkshopReplyPassageSearch';
import { workshopPassageSearchEngineRequest } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchEngineRequest';
import {
  fitWorkshopPassageSearchDirective,
  renderWorkshopPassageSearchDirective,
  renderWorkshopPassageSearchSummary,
  WORKSHOP_PASSAGE_SEARCH_RESULTS_TAG
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchDirective';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { workshopTrailerDropReason } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerDropReasons';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { workshopPassageSearchView } from '@handlers/domain/workshop/WorkshopPassageSearchResultView';
import { workshopPassageSearchScopeWords } from '@/presentation/webview/components/workshop/passageSearch/WorkshopPassageSearchCard';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { decodeWorkshopPassageSearch } from '@/utils/workshopReplyPassageSearch';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_TRAILER_DROP_REASON_WORDS } from '@shared/constants/workshopTrailerOutcomeWords';
import type { WorkshopPassageSearchScope } from '@messages';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import { aliceProject, type AliceProjectOptions } from '../../contextPaths/aliceProject';
import { aliceResult } from '@/__tests__/application/handlers/domain/workshop/passageSearchRouteFixtures';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopResourceCapability } from '@/application/services/workshop/WorkshopResourceCapability';
import { PassageSearchScopeFiles } from '@/application/services/passageSearch/PassageSearchScopeFiles';
import type { LogSink } from '@/platform';

const FIXTURE = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-group-match.json'));
const HOST = { kind: 'host' } as const;
const QUESTION = 'Find every time the White Rabbit checks his watch.';
const BOOK = ['Drafts/chapter-1.md', 'Drafts/chapter-1.2.md', 'Drafts/chapter-4.1.md', 'Drafts/chapter-4.2.md', 'Notes/lore.md'];
const NARROWED = '<group match="Drafts/chapter-4.*.md, Drafts/chapter-1*.md,">chapters</group>';
const ask = (scopes: string): string => `<prose-minion-passage-search>\n<question>${QUESTION}</question>\n${scopes}\n</prose-minion-passage-search>`;

function resolverOver(options: Partial<AliceProjectOptions> = {}) {
  const alice = aliceProject({ roots: { '/alice': BOOK }, settings: { 'contextPaths.chapters': 'Drafts/**', 'contextPaths.general': 'Notes/**' }, ...options });
  const resolver = new ContextResourceResolver(alice.settings, alice.fileSystem, alice.workspace, alice.log);
  return { alice, listing: resolver as WorkshopPassageSearchListing, listGroupFiles: jest.spyOn(resolver, 'listGroupFiles'), matchPatterns: jest.spyOn(resolver, 'matchPatterns') };
}

let sent = 0;

async function replyWith(content: string, listing: WorkshopPassageSearchListing) {
  let clock = 1_000;
  const session = new WorkshopSessionService(() => clock++);
  session.setExcerpt({ text: 'Alice was beginning to get very tired of sitting by her sister.', source: { kind: 'manual' } });
  const context = await resolveWorkshopReplyPassageSearch(content, { hasExcerpt: false, listing, signal: new AbortController().signal });
  sent += 1;
  const requestId = `ps-match-${sent}`;
  session.beginPersonaMessage(requestId, `Message ${sent}.`);
  const log = jest.fn();
  const turn = completeWorkshopRun({
    session,
    requestId,
    label: 'Jill',
    result: { toolName: 'workshop-test', content, conversationId: 'host-conv', timestamp: new Date(0), replySource: 'provider' } as AnalysisResult,
    aborted: false,
    createsRetainedConversation: false,
    copy: workshopMessageCompletionCopy('Jill'),
    discardConversation: jest.fn(),
    readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
    log,
    events: { streamCompleted: jest.fn(), turnCompleted: jest.fn(), status: jest.fn(), error: jest.fn(), widgetRecommendationRejected: jest.fn() },
    ...(context ? { passageSearch: context } : {})
  })!;
  return { session, turn, logged: log.mock.calls.map(([line]) => String(line)).join('\n') };
}

describe('the trailer\'s codec reads a narrowing on a group alone', () => {
  it('splits match as a context-path setting is split, a trailing comma harmless', () => {
    expect(decodeWorkshopPassageSearch(`<question>${QUESTION}</question>${NARROWED}`)).toEqual({
      kind: 'request',
      request: { question: QUESTION, scopes: [{ kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] }] }
    });
  });

  it.each<[string, string, string]>([
    ['a group named twice, narrowed or not', `<group>chapters</group>${NARROWED}`, 'repeated-scope'],
    ['match on a path', '<path group="chapters" match="a.md">Drafts/chapter-1.md</path>', 'unknown-attribute'],
    ['match on the excerpt', '<excerpt match="a.md"/>', 'unknown-attribute'],
    ['a second attribute on a group', '<group match="a.md" kind="x">chapters</group>', 'unknown-attribute'],
    ['an empty list', '<group match=" , ">chapters</group>', 'empty-match'],
    ['a list over matchCharacters', `<group match="${'a'.repeat(PROMPT_BUDGETS.contextPaths.matchCharacters + 1)}">chapters</group>`, 'match-too-long'],
    ['more than matchPatterns', `<group match="${Array.from({ length: PROMPT_BUDGETS.contextPaths.matchPatterns + 1 }, (_, index) => `${index}.md`).join(',')}">chapters</group>`, 'too-many-match-patterns']
  ])('refuses %s', (_what, scopes, fault) => {
    expect(decodeWorkshopPassageSearch(`<question>${QUESTION}</question>${scopes}`)).toEqual({ kind: 'rejected', fault });
  });

  it('leaves whether a pattern is safe to settlement', () => {
    const decoded = decodeWorkshopPassageSearch(`<question>${QUESTION}</question><group match="../secrets/*.md">chapters</group>`);
    expect(decoded.kind).toBe('request');
  });
});

describe('settling a narrowed group', () => {
  it('commits the card with the patterns as split, from one listing and one walk, and logs counts only', async () => {
    const files = resolverOver();
    const { session, turn, logged } = await replyWith(`Let me look in those chapters.\n\n${ask(NARROWED)}`, files.listing);
    expect(turn.passageSearchRequest).toEqual({
      question: QUESTION,
      scopes: [{ kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] }]
    });
    expect(files.listGroupFiles).toHaveBeenCalledTimes(1);
    expect(files.matchPatterns).toHaveBeenCalledTimes(1);
    expect(turn.trailerOutcomes?.passageSearch).toEqual({ cards: 1, dropped: [] });
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain('shown as a card for the writer to price and run');
    expect(logged).toContain('Passage search request shown (scopes=1, patterns=2) (dropped=0)');
    expect([logged, ...files.alice.lines].join('\n')).not.toMatch(/chapter-|Drafts|Rabbit/);
  });

  it.each<[string, string, Partial<AliceProjectOptions>, 'unsafe-match' | 'match-found-nothing' | 'catalog-unreadable']>([
    ['an unsafe pattern', '<group match="Drafts/*.md, ../secrets/*.md">chapters</group>', {}, 'unsafe-match'],
    ['a pattern that finds no file of its group', '<group match="Drafts/chapter-4.*.md, Notes/*.md">chapters</group>', {}, 'match-found-nothing'],
    ['a mistyped pattern', '<group match="Drafts/chapter-4.*.md, Drafts/chaptre-1*.md">chapters</group>', {}, 'match-found-nothing'],
    ['a walk that did not complete', NARROWED, { failingGlobs: ['Drafts/chapter-1*.md'] }, 'catalog-unreadable']
  ])('drops %s whole, with its reason and its phrase', async (_what, scopes, options, reason) => {
    const files = resolverOver(options);
    const { session, turn } = await replyWith(`Looking.\n\n${ask(scopes)}`, files.listing);
    expect(turn.passageSearchRequest).toBeUndefined();
    expect(workshopTrailerDropReason(reason)).toBe(reason);
    expect(turn.trailerOutcomes?.passageSearch).toEqual({ cards: 0, dropped: [{ reason, count: 1 }] });
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain(`1 dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS[reason]})`);
    if (reason === 'unsafe-match') {
      // Refused before anything is listed or walked.
      expect(files.listGroupFiles).not.toHaveBeenCalled();
      expect(files.matchPatterns).not.toHaveBeenCalled();
    }
  });

  it('settles a whole group beside a narrowed one without walking it', async () => {
    const files = resolverOver();
    const { turn } = await replyWith(ask(`<group>general</group>\n${NARROWED}`), files.listing);
    expect(turn.passageSearchRequest?.scopes).toEqual([
      { kind: 'group', group: 'general' },
      { kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] }
    ]);
    expect(files.matchPatterns).toHaveBeenCalledWith({ chapters: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] });
  });
});

describe('the stored card\'s narrowing', () => {
  const withCard = (scopes: unknown[]): unknown => {
    const session = JSON.parse(FIXTURE) as { workshop: { turns: Array<Record<string, unknown>> } };
    const reply = session.workshop.turns.find((turn) => turn.passageSearchRequest)!;
    reply.passageSearchRequest = { question: QUESTION, scopes };
    return session;
  };

  it('round-trips exactly, and a session saved before Slice 5 keeps reading', () => {
    const stored = JSON.stringify(withCard([{ kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] }, { kind: 'excerpt' }]));
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(stored)))).toBe(stored);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(FIXTURE)))).toBe(FIXTURE);
  });

  it.each<[string, unknown]>([
    ['a narrowing on a file', { kind: 'file', group: 'chapters', path: 'Drafts/chapter-1.md', match: ['a.md'] }],
    ['an empty narrowing', { kind: 'group', group: 'chapters', match: [] }],
    ['a null narrowing', { kind: 'group', group: 'chapters', match: null }],
    ['too many patterns', { kind: 'group', group: 'chapters', match: Array.from({ length: PROMPT_BUDGETS.contextPaths.matchPatterns + 1 }, (_, index) => `${index}.md`) }],
    ['an untrimmed pattern', { kind: 'group', group: 'chapters', match: [' Drafts/*.md'] }],
    ['an unsafe pattern', { kind: 'group', group: 'chapters', match: ['../secrets/*.md'] }],
    ['a pattern holding a comma', { kind: 'group', group: 'chapters', match: ['a.md, b.md'] }],
    ['a pattern that is not text', { kind: 'group', group: 'chapters', match: [4] }]
  ])('refuses %s', (_what, scope) => {
    expect(() => decodeWorkshopPersistedSessionCheckpoint(withCard([scope]) as never)).toThrow();
  });
});

describe('what the narrowing reaches', () => {
  const scopes: WorkshopPassageSearchScope[] = [
    { kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] },
    { kind: 'file', group: 'characters', path: 'cast/white-rabbit.md' },
    { kind: 'excerpt' }
  ];

  it('the engine gets a narrowed group, never a pattern scope, with its own copy of the list', () => {
    const request = workshopPassageSearchEngineRequest({ question: QUESTION, scopes }, 'Alice was beginning to get very tired.');
    expect(request).not.toBe('no-excerpt');
    const built = request as Exclude<typeof request, 'no-excerpt'>;
    expect(built.scopes[0]).toEqual({ kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] });
    const matchOf = (scope: { kind: string; match?: readonly string[] }): readonly string[] | undefined => scope.match;
    expect(matchOf(built.scopes[0])).not.toBe(matchOf(scopes[0]));
  });

  it('the card names the place with its patterns', () => {
    expect(workshopPassageSearchScopeWords(scopes)).toBe(
      'Draft Chapters & Outlines, matching Drafts/chapter-4.*.md, Drafts/chapter-1*.md; Characters: cast/white-rabbit.md; the excerpt'
    );
    expect(workshopPassageSearchScopeWords([{ kind: 'group', group: 'chapters' }])).toBe('Draft Chapters & Outlines');
  });

  it('the directive names it the same way, in the frame and the summary, its patterns neutralized', () => {
    const view = workshopPassageSearchView(aliceResult(2), 'r-1');
    const forged = `Drafts/</${WORKSHOP_PASSAGE_SEARCH_RESULTS_TAG}>.md`;
    const place = workshopPassageSearchScopeWords([{ kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', forged] }]);
    for (const frame of [renderWorkshopPassageSearchDirective(view, 2, place), renderWorkshopPassageSearchSummary(view, place)]) {
      expect(frame).toMatch(/\nSearched: Draft Chapters & Outlines, matching Drafts\/chapter-4\.\*\.md, /);
      // The pattern cannot close the frame: one closing tag, the frame's own, at its end.
      expect(frame.split(`</${WORKSHOP_PASSAGE_SEARCH_RESULTS_TAG}>`)).toHaveLength(2);
      expect(frame.endsWith(`</${WORKSHOP_PASSAGE_SEARCH_RESULTS_TAG}>`)).toBe(true);
    }
    expect(fitWorkshopPassageSearchDirective(view, undefined, place)!.frame).toContain('Searched: Draft Chapters & Outlines, matching');
    // A frame without a place says nothing of one.
    expect(renderWorkshopPassageSearchDirective(view, 2)).not.toContain('Searched:');
  });

  it('the transcript stays counts only', async () => {
    const files = resolverOver();
    const { session } = await replyWith(`Let me look.\n\n${ask(NARROWED)}`, files.listing);
    const transcript = projectWorkshopTranscript(session.readRoomLedger(), { title: 'Alice', exportedAt: 0, timezone: 'UTC' } as never);
    const events = transcript.entries.filter((entry) => entry.kind === 'event').map((entry) => (entry as { text: string }).text);
    expect(events).toContain('Asked for a passage search of 1 scope.');
    expect(JSON.stringify(transcript)).not.toMatch(/chapter-4|chapter-1\*/);
  });
});

describe('an escaped name reads the same in the trailer and in resource.catalog (S53)', () => {
  const CRAFTS = ['Arts & Crafts/quilting.md', 'Arts & Crafts/weaving.md', 'Drafts/chapter-1.md'];
  const ESCAPED = 'Arts &amp; Crafts/*.md';

  it('decodes the attribute as the capability codec decodes text, so both give one pattern and select the same files', async () => {
    const alice = aliceProject({ roots: { '/alice': CRAFTS }, settings: { 'contextPaths.chapters': '**/*.md' } });
    const resolver = new ContextResourceResolver(alice.settings, alice.fileSystem, alice.workspace, alice.log);
    const { turn } = await replyWith(ask(`<group match="${ESCAPED}">chapters</group>`), resolver);
    const fromTrailer = turn.passageSearchRequest!.scopes[0];
    expect(fromTrailer).toEqual({ kind: 'group', group: 'chapters', match: ['Arts & Crafts/*.md'] });

    const call = `<prose-minion-tool-call name="resource.catalog"><group>chapters</group><match>${ESCAPED}</match></prose-minion-tool-call>`;
    const fromCall = new WorkshopCapabilityXmlCodec().inspect(call);
    expect(fromCall).toEqual({ kind: 'request', request: { capability: 'resource.catalog', group: 'chapters', match: ['Arts & Crafts/*.md'] } });

    // The inventory and the search read the same files.
    const capability = new WorkshopResourceCapability(resolver, { appendLine: jest.fn() } as unknown as LogSink,
      { requestId: 'host-1', personaId: 'jill', signal: new AbortController().signal });
    const inventory = await capability.fulfill(fromCall.kind === 'request' ? fromCall.request as never : (undefined as never));
    const listed = (inventory.content ?? '').split('\n').filter((line) => line.startsWith('- [')).map((line) => /`([^`]+)`/.exec(line)![1]);
    const scopeFiles = new PassageSearchScopeFiles({
      listing: resolver,
      fileSystem: { readFile: async () => new TextEncoder().encode('Alice sewed a quilt.'), stat: alice.fileSystem.stat },
      workspace: alice.workspace,
      editor: { currentSelection: () => undefined }
    });
    const searched = await scopeFiles.resolve([fromTrailer as { kind: 'group'; group: 'chapters'; match: string[] }], { editor: undefined });
    expect(listed).toEqual(['Arts & Crafts/quilting.md', 'Arts & Crafts/weaving.md']);
    expect(searched.kind === 'files' && searched.files.map((file) => file.displayPath)).toEqual(listed);
  });

  it('decodes a path\'s group attribute too, and leaves anything that is not a reference as written', () => {
    const decoded = decodeWorkshopPassageSearch(
      `<question>${QUESTION}</question><path group="&#99;hapters">Drafts/chapter-1.md</path><group match="Tea &amp Cakes/*.md, Arts & Crafts/*.md, A&nbsp;B/*.md, &#x26;*.md">manuscript</group>`
    );
    expect(decoded).toEqual({
      kind: 'request',
      request: {
        question: QUESTION,
        scopes: [
          { kind: 'file', group: 'chapters', path: 'Drafts/chapter-1.md' },
          { kind: 'group', group: 'manuscript', match: ['Tea &amp Cakes/*.md', 'Arts & Crafts/*.md', 'A&nbsp;B/*.md', '&*.md'] }
        ]
      }
    });
    // A decoded line break is a control character, which settlement refuses as unsafe.
    expect(decodeWorkshopPassageSearch(`<question>${QUESTION}</question><group match="Drafts/&#10;*.md">chapters</group>`))
      .toMatchObject({ kind: 'request', request: { scopes: [{ match: ['Drafts/\n*.md'] }] } });
  });

  it.each([
    ['padded decimal', 'Drafts/A&#0000000065;*.md', 'Drafts/AA*.md'],
    ['padded hex', 'Drafts/A&#x0000000041;*.md', 'Drafts/AA*.md'],
    ['a padded hex ampersand', 'Drafts/&#x0000000000000000000026;*.md', 'Drafts/&*.md'],
    ['the highest code point, padded', 'Drafts/&#x00010FFFF;*.md', 'Drafts/\u{10FFFF}*.md']
  ])('reads a reference with leading zeros as the capability codec does: %s', (_case, written, decoded) => {
    const fromTrailer = decodeWorkshopPassageSearch(`<question>${QUESTION}</question><group match="${written}">chapters</group>`);
    const fromCall = new WorkshopCapabilityXmlCodec().inspect(
      `<prose-minion-tool-call name="resource.catalog"><group>chapters</group><match>${written}</match></prose-minion-tool-call>`
    );
    expect(fromTrailer).toMatchObject({ kind: 'request', request: { scopes: [{ kind: 'group', group: 'chapters', match: [decoded] }] } });
    expect(fromCall).toEqual({ kind: 'request', request: { capability: 'resource.catalog', group: 'chapters', match: [decoded] } });
  });

  it.each([
    ['past U+10FFFF', 'Drafts/&#x0000110000;*.md'],
    ['a control character XML refuses', 'Drafts/&#00000001;*.md'],
    ['a surrogate', 'Drafts/&#x000D800;*.md']
  ])('bounds a padded reference by its value, never its zeros: %s stays as written, and the parser refuses it', (_case, written) => {
    expect(decodeWorkshopPassageSearch(`<question>${QUESTION}</question><group match="${written}">chapters</group>`))
      .toMatchObject({ kind: 'request', request: { scopes: [{ match: [written] }] } });
    expect(new WorkshopCapabilityXmlCodec().inspect(
      `<prose-minion-tool-call name="resource.catalog"><group>chapters</group><match>${written}</match></prose-minion-tool-call>`
    ).kind).not.toBe('request');
  });

  it('keeps a reference written with more digits than any reader needs as written, so its text stays bounded', () => {
    const written = `Drafts/&#${'0'.repeat(64)}65;*.md`;
    expect(decodeWorkshopPassageSearch(`<question>${QUESTION}</question><group match="${written}">chapters</group>`))
      .toMatchObject({ kind: 'request', request: { scopes: [{ match: [written] }] } });
    // Sixty-four digits, zeros included, still read.
    expect(decodeWorkshopPassageSearch(`<question>${QUESTION}</question><group match="Drafts/&#${'0'.repeat(62)}65;*.md">chapters</group>`))
      .toMatchObject({ kind: 'request', request: { scopes: [{ match: ['Drafts/A*.md'] }] } });
  });
});
