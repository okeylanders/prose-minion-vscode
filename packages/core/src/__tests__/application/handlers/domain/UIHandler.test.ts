/**
 * UIHandler Tests
 * Validates route registration for UI operations (tab changes, file opening)
 */

import { UIHandler } from '@/application/handlers/domain/UIHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';
import {
  createFakeEditorContext,
  createFakeFileSystem,
  createFakeShellService,
  createFakeWorkspace,
} from '../../../mocks/platform';

describe('UIHandler', () => {
  let handler: UIHandler;
  let router: MessageRouter;
  let appendLine: jest.Mock;

  beforeEach(() => {
    appendLine = jest.fn();
    handler = new UIHandler(
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      { appendLine } as any, // outputChannel (LogSink)
      createFakeFileSystem(),
      createFakeWorkspace(),
      createFakeShellService(),
      createFakeEditorContext()
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register UI routes', () => {
      handler.registerRoutes(router);

      const expectedRoutes = [
        MessageType.TAB_CHANGED,
        MessageType.OPEN_GUIDE_FILE,
        MessageType.OPEN_RESOURCE,
        MessageType.REQUEST_SELECTION
      ];

      expectedRoutes.forEach(route => {
        expect(router.hasHandler(route)).toBe(true);
      });
    });

    it('should register at least 4 routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('webview_error', () => {
    // Two producer shapes share this wire: React error paths post the full
    // envelope; the pre-React bootstrap scripts post flat { type, message }.
    // The flat shape used to throw (`payload.message` on undefined) and the
    // real browser error was lost to a routing meta-error (PR #66, Oliver).

    it('logs the envelope shape with message and details', async () => {
      handler.registerRoutes(router);
      await router.route({
        type: MessageType.WEBVIEW_ERROR,
        source: 'webview.error_boundary',
        payload: { message: 'boom', details: 'component stack' },
        timestamp: 0,
      } as any);

      expect(appendLine).toHaveBeenCalledWith('[WEBVIEW ERROR] boom');
      expect(appendLine).toHaveBeenCalledWith('  Details: component stack');
    });

    it('logs the flat bootstrap shape instead of throwing', async () => {
      handler.registerRoutes(router);
      await expect(
        router.route({ type: MessageType.WEBVIEW_ERROR, message: 'bundle 404' } as any)
      ).resolves.not.toThrow();

      expect(appendLine).toHaveBeenCalledWith('[WEBVIEW ERROR] bundle 404');
    });
  });
});
