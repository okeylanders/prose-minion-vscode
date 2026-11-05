/**
 * The Read in reader's host routes (ADR 2026-11-03 D4, access): a configured
 * `{ group, path }` reads and opens beside; anything else is refused, and a
 * refusal carries no file content.
 */

import { MessageRouter } from '@/application/handlers/MessageRouter';
import { WorkshopContextHandler } from '@handlers/domain/workshop/WorkshopContextHandler';
import type { WorkshopRoomEffects } from '@handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { ContextResourceContent } from '@/domain/models/ContextGeneration';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { MessageType } from '@messages';
import type { LogSink, ShellService } from '@/platform';
import { createHash } from 'crypto';
import {
  createFakeFileSystem,
  createFakeShellService,
  createFakeWorkspace
} from '../../../../mocks/platform';

const RABBIT_NOTES = 'The White Rabbit checks his watch.\nHe is late for the Duchess.';

const resource = (
  path: string,
  content: string,
  overrides: Partial<ContextResourceContent> = {}
): ContextResourceContent => ({
  group: 'characters',
  path,
  label: path.split('/').pop() ?? path,
  sizeBytes: Buffer.byteLength(content, 'utf8'),
  absolutePath: `/workspace/${path}`,
  content,
  ...overrides
});

const message = (type: MessageType, payload: unknown) => ({
  type,
  source: 'webview.workshop' as const,
  payload,
  timestamp: 1
});

