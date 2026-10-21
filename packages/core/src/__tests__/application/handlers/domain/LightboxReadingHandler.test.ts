/**
 * LightboxReadingHandler (ADR 2026-10-19 D6–D10): lens sync and the
 * estimate, validate-before-spend refusals, a run's groups landing on the
 * board by id, Stop keeping what landed, a tile's re-read, and context files
 * that inform the prompt but are never evidence. A real LightboxService and
 * runner over a mocked engine: no provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { lightboxFileKey } from '@/infrastructure/lightbox/LightboxFileKey';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { LightboxReadingGroupId, MessageType } from '@/shared/types/messages';
import {
  ALL_LENSES_OFF,
  CHAPTER,
  CONTEXT_TEXT,
  createLightboxReadingHost,
  examples,
  groupOf,
  ok,
  settle,
  type LightboxReadingHostOptions
} from './lightboxReadingHarness';

async function setup(options: LightboxReadingHostOptions = {}) {
  const host = await createLightboxReadingHost(options);
  return { ...host, ...host.openTab(), settle };
}

describe('LightboxReadingHandler', () => {
  it('registers the seven reading routes', async () => {
    const { router } = await setup();
    expect([
      MessageType.LIGHTBOX_SET_LENSES,
      MessageType.LIGHTBOX_RUN,
      MessageType.LIGHTBOX_CANCEL_RUN,
      MessageType.LIGHTBOX_ADD_CONTEXT_FILES,
      MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT,
      MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE,
      MessageType.LIGHTBOX_SET_SPARK_DISMISSED
    ].every((type) => router.hasHandler(type))).toBe(true);
    expect(router.handlerCount).toBe(7);
  });

  it('answers the lens toggles with the context list and an estimate that leaves off lenses and empty groups out', async () => {
    const { route, ofType, board } = await setup();
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: ['genre', 'voice', 'subtext', 'lineage', 'spark', 'nonsense'] });
    expect(ofType(MessageType.LIGHTBOX_CONTEXT_FILES)[0].payload).toEqual({ files: [], totalWords: 0, ceilingWords: 50_000 });
    const estimate = ofType(MessageType.LIGHTBOX_RUN_ESTIMATE)[0].payload.estimate;
    expect(estimate).toMatchObject({ boardId: board.boardId, fit: 'fits', model: 'provider/model-v1', contextLength: 200_000 });
    expect(estimate?.groups.map((group) => [group.group, group.lenses])).toEqual([
      ['A', ['headline', 'motif', 'tension', 'gravity', 'palette']],
      ['B', ['characters']],
      ['D', ['stock', 'rhythm', 'numbers']],
      ['E', ['template', 'pressure', 'artifacts', 'summary']]
    ]);
    // A tile's re-read prices its own lens, except that template and summary are read together (Slice 4C).
    expect(estimate?.rereads.map((call) => call.lenses)).toEqual([
      ['headline'], ['motif'], ['tension'], ['gravity'], ['palette'], ['characters'], ['stock'], ['rhythm'], ['numbers'],
      ['template', 'summary'], ['pressure'], ['artifacts'], ['template', 'summary']
    ]);
    expect(estimate?.costUsd).toBeGreaterThan(0);
  });

  it('reports streamed characters through each group back and the finish, never resetting them', async () => {
    const { run, settle, ofType } = await setup({
      respond: (request) => {
        request.options?.onToken?.('x'.repeat(1_500));
        return ok(groupOf(request));
      }
    });
    await run();
    await settle();
    const progress = ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload);
    const characters = progress.filter((entry) => entry.phase !== 'started').map((entry) => entry.outputCharacters);
    expect(characters.every((count, index) => index === 0 || count >= characters[index - 1])).toBe(true);
    expect(progress[progress.length - 1]).toMatchObject({ phase: 'finished', outputCharacters: 7_500 });
  });

  it('reads the board: groups run, land on the board by id, and the run finishes', async () => {
    const { run, settle, ofType, service, board, runInitial } = await setup();
    await run();
    await settle();
    expect(runInitial).toHaveBeenCalledTimes(5);
    const boards = ofType(MessageType.LIGHTBOX_BOARD);
    expect(boards[0].payload.board?.readings.map((group) => group.status)).toEqual(['running', 'running', 'running', 'running', 'running']);
    const progress = ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload);
    expect(progress[0]).toMatchObject({ phase: 'started', token: 'run-1-token', groups: ['A', 'B', 'C', 'D', 'E'] });
    expect(progress[progress.length - 1]).toMatchObject({ phase: 'finished', groupsBack: 5 });
    const results = ofType(MessageType.LIGHTBOX_GROUP_RESULT).map((message) => message.payload);
    expect(results.map((result) => [result.group.group, result.group.status, result.token])).toEqual(expect.arrayContaining([
      ['A', 'ok', 'run-1-token'], ['B', 'ok', 'run-1-token'], ['C', 'ok', 'run-1-token'], ['D', 'ok', 'run-1-token'],
      ['E', 'ok', 'run-1-token']
    ]));
    const stored = service.currentBoard();
    expect(stored?.boardId).toBe(board.boardId);
    expect(stored?.readings.every((group) => group.status === 'ok' && group.tiles.length > 0)).toBe(true);
    expect(stored?.readings[0].usage?.costUsd).toBeCloseTo(0.01);
  });

  it('puts the chapter first in every call and context after it, labeled', async () => {
    const { route, run, settle, runInitial } = await setup();
    await route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    await run({ mode: 'lens', lens: 'characters' });
    await settle();
    const [request] = runInitial.mock.calls[0];
    expect(request.userMessage.startsWith('# The chapter\n\n8 paragraphs')).toBe(true);
    expect(request.userMessage.indexOf('# Context')).toBeGreaterThan(request.userMessage.indexOf('⟦¶8⟧'));
    expect(request.userMessage).toContain(`## Context file 1: Notes/cast.md\n\n${CONTEXT_TEXT}`);
    expect(request.systemMessage).toBe('SYSTEM lightbox/00-lightbox-shared.md + lightbox/20-characters.md + lightbox/41-example-group-b.md');
  });

  it('re-reads one tile: one call for that lens, the group\'s other tiles kept', async () => {
    const { run, settle, service, runInitial } = await setup();
    await run();
    await settle();
    const before = service.currentBoard()!.readings[0];
    const headline = before.tiles.find((tile) => tile.kind === 'headline');
    runInitial.mockClear();
    await run({ mode: 'lens', lens: 'motif' });
    await settle();
    expect(runInitial).toHaveBeenCalledTimes(1);
    expect(runInitial.mock.calls[0][0].toolName).toBe('lightbox-group-a');
    const after = service.currentBoard()!.readings[0];
    expect(after.status).toBe('ok');
    expect(after.tiles.find((tile) => tile.kind === 'headline')).toEqual(headline);
    expect(after.tiles.filter((tile) => tile.kind === 'motif').every((tile) => tile.id.startsWith('lbt-run-2-to-A'))).toBe(true);
    expect(after.usage?.costUsd).toBeCloseTo(0.02);
  });

  it('stops a run: groups back are kept, the rest are cancelled', async () => {
    const calls = new Map<LightboxReadingGroupId, (result: ExecutionResult) => void>();
    const { run, settle, route, service, ofType, board } = await setup({
      respond: (request) => new Promise<ExecutionResult>((resolve) => {
        calls.set(groupOf(request), resolve);
        request.options?.signal?.addEventListener('abort', () => resolve({ ...ok('A'), cancelled: true }));
      })
    });
    await run();
    await settle();
    calls.get('A')?.(ok('A'));
    await settle();
    await route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: board.boardId, token: 'run-1-token' });
    await settle();
    const readings = service.currentBoard()!.readings;
    expect(readings.map((group) => group.status)).toEqual(['ok', 'cancelled', 'cancelled', 'cancelled', 'cancelled']);
    expect(readings[0].tiles.length).toBeGreaterThan(0);
    expect(readings[1].error).toBe('Stopped before this group came back.');
    const cancelled = ofType(MessageType.LIGHTBOX_RUN_PROGRESS).find((message) => message.payload.phase === 'cancelled');
    expect(cancelled?.payload).toMatchObject({ token: 'run-1-token', groupsBack: 1 });
    // A late answer for the stopped run never lands.
    calls.get('B')?.(ok('B'));
    await settle();
    expect(service.currentBoard()!.readings[1].status).toBe('cancelled');
  });

  it('ignores a Stop for another token', async () => {
    const { run, route, runner, board } = await setup({ respond: () => new Promise<ExecutionResult>(() => undefined) });
    await run();
    await route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: board.boardId, token: 'someone-else' });
    expect(runner.activeRun(board.boardId)?.token).toBe('run-1-token');
    runner.dispose();
  });

  it.each([
    ['another board', { boardId: 'board-old' }, 'The board changed. Read the board on screen.'],
    ['every lens off', { lensesOff: ALL_LENSES_OFF }, 'Every lens is off, so there is nothing to read.'],
    ['no API key', { engine: false }, 'Add an OpenRouter API key in Settings to read the chapter.']
  ])('refuses before sending anything: %s', async (_label, variant, message) => {
    const { setLenses, run, ofType, runInitial } = await setup({ engine: (variant as { engine?: boolean }).engine });
    await setLenses((variant as { lensesOff?: typeof ALL_LENSES_OFF }).lensesOff ?? []);
    await run({ mode: 'all' }, { boardId: (variant as { boardId?: string }).boardId });
    expect(runInitial).not.toHaveBeenCalled();
    expect(ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((entry) => entry.payload)).toEqual([
      expect.objectContaining({ phase: 'refused', message })
    ]);
  });

  it('refuses a call too large for the model\'s window, naming the reason', async () => {
    const { run, ofType, runInitial } = await setup({ contextLength: 4_000 });
    await run();
    expect(runInitial).not.toHaveBeenCalled();
    const refusal = ofType(MessageType.LIGHTBOX_RUN_PROGRESS)[0].payload;
    expect(refusal.phase).toBe('refused');
    expect(refusal.message).toMatch(/4,000-token window allows/);
  });

  it('drops group results for a board whose text changed during the run', async () => {
    const calls: Array<(result: ExecutionResult) => void> = [];
    const { run, settle, service, ofType } = await setup({
      respond: () => new Promise<ExecutionResult>((resolve) => calls.push(resolve))
    });
    await run({ mode: 'lens', lens: 'genre' });
    await settle();
    await service.buildBoard({ kind: 'file', text: `${CHAPTER}\n\nA new last paragraph.`, displayPath: 'Drafts/alice-1.md' });
    calls[0](ok('C'));
    await settle();
    expect(ofType(MessageType.LIGHTBOX_GROUP_RESULT)).toEqual([]);
  });

  it('lets a run on a board that is no longer current land silently on that board, never over the newer one', async () => {
    const calls: Array<(result: ExecutionResult) => void> = [];
    const { run, settle, service, ofType, board } = await setup({
      respond: () => new Promise<ExecutionResult>((resolve) => calls.push(resolve))
    });
    await run({ mode: 'lens', lens: 'genre' });
    await settle();
    await service.buildBoard({ kind: 'file', text: 'Another chapter.\n\nWith two paragraphs.', displayPath: 'Drafts/two.md' });
    calls[0](ok('C'));
    await settle();
    expect(ofType(MessageType.LIGHTBOX_GROUP_RESULT)).toEqual([]);
    expect(service.currentBoard()?.source.displayPath).toBe('Drafts/two.md');
    // The reading is kept with its own board, for when the writer returns to it.
    expect(service.readingSource(board.boardId)?.board.readings[2].status).toBe('ok');
  });

  it('posts readings only to a webview that has spoken to it', async () => {
    const quiet = await setup();
    const { route, run, settle, ofType } = quiet;
    // A second handler over the same service, whose webview never sends a reading message.
    const posted: unknown[] = [];
    const bystander = new LightboxReadingHandler(
      quiet.service, quiet.runner, quiet.shelf, {} as TextSourceResolver, { pickFile: jest.fn() },
      { catalog: quiet.catalog, workspace: { workspaceFolders: () => [] } },
      async (message) => { posted.push(message); }, { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() }
    );
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [] });
    await run({ mode: 'lens', lens: 'voice' });
    await settle();
    expect(ofType(MessageType.LIGHTBOX_GROUP_RESULT)).toHaveLength(1);
    expect(posted).toEqual([]);
    bystander.dispose();
  });

  it('adds and removes context files through the picker, bounded and never the board\'s own source', async () => {
    const { route, ofType, shelf, pickFile, setLenses } = await setup();
    await route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    expect(ofType(MessageType.LIGHTBOX_CONTEXT_FILES).pop()?.payload.files).toEqual([
      { id: 'ctx-1', displayPath: 'Notes/cast.md', wordCount: 15, fileKey: lightboxFileKey('/workspace/Notes/cast.md') }
    ]);
    // The webview asks for the estimate when it sees the list change (PR #149 F-03).
    expect(ofType(MessageType.LIGHTBOX_RUN_ESTIMATE)).toEqual([]);
    await setLenses([]);
    expect(ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).pop()?.payload.estimate?.contextWords).toBe(15);

    pickFile.mockResolvedValueOnce({ fsPath: '/workspace/Drafts/alice-1.md', uri: 'file:///workspace/Drafts/alice-1.md' });
    await route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    expect(ofType(MessageType.LIGHTBOX_CONTEXT_FILES).pop()?.payload.notice).toContain('the board\'s own source');

    await route(MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, { id: 'ctx-1' });
    expect(shelf.list()).toEqual([]);
  });

  it('logs groups, counts and reasons, never the chapter or the context', async () => {
    const { route, run, settle, logged } = await setup();
    await route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    await run();
    await settle();
    const lines = logged();
    expect(lines).toContain('Group A read');
    for (const paragraph of examples.A.paragraphs) {
      expect(lines).not.toContain(paragraph.slice(0, 40));
    }
    expect(lines).not.toContain(CONTEXT_TEXT.slice(0, 30));
  });

  it('stops the runs it started when its tab closes', async () => {
    const { run, handler, service, runner, board } = await setup({ respond: () => new Promise<ExecutionResult>(() => undefined) });
    await run();
    handler.dispose();
    expect(runner.activeRun(board.boardId)).toBeUndefined();
    expect(service.currentBoard()!.readings.map((group) => group.status)).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled']);
  });
});
