/**
 * FileOperationsHandler Tests
 * Validates route registration for file operations (save, export)
 */

import { FileOperationsHandler } from '@/application/handlers/domain/FileOperationsHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';
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
