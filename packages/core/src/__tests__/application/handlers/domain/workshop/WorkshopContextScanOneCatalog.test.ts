/**
 * A context scan builds the project's catalog once (tech debt 2026-11-18).
 *
 * Opening a room re-checks every file-backed context attachment; each check
 * used to authorize its file against a catalog of its own, so a room with N
 * attachments ran the catalog's whole file search N times. Here the real
 * `ContextResourceResolver` lists a synthetic project through a fake
 * workspace that counts its searches, and the real intake service and
 * context handler run the scan. Every outcome (changed, unchanged, refused)
 * is the one each file earned before. *Alice*, with made-up paths and text.
 */
import * as path from 'node:path';
import type { LogSink, Workspace } from '@/platform';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopContextHandler } from '@handlers/domain/workshop/WorkshopContextHandler';
import { CONTEXT_PATH_GROUPS } from '@shared/types/context';
import { FolderFileSystem } from '../../../services/workshop/pinnedContext/pinnedContextSeedHost';
import { createFakeSettings, createFakeShellService } from '../../../../mocks/platform';

const ROOT = '/workspace/wonderland';
const FILES_PER_GROUP = 44; // 8 groups × 44 = 352 files, about Okey's 346
const ATTACHMENTS = 28;

function project() {
  const fileSystem = new FolderFileSystem();
  const write = (relativePath: string, text: string) =>
    fileSystem.files.set(path.join(ROOT, relativePath), new TextEncoder().encode(text));
  for (const group of CONTEXT_PATH_GROUPS) {
    for (let index = 0; index < FILES_PER_GROUP; index += 1) {
      write(`${group}/note-${index}.md`, `Alice wrote ${group} note ${index}.`);
    }
  }
  let searches = 0;
  const workspace: Workspace = {
    workspaceFolders: () => [{ path: ROOT, name: 'wonderland' }],
    extensionPath: '/extension',
    asRelativePath: (value) => value.startsWith(`${ROOT}/`) ? value.slice(ROOT.length + 1) : value,
    findFiles: async (root, pattern) => {
      searches += 1;
      const prefix = path.join(root, pattern.split('/')[0]) + path.sep;
      return [...fileSystem.files.keys()].filter((file) => file.startsWith(prefix) && file.endsWith('.md'));
    }
  };
  const settings = createFakeSettings(Object.fromEntries(
    CONTEXT_PATH_GROUPS.map((group) => [`contextPaths.${group}`, `${group}/**/*.md`])
  ));
  const lines: string[] = [];
  const log: LogSink = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() };
  const resolver = new ContextResourceResolver(settings, fileSystem, workspace, log);
  const createProvider = jest.spyOn(resolver, 'createProvider');
  const intake = new WorkshopContextIntakeService(resolver, fileSystem, workspace);
  const session = new WorkshopSessionService(() => 1);
  const effects = {
    postSessionState: jest.fn(),
    postTurn: jest.fn(),
    markDirty: jest.fn(),
    reportError: jest.fn(),
    sendStatus: jest.fn(),
    discardConversations: jest.fn(),
    findReadInRecord: jest.fn()
  };
  const handler = new WorkshopContextHandler(
    { generateContext: jest.fn() } as never,
    session,
    createFakeShellService(),
    intake,
    jest.fn().mockResolvedValue(undefined),
    log,
    effects
  );
  const attach = (relativePath: string, content: string, configured?: string) => {
    const added = session.addContextAttachment({
      kind: 'file',
      origin: 'writer',
      label: path.posix.basename(relativePath),
      content,
      words: content.split(' ').length,
      sourceUri: `file://${path.join(ROOT, relativePath)}`,
      relativePath,
      ...(configured ? { configuredResource: { group: configured as never, path: relativePath } } : {})
    });
    if (!added.ok) {
      throw new Error(`could not attach ${relativePath}`);
    }
  };
  return { fileSystem, write, searches: () => searches, createProvider, lines, session, handler, attach, effects };
}

/** 28 attachments as a long room holds them: unchanged, changed, gone, and outside the project. */
function longRoom() {
  const host = project();
  for (let index = 0; index < ATTACHMENTS - 2; index += 1) {
    const group = CONTEXT_PATH_GROUPS[index % CONTEXT_PATH_GROUPS.length];
    const note = Math.floor(index / CONTEXT_PATH_GROUPS.length);
    const relativePath = `${group}/note-${note}.md`;
    const current = `Alice wrote ${group} note ${note}.`;
    // Every fifth file has changed since the room last read it.
    host.attach(relativePath, index % 5 === 0 ? 'An older copy.' : current, index % 2 === 0 ? group : undefined);
  }
  host.attach('characters/the-cheshire-cat.md', 'A grin, since deleted.');
  host.session.addContextAttachment({
    kind: 'file', origin: 'writer', label: 'rabbit-hole.md', content: 'Outside.', words: 1,
    sourceUri: 'file:///elsewhere/rabbit-hole.md', relativePath: 'rabbit-hole.md'
  });
  return host;
}

const scanLines = (lines: string[]) => lines.filter((line) => line.includes('Context scan'));

describe('a context scan builds the catalog once', () => {
  it.each(['session-open', 'manual'] as const)('a %s scan of 28 attachments opens one catalog', async (origin) => {
    const host = longRoom();

    await host.handler.refreshChangedContextFiles(origin);

    expect(host.createProvider).toHaveBeenCalledTimes(1);
    expect(host.searches()).toBe(CONTEXT_PATH_GROUPS.length);
    const changed = host.session.getContextAttachments().filter((attachment) => attachment.content === 'An older copy.');
    expect(changed).toEqual([]);
    expect(scanLines(host.lines)).toEqual([
      expect.stringMatching(new RegExp(`^\\[WorkshopContextHandler\\] Context scan \\(${origin}\\): 28 checked, 6 changed, 2 refused, \\d+ ms$`))
    ]);
  });

  it('keeps every per-file check: a symbolic link inside the project is still refused', async () => {
    const host = longRoom();
    const stat = host.fileSystem.stat.bind(host.fileSystem);
    jest.spyOn(host.fileSystem, 'stat').mockImplementation(async (filePath) => {
      const result = await stat(filePath);
      return filePath === path.join(ROOT, 'locations') ? { ...result, type: result.type | 64 } : result;
    });

    await host.handler.refreshChangedContextFiles('manual');

    expect(host.createProvider).toHaveBeenCalledTimes(1);
    expect(host.effects.sendStatus.mock.calls.flat().join('\n')).toContain('cannot be re-read through a symbolic link');
  });

  it('the scan line names no file', async () => {
    const host = longRoom();

    await host.handler.refreshChangedContextFiles('session-open');

    const [line] = scanLines(host.lines);
    expect(line).not.toMatch(/note-|cheshire|rabbit|characters|wonderland/);
  });

  it('a second scan opens a fresh catalog: nothing is kept across operations', async () => {
    const host = longRoom();

    await host.handler.refreshChangedContextFiles('session-open');
    host.write('characters/note-0.md', 'Alice changed her mind.');
    await host.handler.refreshChangedContextFiles('manual');

    expect(host.createProvider).toHaveBeenCalledTimes(2);
    expect(host.session.getContextAttachments()[0].content).toBe('Alice changed her mind.');
  });
});
