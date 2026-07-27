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
  createFakeGlobalState,
  createFakeShellService,
  createFakeWorkspace,
} from '../../../mocks/platform';
import {
  WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY,
  WORKSHOP_STARTUP_NOTICE_VERSION
} from '@shared/constants/workshopNotices';

describe('UIHandler', () => {
  let handler: UIHandler;
  let router: MessageRouter;
  let postMessage: jest.Mock;
  let appendLine: jest.Mock;

  beforeEach(() => {
    postMessage = jest.fn().mockResolvedValue(undefined);
    appendLine = jest.fn();
    handler = new UIHandler(
      postMessage as any, // postMessage
      { appendLine } as any, // outputChannel (LogSink)
      createFakeFileSystem(),
      createFakeWorkspace(),
      createFakeShellService(),
      createFakeEditorContext(),
      createFakeGlobalState()
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
        MessageType.REQUEST_SELECTION,
        MessageType.OPEN_WORKSHOP,
        MessageType.REQUEST_STARTUP_NOTICE,
        MessageType.DISMISS_STARTUP_NOTICE
      ];

      expectedRoutes.forEach(route => {
        expect(router.hasHandler(route)).toBe(true);
      });
    });

    it('should register at least 4 routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBe(9);
    });
  });

  describe('startup notice', () => {
    const request = { type: MessageType.REQUEST_STARTUP_NOTICE, source: 'webview.workshop', payload: {}, timestamp: 1 };

    it('answers shouldShow=true when no dismissal is recorded', async () => {
      handler.registerRoutes(router);
      await router.route(request as any);

      expect(postMessage).toHaveBeenCalledTimes(1);
      const posted = postMessage.mock.calls[0][0];
      expect(posted.type).toBe(MessageType.STARTUP_NOTICE_DATA);
      expect(posted.payload).toEqual({
        shouldShow: true,
        noticeVersion: WORKSHOP_STARTUP_NOTICE_VERSION
      });
    });

    it('answers shouldShow=false once THIS version was dismissed, true for a stale one', async () => {
      const store: Record<string, unknown> = {};
      handler = new UIHandler(
        postMessage as any,
        { appendLine } as any,
        createFakeFileSystem(),
        createFakeWorkspace(),
        createFakeShellService(),
        createFakeEditorContext(),
        createFakeGlobalState(store)
      );
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.DISMISS_STARTUP_NOTICE,
        source: 'webview.workshop',
        payload: { noticeVersion: WORKSHOP_STARTUP_NOTICE_VERSION },
        timestamp: 1
      } as any);
      expect(store[WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY]).toBe(WORKSHOP_STARTUP_NOTICE_VERSION);

      await router.route(request as any);
      expect(postMessage.mock.calls[0][0].payload.shouldShow).toBe(false);

      // A revised notice version re-shows the box (Sprint 14 §5 contract).
      store[WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY] = 'v0-stale';
      await router.route(request as any);
      expect(postMessage.mock.calls[1][0].payload.shouldShow).toBe(true);
    });

    it('ignores a dismissal without a version instead of recording garbage', async () => {
      const store: Record<string, unknown> = {};
      handler = new UIHandler(
        postMessage as any,
        { appendLine } as any,
        createFakeFileSystem(),
        createFakeWorkspace(),
        createFakeShellService(),
        createFakeEditorContext(),
        createFakeGlobalState(store)
      );
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.DISMISS_STARTUP_NOTICE,
        source: 'webview.workshop',
        payload: {},
        timestamp: 1
      } as any);

      expect(store[WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY]).toBeUndefined();
    });
  });

  describe('open_workshop', () => {
    it('delegates to the injected Workshop UI action', async () => {
      const openWorkshop = jest.fn();
      handler = new UIHandler(
        postMessage as any,
        { appendLine } as any,
        createFakeFileSystem(),
        createFakeWorkspace(),
        createFakeShellService(),
        createFakeEditorContext(),
        createFakeGlobalState(),
        { openWorkshop }
      );
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.OPEN_WORKSHOP,
        source: 'webview.analysis',
        payload: {},
        timestamp: 0,
      } as any);

      expect(openWorkshop).toHaveBeenCalledTimes(1);
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('reports a ui.workshop error when no Workshop action is available', async () => {
      handler.registerRoutes(router);

      await router.route({
        type: MessageType.OPEN_WORKSHOP,
        source: 'webview.analysis',
        payload: {},
        timestamp: 0,
      } as any);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: expect.objectContaining({
            source: 'ui.workshop',
            message: 'Workshop is not available from this surface.'
          })
        })
      );
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