describe('Read in reader routes', () => {
  let router: MessageRouter;
  let shell: ShellService;
  let postMessage: jest.Mock;
  let log: { appendLine: jest.Mock };
  let effects: jest.Mocked<WorkshopRoomEffects>;
  let findReadInRecord: jest.Mock;
  let resources: ContextResourceContent[];
  let loadResources: jest.Mock;

  const contentReplies = () => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT)
    .map((entry) => entry.payload);

  const requestContent = (payload: object, requestId: unknown = 'readin-1') => router.route(
    message(MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE, { requestId, ...payload }) as never
  );

  const openBeside = (payload: unknown) => router.route(
    message(MessageType.WORKSHOP_OPEN_READ_IN_RESOURCE, payload) as never
  );

  const logged = () => log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');

  beforeEach(() => {
    router = new MessageRouter();
    shell = createFakeShellService({ openFileInEditor: jest.fn(async () => undefined) });
    postMessage = jest.fn().mockResolvedValue(undefined);
    log = { appendLine: jest.fn() };
    effects = {
      postSessionState: jest.fn(),
      postTurn: jest.fn(),
      markDirty: jest.fn(),
      reportError: jest.fn(),
      sendStatus: jest.fn(),
      discardConversations: jest.fn()
    };
    findReadInRecord = jest.fn(() => undefined);
    resources = [resource('characters/rabbit.md', RABBIT_NOTES)];
    loadResources = jest.fn(async (paths: string[]) =>
      resources.filter((entry) => paths.includes(entry.path))
    );
    const intake = new WorkshopContextIntakeService(
      {
        createProvider: jest.fn(async () => ({
          listResources: () => resources.map(({ content: _content, ...summary }) => summary),
          loadResources
        }))
      },
      createFakeFileSystem(),
      createFakeWorkspace()
    );
    const handler = new WorkshopContextHandler(
      {} as never,
      new WorkshopSessionService(() => 1),
      shell,
      intake,
      postMessage,
      log as unknown as LogSink,
      { ...effects, findReadInRecord }
    );
    handler.registerRoutes(router, (type, route) => router.register(type, route as never));
  });

  it('serves a configured file\'s current text, echoing the pair it was asked for', async () => {
    await requestContent({ group: 'characters', path: 'characters/rabbit.md' });

    expect(contentReplies()).toEqual([{
      requestId: 'readin-1',
      group: 'characters',
      path: 'characters/rabbit.md',
      content: RABBIT_NOTES,
      canOpenInEditor: true
    }]);
  });

  it('echoes each request\'s own id, so the webview can tell two openings of one file apart (PR #186 F-01)', async () => {
    await requestContent({ group: 'characters', path: 'characters/rabbit.md' }, 'readin-1');
    await requestContent({ group: 'characters', path: 'characters/rabbit.md' }, 'readin-2');
    await requestContent({ group: 'secrets', path: 'characters/rabbit.md' }, 'readin-3');

    expect(contentReplies().map((reply) => reply.requestId)).toEqual(['readin-1', 'readin-2', 'readin-3']);
  });

  it.each([
    ['no request id', undefined],
    ['an empty request id', ''],
    ['a request id that is not a string', 7],
    ['an over-long request id', 'r'.repeat(129)]
  ])('ignores a content request with %s, reading nothing', async (_case, requestId) => {
    await router.route(message(MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE, {
      ...(requestId === undefined ? {} : { requestId }),
      group: 'characters',
      path: 'characters/rabbit.md'
    }) as never);

    expect(contentReplies()).toEqual([]);
    expect(loadResources).not.toHaveBeenCalled();
    expect(logged()).toContain('without its request id was ignored');
  });

  it('resolves a path that differs only in letter case, as resource.read does', async () => {
    await requestContent({ group: 'characters', path: 'Characters/Rabbit.md' });

    expect(contentReplies()[0]).toMatchObject({ path: 'Characters/Rabbit.md', content: RABBIT_NOTES });
  });

  it.each([
    ['a group that is not a configured group id', { group: 'secrets', path: 'characters/rabbit.md' }, 'not one of the configured project-resource groups'],
    ['a group with no configured file at that path', { group: 'locations', path: 'characters/rabbit.md' }, 'not one of the configured project resources'],
    ['a path outside the configured files', { group: 'characters', path: 'characters/duchess.md' }, 'not one of the configured project resources'],
    ['an absolute POSIX path', { group: 'characters', path: '/workspace/characters/rabbit.md' }, 'workspace-relative'],
    ['an absolute Windows path', { group: 'characters', path: 'C:\\workspace\\characters\\rabbit.md' }, 'workspace-relative'],
    ['a file URI', { group: 'characters', path: 'file:///workspace/characters/rabbit.md' }, 'workspace-relative'],
    ['.. traversal', { group: 'characters', path: 'characters/../../etc/passwd' }, 'workspace-relative'],
    ['a missing path', { group: 'characters' }, 'workspace-relative']
  ])('refuses %s without reading or echoing content', async (_case, payload, reason) => {
    await requestContent(payload);

    const [reply] = contentReplies();
    expect(reply.error).toContain(reason);
    expect(reply.content).toBeUndefined();
    expect(reply.canOpenInEditor).toBe(false);
    expect(loadResources).not.toHaveBeenCalled();
    expect(JSON.stringify(reply)).not.toContain('White Rabbit');
  });

  it('refuses a file over resource.read\'s source ceiling before reading it', async () => {
    resources = [resource('characters/rabbit.md', RABBIT_NOTES, {
      sizeBytes: PROMPT_BUDGETS.workshopResource.readSourceBytes + 1
    })];

    await requestContent({ group: 'characters', path: 'characters/rabbit.md' });

    expect(contentReplies()[0].error).toContain('read ceiling');
    expect(loadResources).not.toHaveBeenCalled();
  });

  it('reports a file that vanished between listing and reading as unreadable', async () => {
    loadResources.mockResolvedValueOnce([]);

    await requestContent({ group: 'characters', path: 'characters/rabbit.md' });

    expect(contentReplies()[0]).toMatchObject({ error: 'That file could not be read.', canOpenInEditor: false });
  });

  it('flags truncation at resource.read\'s byte ceiling instead of hiding it', async () => {
    const long = 'Down the rabbit hole. '.repeat(
      Math.ceil(PROMPT_BUDGETS.workshopResource.readBytes / 10)
    );
    resources = [resource('characters/rabbit.md', long)];

    await requestContent({ group: 'characters', path: 'characters/rabbit.md' });

    const [reply] = contentReplies();
    expect(reply.truncated).toBe(true);
    expect(Buffer.byteLength(reply.content, 'utf8')).toBeLessThanOrEqual(
      PROMPT_BUDGETS.workshopResource.readBytes
    );
    expect(long.startsWith(reply.content)).toBe(true);
  });

  it('never logs file content or the requested path', async () => {
    await requestContent({ group: 'characters', path: 'characters/rabbit.md' });
    await requestContent({ group: 'characters', path: '../private/journal.md' });

    expect(logged()).not.toContain('White Rabbit');
    expect(logged()).not.toContain('journal');
    expect(logged()).toContain('refused (unsafe-path)');
  });

  it('opens a configured file beside the Workshop through the shell port', async () => {
    await openBeside({ group: 'characters', path: 'characters/rabbit.md' });

    expect(shell.openFileInEditor).toHaveBeenCalledWith(
      '/workspace/characters/rabbit.md',
      { beside: true }
    );
    expect(effects.reportError).not.toHaveBeenCalled();
  });

  it.each([
    ['an unconfigured group', { group: 'secrets', path: 'characters/rabbit.md' }],
    ['an absolute path', { group: 'characters', path: '/workspace/characters/rabbit.md' }],
    ['.. traversal', { group: 'characters', path: 'characters/../rabbit.md' }],
    ['an unlisted file', { group: 'characters', path: 'characters/duchess.md' }]
  ])('refuses to open %s and reports it on the error path', async (_case, payload) => {
    await openBeside(payload);

    expect(shell.openFileInEditor).not.toHaveBeenCalled();
    expect(effects.reportError).toHaveBeenCalledTimes(1);
  });

  it('reports a shell failure on the error path', async () => {
    (shell.openFileInEditor as jest.Mock).mockRejectedValueOnce(new Error('no editor'));

    await openBeside({ group: 'characters', path: 'characters/rabbit.md' });

    expect(effects.reportError).toHaveBeenCalledWith(
      'Could not open rabbit.md in an editor tab.',
      'no editor'
    );
  });
  describe('provenance for the row the reader opened (Wayfinding Slice 3)', () => {
    const DELIVERED_AT = 1_793_632_440_000;
    const fingerprintOf = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
    const rabbitRow = { group: 'characters', path: 'characters/rabbit.md', deliveredAt: DELIVERED_AT };

    it('says the file is unchanged when it still matches what was read, with the lines read', async () => {
      findReadInRecord.mockReturnValue({ lineRange: { start: 1, end: 2 }, sourceFingerprint: fingerprintOf(RABBIT_NOTES) });

      await requestContent(rabbitRow);

      expect(findReadInRecord).toHaveBeenCalledWith(rabbitRow);
      expect(contentReplies()).toEqual([{
        requestId: 'readin-1',
        group: 'characters',
        path: 'characters/rabbit.md',
        content: RABBIT_NOTES,
        lineRange: { start: 1, end: 2 },
        changedSinceRead: false,
        canOpenInEditor: true
      }]);
    });

    it('says the file changed after it was edited, and never sends the fingerprint', async () => {
      const readFingerprint = fingerprintOf(RABBIT_NOTES);
      findReadInRecord.mockReturnValue({ lineRange: { start: 1, end: 2 }, sourceFingerprint: readFingerprint });
      resources = [resource('characters/rabbit.md', `${RABBIT_NOTES}\nThe Queen is waiting.`)];

      await requestContent(rabbitRow);

      expect(contentReplies()[0]).toMatchObject({ changedSinceRead: true, lineRange: { start: 1, end: 2 } });
      const posted = JSON.stringify(postMessage.mock.calls);
      expect(posted).not.toContain(readFingerprint);
      expect(posted).not.toContain(fingerprintOf(`${RABBIT_NOTES}\nThe Queen is waiting.`));
      expect(logged()).not.toContain(readFingerprint);
    });

    it('says nothing about change for a row that recorded no fingerprint', async () => {
      findReadInRecord.mockReturnValue({});

      await requestContent(rabbitRow);

      expect(contentReplies()[0]).not.toHaveProperty('changedSinceRead');
      expect(contentReplies()[0]).not.toHaveProperty('lineRange');
    });

    it('says nothing about change when no manifest row matches', async () => {
      findReadInRecord.mockReturnValue(undefined);

      await requestContent(rabbitRow);

      expect(contentReplies()[0]).toMatchObject({ content: RABBIT_NOTES, canOpenInEditor: true });
      expect(contentReplies()[0]).not.toHaveProperty('changedSinceRead');
      expect(logged()).toContain('No manifest row matched the read-in request');
    });

    it.each([
      ['no delivery time', {}],
      ['a delivery time that is not a whole number', { deliveredAt: 1.5 }],
      ['a delivery time that is a string', { deliveredAt: '1793632440000' }]
    ])('looks up no row for a request with %s', async (_case, extra) => {
      await requestContent({ group: 'characters', path: 'characters/rabbit.md', ...extra });

      expect(findReadInRecord).not.toHaveBeenCalled();
      expect(contentReplies()[0]).not.toHaveProperty('changedSinceRead');
    });

    it('looks the row up by the resolved file, not the spelling the webview sent', async () => {
      await requestContent({ group: 'characters', path: 'Characters/Rabbit.md', deliveredAt: DELIVERED_AT });

      expect(findReadInRecord).toHaveBeenCalledWith(rabbitRow);
    });

    it('reports an error, and no provenance, when the file is gone', async () => {
      findReadInRecord.mockReturnValue({ lineRange: { start: 1, end: 2 }, sourceFingerprint: fingerprintOf(RABBIT_NOTES) });
      resources = [];

      await requestContent(rabbitRow);

      const [reply] = contentReplies();
      expect(reply.error).toEqual(expect.any(String));
      expect(reply).not.toHaveProperty('content');
      expect(reply).not.toHaveProperty('changedSinceRead');
      expect(reply).not.toHaveProperty('lineRange');
    });
  });
});
