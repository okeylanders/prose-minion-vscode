/**
 * FileOperationsHandler Tests
 * Validates route registration for file operations (save, export)
 */

import { FileOperationsHandler } from '@/application/handlers/domain/FileOperationsHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';
import { GESTURE_DICTIONARY_RESULT_TOOL_NAME } from '@shared/constants/resultToolNames';
import { MemoryFileSystem } from '../../../mocks/MemoryFileSystem';
import {
  createFakeFileSystem,
  createFakeShellService,
  createFakeWorkspace,
} from '../../../mocks/platform';

describe('FileOperationsHandler', () => {
  let handler: FileOperationsHandler;
  let router: MessageRouter;
  let mockPostMessage: jest.Mock;
  let appendLine: jest.Mock;

  beforeEach(() => {
    mockPostMessage = jest.fn().mockResolvedValue(undefined);
    appendLine = jest.fn();

    handler = new FileOperationsHandler(
      mockPostMessage,
      createFakeFileSystem(),
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/workspace', name: 'workspace', uriString: 'file:///workspace' }],
        asRelativePath: (p) => p.replace('/workspace/', '')
      }),
      createFakeShellService(),
      { appendLine } as any // outputChannel (LogSink)
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register SAVE_RESULT route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.SAVE_RESULT)).toBe(true);
    });

    it('should register at least 1 route', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBe(2);
    });
  });

  describe('copy_result', () => {
    it('posts structured copy success instead of requiring status prose parsing', async () => {
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.COPY_RESULT,
        source: 'webview.workshop',
        payload: {
          toolName: 'dialogue_analysis',
          content: 'Copied text'
        },
        timestamp: 0
      } as any);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.COPY_RESULT_SUCCESS,
          source: 'extension.file_ops',
          payload: { toolName: 'dialogue_analysis' }
        })
      );
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.STATUS,
          payload: expect.objectContaining({ message: 'Result copied to clipboard.' })
        })
      );
    });
  });

  describe('save_result', () => {
    it('saves a new dictionary word under its plain filename', async () => {
      const fileSystem = new MemoryFileSystem();
      const saveHandler = new FileOperationsHandler(
        mockPostMessage,
        fileSystem,
        createFakeWorkspace({
          workspaceFolders: () => [{ path: '/workspace', name: 'workspace', uriString: 'file:///workspace' }],
          asRelativePath: (p) => p.replace('/workspace/', '')
        }),
        createFakeShellService(),
        { appendLine } as any
      );

      await saveHandler.handleSaveResult({
        type: MessageType.SAVE_RESULT,
        source: 'webview.utilities.tab',
        payload: { toolName: 'dictionary_lookup', content: 'First entry', metadata: { word: 'Commanding' } },
        timestamp: 0
      });

      const filePath = '/workspace/prose-minion/dictionary-entries/commanding.md';
      expect(new TextDecoder().decode(fileSystem.files.get(filePath))).toBe('First entry');
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SAVE_RESULT_SUCCESS,
        payload: { toolName: 'dictionary_lookup', filePath: 'prose-minion/dictionary-entries/commanding.md' }
      }));
      expect(fileSystem.renameCalls).toEqual([expect.objectContaining({ toPath: filePath, overwrite: false })]);
    });

    it('numbers repeat dictionary saves without replacing an existing entry', async () => {
      const fileSystem = new MemoryFileSystem();
      const directory = '/workspace/prose-minion/dictionary-entries';
      fileSystem.files.set(`${directory}/commanding.md`, new TextEncoder().encode('Original entry'));
      const saveHandler = new FileOperationsHandler(
        mockPostMessage,
        fileSystem,
        createFakeWorkspace({
          workspaceFolders: () => [{ path: '/workspace', name: 'workspace', uriString: 'file:///workspace' }],
          asRelativePath: (p) => p.replace('/workspace/', '')
        }),
        createFakeShellService(),
        { appendLine } as any
      );
      const save = (toolName: string, content: string) => saveHandler.handleSaveResult({
        type: MessageType.SAVE_RESULT,
        source: 'webview.utilities.tab',
        payload: { toolName, content, metadata: { word: 'Commanding' } },
        timestamp: 0
      });

      await Promise.all([
        save('dictionary_lookup', 'Second entry'),
        save('dictionary_fast_generate', 'Third entry')
      ]);

      const read = (name: string) => new TextDecoder().decode(fileSystem.files.get(`${directory}/${name}`));
      expect(read('commanding.md')).toBe('Original entry');
      expect(new Set([read('commanding-2.md'), read('commanding-3.md')]))
        .toEqual(new Set(['Second entry', 'Third entry']));
      expect(fileSystem.renameCalls).toHaveLength(2);
      expect(fileSystem.renameCalls.every(call => call.overwrite === false)).toBe(true);
      expect([...fileSystem.files.keys()].filter(filePath => filePath.endsWith('.tmp'))).toHaveLength(0);
    });

    it('saves attributed Workshop persona synthesis through the closed allowlist', async () => {
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.SAVE_RESULT,
        source: 'webview.workshop',
        payload: {
          toolName: 'workshop_persona',
          content: 'Jill synthesis',
          metadata: { excerpt: 'Pinned prose', context: 'Jill · persona synthesis' }
        },
        timestamp: 0
      } as any);

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SAVE_RESULT_SUCCESS,
        payload: expect.objectContaining({
          toolName: 'workshop_persona',
          filePath: expect.stringContaining('workshop-persona-1.md')
        })
      }));
    });

    it('saves a Gesture Dictionary through its named assistant result contract', async () => {
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.SAVE_RESULT,
        source: 'webview.workshop.gesture-playground',
        payload: {
          toolName: GESTURE_DICTIONARY_RESULT_TOOL_NAME,
          content: '# Gesture Dictionary\n\nA useful craft scan.',
          metadata: {
            excerpt: 'Pinned prose',
            context: 'Gesture Playground · Gesture Dictionary'
          }
        },
        timestamp: 0
      } as any);

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SAVE_RESULT_SUCCESS,
        payload: expect.objectContaining({
          toolName: GESTURE_DICTIONARY_RESULT_TOOL_NAME,
          filePath: expect.stringContaining('gesture-dictionary-1.md')
        })
      }));
    });

    it('rejects unsupported assistant tool names before they become file prefixes', async () => {
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.SAVE_RESULT,
        source: 'webview.workshop',
        payload: {
          toolName: 'writing_tools_../../../../tmp/pwned',
          content: 'Bad path'
        },
        timestamp: 0
      } as any);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: expect.objectContaining({
            source: 'file_ops.save',
            message: 'Failed to save result',
            details: expect.stringContaining('not supported')
          })
        })
      );
      expect(appendLine).toHaveBeenCalledWith(expect.stringContaining('[FileOpsHandler] ERROR file_ops.save'));
    });
  });
});
