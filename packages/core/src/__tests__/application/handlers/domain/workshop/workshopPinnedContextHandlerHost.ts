/**
 * The Pinned context tab's handler over the real library, store and intake
 * service on a memory folder, with a real session aggregate (Pinned Context
 * Slice 3): shared by the handler's tests. *Alice*, with made-up paths.
 */
import * as path from 'node:path';
import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopPinnedContextHandler } from '@handlers/domain/workshop/WorkshopPinnedContextHandler';
import type { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { decodeWorkshopPinnedContext } from '@/infrastructure/storage/WorkshopPinnedContextCodec';
import type { WorkshopRoomSeedReport } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { MessageType, type WorkshopPinnedContextPayload } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIST_FILE, ROOT, seedHost } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';

export const BUDGET = PROMPT_BUDGETS.contextAttachments.words;

export function harness(options: Parameters<typeof seedHost>[0] & { report?: WorkshopRoomSeedReport } = {}) {
  const host = seedHost(options);
  const session = new WorkshopSessionService(() => 1);
  const posted: WorkshopPinnedContextPayload[] = [];
  const postMessage = jest.fn(async (message: { type: MessageType; payload: unknown }) => {
    if (message.type === MessageType.WORKSHOP_PINNED_CONTEXT) {
      posted.push(message.payload as WorkshopPinnedContextPayload);
    }
  });
  const shell = {
    openFileInEditor: jest.fn(async () => undefined),
    pickFile: jest.fn(async (_options?: { defaultPath?: string }): Promise<{ fsPath: string; uri: string } | undefined> => undefined)
  };
  const effects = {
    postSessionState: jest.fn(),
    postTurn: jest.fn(),
    markDirty: jest.fn(),
    sendStatus: jest.fn(),
    activeRunLabel: jest.fn((): string | undefined => undefined),
    roomReady: jest.fn(async () => undefined)
  };
  let report = options.report;
  const takeFirstRoomReport = jest.fn(() => {
    const taken = report;
    report = undefined;
    return taken;
  });
  const handler = new WorkshopPinnedContextHandler(
    { library: host.library, takeFirstRoomReport },
    session,
    shell as never,
    postMessage as never,
    host.log,
    effects
  );
  const router = new MessageRouter();
  const gate = { pending: false };
  const registerMutation: WorkshopMutationRouteRegistrar = (type, handle, _action, onBlocked) => {
    router.register(type, async (message) => {
      if (gate.pending) {
        onBlocked?.('Wait for the current session save or replacement to finish before changing the room.', message as never);
        return;
      }
      await handle(message as never);
    });
  };
  handler.registerRoutes(router, registerMutation);
  let next = 0;
  const send = async (type: MessageType, payload: Record<string, unknown>): Promise<WorkshopPinnedContextPayload> => {
    const requestId = `req-${++next}`;
    await router.route({ type, source: 'webview.test', payload: { requestId, ...payload }, timestamp: 0 } as never);
    await new Promise((resolve) => setImmediate(resolve));
    const answer = posted.filter((entry) => entry.requestId === requestId).at(-1);
    if (!answer) {
      throw new Error(`no answer for ${type}`);
    }
    return answer;
  };
  const listOnDisk = () => {
    const bytes = host.fileSystem.files.get(LIST_FILE);
    if (!bytes) {
      return undefined;
    }
    const decoded = decodeWorkshopPinnedContext(bytes, 'posix');
    return decoded.ok ? decoded.list.files.map((entry) => entry.path) : decoded;
  };
  const attachFile = (relativePath: string, configured: boolean) => {
    const result = session.addContextAttachment({
      kind: 'file',
      origin: 'writer',
      label: path.posix.basename(relativePath),
      content: 'Alice was beginning to get very tired.',
      words: 7,
      sourceUri: `file://${ROOT}/${relativePath}`,
      relativePath,
      ...(configured ? { configuredResource: { group: 'characters' as const, path: relativePath } } : {})
    });
    if (!result.ok) {
      throw new Error('not attached');
    }
    return result.attachment.id;
  };
  return { ...host, session, posted, postMessage, shell, effects, takeFirstRoomReport, gate, send, listOnDisk, attachFile };
}

