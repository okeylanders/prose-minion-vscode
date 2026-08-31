import { FileType } from '@/platform';
import {
  MessageType
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  message,
  createWorkshopRouteTestHarness
} from './WorkshopRouteTestHarness';
import type { WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop composed routing — excerpt and scope owner', () => {
  let session: WorkshopRouteTestHarness['session'];
  let postMessage: WorkshopRouteTestHarness['postMessage'];
  let log: WorkshopRouteTestHarness['log'];
  let shell: WorkshopRouteTestHarness['shell'];
  let fileSystem: WorkshopRouteTestHarness['fileSystem'];
  let workspace: WorkshopRouteTestHarness['workspace'];
  let router: WorkshopRouteTestHarness['router'];
  let resourceFiles: WorkshopRouteTestHarness['resourceFiles'];
  let resourceProviderFactory: WorkshopRouteTestHarness['resourceProviderFactory'];
  let posted: WorkshopRouteTestHarness['posted'];
  let pin: WorkshopRouteTestHarness['pin'];

  beforeEach(() => {
    ({
      session,
      postMessage,
      log,
      shell,
      fileSystem,
      workspace,
      router,
      resourceFiles,
      resourceProviderFactory,
      posted,
      pin
    } = createWorkshopRouteTestHarness());
  });

  it('pins a picked file with durable head-slice provenance', async () => {
    const excerptWordCap = PROMPT_BUDGETS.fileExcerpt.words;
    const content = Array.from(
      { length: excerptWordCap + 1 },
      (_, index) => `word${index}`
    ).join(' ');
    shell.pickFile = jest.fn().mockResolvedValue({ fsPath: '/chapter.md', uri: 'file:///chapter.md' });
    fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: content.length });
    fileSystem.readFile = jest.fn().mockResolvedValue(new TextEncoder().encode(content));

    await router.route(message(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {}) as any);

    expect(session.getExcerpt()).toMatchObject({
      source: { kind: 'file', relativePath: 'External file: chapter.md' },
      truncation: { pinnedWords: excerptWordCap, totalWords: excerptWordCap + 1 }
    });
  });

  describe('re-read from file (Sprint 12)', () => {
    const seedFileExcerpt = async (content: string) => {
      workspace.workspaceFolders = () => [{ path: '/ws', name: 'novel' }];
      shell.pickFile = jest.fn().mockResolvedValue({ fsPath: '/ws/chapter.md', uri: 'file:///ws/chapter.md' });
      fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: content.length });
      fileSystem.readFile = jest.fn().mockResolvedValue(new TextEncoder().encode(content));
      await router.route(message(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {}) as any);
    };

    const reread = () =>
      router.route(message(MessageType.WORKSHOP_REREAD_EXCERPT, {}) as any);

    it('refuses when the excerpt is not file-backed', async () => {
      await pin();
      session.setExcerpt({ text: 'Typed text.', source: { kind: 'manual' } });

      await reread();

      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/file-backed/i);
    });

    it('no-ops with a status line when the file is unchanged on disk', async () => {
      await seedFileExcerpt('The sea returns to the shore.');
      const dividersBefore = posted(MessageType.WORKSHOP_TURN).length;

      await reread();

      expect(session.getExcerpt()?.version).toBe(1);
      expect(posted(MessageType.WORKSHOP_TURN)).toHaveLength(dividersBefore);
      expect(posted(MessageType.STATUS).at(-1).payload.message).toMatch(/unchanged/i);
    });

    it('lands on-disk edits as a revision that keeps the original source', async () => {
      await seedFileExcerpt('The sea returns to the shore.');
      fileSystem.readFile = jest.fn().mockResolvedValue(
        new TextEncoder().encode('The sea forgets the shore entirely.')
      );

      await reread();

      expect(session.getExcerpt()).toMatchObject({
        version: 2,
        text: 'The sea forgets the shore entirely.',
        source: { kind: 'file', sourceUri: 'file:///ws/chapter.md', relativePath: 'External file: chapter.md' }
      });
    });

    it('revises a head-sliced excerpt when only content beyond the visible head changed', async () => {
      const excerptWordCap = PROMPT_BUDGETS.fileExcerpt.words;
      const original = Array.from(
        { length: excerptWordCap + 1 },
        (_, index) => `word${index}`
      ).join(' ');
      const revised = `${Array.from(
        { length: excerptWordCap },
        (_, index) => `word${index}`
      ).join(' ')} changed-ending`;
      await seedFileExcerpt(original);
      const pinnedText = session.getExcerpt()!.text;
      fileSystem.readFile = jest.fn().mockResolvedValue(new TextEncoder().encode(revised));

      await reread();

      expect(session.getExcerpt()).toMatchObject({
        version: 2,
        text: pinnedText,
        truncation: { pinnedWords: excerptWordCap, totalWords: excerptWordCap + 1 }
      });
    });

    it('reconnects a moved workspace excerpt and repairs its persisted source URI', async () => {
      workspace.workspaceFolders = () => [{ path: '/new/novel', name: 'novel' }];
      const bytes = new TextEncoder().encode('The moved draft changed.');
      fileSystem.stat = jest.fn().mockResolvedValue({
        type: FileType.File,
        size: bytes.length
      });
      fileSystem.readFile = jest.fn().mockResolvedValue(bytes);
      session.setExcerpt({
        text: 'The old draft.',
        source: {
          kind: 'file',
          sourceUri: 'file:///old/novel/Drafts/chapter-5.9.md',
          relativePath: 'Drafts/chapter-5.9.md'
        }
      });

      await reread();

      expect(fileSystem.readFile).toHaveBeenCalledWith('/new/novel/Drafts/chapter-5.9.md');
      expect(session.getExcerpt()).toMatchObject({
        version: 2,
        text: 'The moved draft changed.',
        source: {
          kind: 'file',
          sourceUri: 'file:///new/novel/Drafts/chapter-5.9.md',
          relativePath: 'Drafts/chapter-5.9.md'
        }
      });
    });

    it('repairs moved provenance without inventing a revision when content is unchanged', async () => {
      workspace.workspaceFolders = () => [{ path: '/new/novel', name: 'novel' }];
      const content = 'The same draft.';
      const bytes = new TextEncoder().encode(content);
      fileSystem.stat = jest.fn().mockResolvedValue({
        type: FileType.File,
        size: bytes.length
      });
      fileSystem.readFile = jest.fn().mockResolvedValue(bytes);
      session.setExcerpt({
        text: content,
        source: {
          kind: 'file',
          sourceUri: 'file:///old/novel/Drafts/chapter-5.9.md',
          relativePath: 'Drafts/chapter-5.9.md'
        }
      });
      const turnsBefore = session.getSnapshot().turns.length;

      await reread();

      expect(session.getExcerpt()).toMatchObject({
        version: 1,
        source: { sourceUri: 'file:///new/novel/Drafts/chapter-5.9.md' }
      });
      expect(session.getSnapshot().turns).toHaveLength(turnsBefore);
      expect(posted(MessageType.STATUS).at(-1).payload.message).toMatch(/unchanged/i);
    });

    it('refuses portable recovery when multiple workspace roots are open', async () => {
      workspace.workspaceFolders = () => [
        { path: '/new/novel', name: 'novel' },
        { path: '/new/notes', name: 'notes' }
      ];
      const readFile = jest.fn();
      fileSystem.readFile = readFile;
      session.setExcerpt({
        text: 'Persisted safe text.',
        source: {
          kind: 'file',
          sourceUri: 'file:///old/novel/Drafts/chapter-5.9.md',
          relativePath: 'Drafts/chapter-5.9.md'
        }
      });

      await reread();

      expect(readFile).not.toHaveBeenCalled();
      expect(posted(MessageType.ERROR).at(-1).payload.message)
        .toMatch(/more than one workspace folder/i);
    });

    it('applies symlink checks to a recovered workspace-relative path', async () => {
      workspace.workspaceFolders = () => [{ path: '/new/novel', name: 'novel' }];
      const readFile = jest.fn();
      fileSystem.stat = jest.fn().mockImplementation(async (filePath: string) => ({
        type: filePath === '/new/novel/Drafts' ? FileType.SymbolicLink : FileType.File,
        size: 10
      }));
      fileSystem.readFile = readFile;
      session.setExcerpt({
        text: 'Persisted safe text.',
        source: {
          kind: 'file',
          sourceUri: 'file:///old/novel/Drafts/chapter-5.9.md',
          relativePath: 'Drafts/chapter-5.9.md'
        }
      });

      await reread();

      expect(readFile).not.toHaveBeenCalled();
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/symbolic link/i);
    });

    it('refuses a normalized traversal outside the workspace despite a forged catalog claim', async () => {
      workspace.workspaceFolders = () => [{ path: '/ws', name: 'novel' }];
      const readFile = jest.fn();
      fileSystem.readFile = readFile;
      session.setExcerpt({
        text: 'Persisted safe text.',
        source: {
          kind: 'file',
          sourceUri: 'file:///ws/chapters/../../private/secret.md',
          relativePath: '../private/secret.md',
          configuredResource: { group: 'characters', path: 'Characters/raven.md' }
        }
      });

      await reread();

      expect(readFile).not.toHaveBeenCalled();
      expect(session.getExcerpt()).toMatchObject({ version: 1, text: 'Persisted safe text.' });
      expect(posted(MessageType.ERROR).at(-1).payload.message)
        .toMatch(/outside the approved workspace/i);
    });

    it('refuses a non-file source URI before opening or reading it', async () => {
      const readFile = jest.fn();
      fileSystem.readFile = readFile;
      resourceProviderFactory.createProvider.mockClear();
      session.setExcerpt({
        text: 'Persisted safe text.',
        source: {
          kind: 'file',
          sourceUri: 'https://example.com/private.md',
          relativePath: 'private.md'
        }
      });

      await reread();

      expect(resourceProviderFactory.createProvider).not.toHaveBeenCalled();
      expect(readFile).not.toHaveBeenCalled();
      expect(posted(MessageType.ERROR).at(-1).payload.message)
        .toMatch(/source location is no longer readable/i);
    });

    it('refuses a workspace path with a symbolic-link ancestor before reading', async () => {
      workspace.workspaceFolders = () => [{ path: '/ws', name: 'novel' }];
      const readFile = jest.fn();
      fileSystem.stat = jest.fn().mockImplementation(async (filePath: string) => ({
        type: filePath === '/ws/linked' ? FileType.SymbolicLink : FileType.File,
        size: 10
      }));
      fileSystem.readFile = readFile;
      session.setExcerpt({
        text: 'Persisted safe text.',
        source: {
          kind: 'file',
          sourceUri: 'file:///ws/linked/secret.md',
          relativePath: 'linked/secret.md'
        }
      });

      await reread();

      expect(readFile).not.toHaveBeenCalled();
      expect(posted(MessageType.ERROR).at(-1).payload.message)
        .toMatch(/symbolic link/i);
    });

    it('applies the host platform case policy to an external catalog match', async () => {
      resourceFiles.push({
        group: 'general',
        path: 'Shared/Approved.md',
        label: 'approved',
        sizeBytes: 24,
        absolutePath: '/shared/Approved.md',
        content: 'Fresh configured content.'
      });
      const bytes = new TextEncoder().encode('Fresh configured content.');
      const readFile = jest.fn().mockResolvedValue(bytes);
      fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: bytes.length });
      fileSystem.readFile = readFile;
      session.setExcerpt({
        text: 'Earlier configured content.',
        source: {
          kind: 'file',
          sourceUri: 'file:///shared/approved.md',
          relativePath: 'Shared/approved.md'
        }
      });

      await reread();

      if (process.platform === 'win32') {
        expect(readFile).toHaveBeenCalledWith('/shared/approved.md');
      } else {
        expect(readFile).not.toHaveBeenCalled();
        expect(posted(MessageType.ERROR).at(-1).payload.message)
          .toMatch(/outside the approved workspace/i);
      }
    });

    it('allows an exact fresh configured-catalog source outside the workspace', async () => {
      resourceFiles.push({
        group: 'general',
        path: 'Shared/approved.md',
        label: 'approved',
        sizeBytes: 24,
        absolutePath: '/shared/approved.md',
        content: 'Fresh configured content.'
      });
      const bytes = new TextEncoder().encode('Fresh configured content.');
      fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: bytes.length });
      fileSystem.readFile = jest.fn().mockResolvedValue(bytes);
      session.setExcerpt({
        text: 'Earlier configured content.',
        source: {
          kind: 'file',
          sourceUri: 'file:///shared/approved.md',
          relativePath: 'Shared/approved.md'
        }
      });

      await reread();

      expect(fileSystem.readFile).toHaveBeenCalledWith('/shared/approved.md');
      expect(session.getExcerpt()).toMatchObject({
        version: 2,
        text: 'Fresh configured content.',
        source: {
          configuredResource: { group: 'general', path: 'Shared/approved.md' }
        }
      });
    });
  });

  describe('Context Selector routes (Sprint 12 Phase 4)', () => {
    it('sets the excerpt from one configured resource with canonical provenance', async () => {
      await router.route(message(
        MessageType.WORKSHOP_SET_EXCERPT_RESOURCE,
        { group: 'characters', path: 'Characters/raven.md' }
      ) as any);

      expect(session.getExcerpt()).toMatchObject({
        version: 1,
        text: 'Raven is seventeen and keeps the marked token.',
        source: {
          kind: 'file',
          sourceUri: 'file:///ws/Characters/raven.md',
          relativePath: 'Characters/raven.md',
          configuredResource: { group: 'characters', path: 'Characters/raven.md' }
        }
      });
    });

    it('refuses an excerpt resource outside the configured catalog', async () => {
      await router.route(message(
        MessageType.WORKSHOP_SET_EXCERPT_RESOURCE,
        { group: 'characters', path: 'Characters/ghost.md' }
      ) as any);

      expect(session.getExcerpt()).toBeUndefined();
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/no longer in the configured catalog/i);
    });
  });

  describe('excerpt-source canonical resolution (Phase 6)', () => {
    it('re-derives configuredResource host-side from the resolver\u2019s absolutePath, overriding webview claims', async () => {
      await router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
        text: 'Raven keeps the token.',
        source: {
          kind: 'editor-selection',
          sourceUri: 'file:///ws/Characters/raven.md',
          relativePath: 'Characters/raven.md',
          startLine: 4,
          endLine: 9,
          // A forged claim from the webview must not survive re-derivation.
          configuredResource: { group: 'themes', path: 'Themes/echoes.md' }
        }
      }) as any);

      expect(session.getSnapshot().excerpt?.source).toMatchObject({
        kind: 'editor-selection',
        relativePath: 'Characters/raven.md',
        startLine: 4,
        endLine: 9,
        configuredResource: { group: 'characters', path: 'Characters/raven.md' }
      });
    });

    it('leaves a source outside the configured catalog honestly unstamped', async () => {
      await pin();

      expect(session.getSnapshot().excerpt?.source).toMatchObject({
        kind: 'file',
        relativePath: 'chapter-one.md'
      });
      expect((session.getSnapshot().excerpt?.source as { configuredResource?: unknown; }).configuredResource).toBeUndefined();
    });

    it('fails safe on an ambiguous case-folded match instead of guessing', async () => {
      resourceFiles.push({
        group: 'characters',
        path: 'Characters/RAVEN.md',
        label: 'RAVEN',
        sizeBytes: 120,
        absolutePath: '/ws/Characters/RAVEN.md',
        content: 'Duplicate-cased sibling.'
      });

      await router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
        text: 'Raven keeps the token.',
        source: {
          kind: 'file',
          sourceUri: 'file:///ws/characters/raven.md',
          relativePath: 'characters/raven.md'
        }
      }) as any);

      expect((session.getSnapshot().excerpt?.source as { configuredResource?: unknown; }).configuredResource).toBeUndefined();
      expect((log.appendLine as jest.Mock).mock.calls.flat().join('\n'))
        .toContain('letter case is ignored');
    });

    it('survives an unreadable catalog by pinning without a canonical key', async () => {
      resourceProviderFactory.createProvider.mockRejectedValueOnce(new Error('glob failed'));

      await router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
        text: 'Raven keeps the token.',
        source: {
          kind: 'file',
          sourceUri: 'file:///ws/Characters/raven.md',
          relativePath: 'Characters/raven.md'
        }
      }) as any);

      expect(session.getSnapshot().excerpt?.text).toBe('Raven keeps the token.');
      expect((session.getSnapshot().excerpt?.source as { configuredResource?: unknown; }).configuredResource).toBeUndefined();
    });
  });

  describe('Open Chat (Sprint 13A)', () => {
    const chooseOpen = () => router.route(
      message(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'open' }) as any
    );

    const send = (text: string) => router.route(
      message(MessageType.WORKSHOP_SEND_MESSAGE, { text }) as any
    );

    it('refuses to adopt an excerpt once the conversation has started', async () => {
      await chooseOpen();
      await send('Help me plan the next scene.');
      const conversationId = session.getHostConversationId();

      await pin();

      expect(session.getScope()).toBe('open');
      expect(session.getExcerpt()).toBeUndefined();
      expect(session.getHostConversationId()).toBe(conversationId);
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: expect.objectContaining({
            message: expect.stringContaining('Start a new session')
          })
        })
      );
    });

    it('refuses to shelve a passage the host has already read', async () => {
      await pin();
      await send('Read this for me.');

      await chooseOpen();

      expect(session.getScope()).toBe('excerpt');
      expect(session.getExcerpt()?.version).toBe(1);
      expect(session.getShelvedExcerpt()).toBeUndefined();
      expect(log.appendLine).toHaveBeenCalledWith(
        expect.stringContaining(
          'ERROR [workshop]: Start a new session to change this'
        )
      );
    });

    it('re-pins the shelved passage before the room has a memory', async () => {
      await pin();
      await chooseOpen();
      await router.route(message(MessageType.WORKSHOP_REPIN_EXCERPT, {}) as any);

      expect(session.getScope()).toBe('excerpt');
      expect(session.getExcerpt()?.version).toBe(1);
      expect(session.getShelvedExcerpt()).toBeUndefined();
    });

    it('rejects an unknown scope without touching the room', async () => {
      await pin();
      await router.route(
        message(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'whatever' }) as any
      );

      expect(session.getScope()).toBe('excerpt');
      expect(posted(MessageType.ERROR).at(-1)?.payload.message).toContain('Unknown Workshop session scope');
    });
  });
});
