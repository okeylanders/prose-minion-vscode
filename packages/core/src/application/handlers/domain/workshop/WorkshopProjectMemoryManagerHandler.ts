/**
 * The memory manager's own routes (ADR 2026-11-04 D5, D8, D10, D13; epic
 * Slice 4b), composed beside `WorkshopProjectMemoryHandler` in
 * `WorkshopSliceComposition`. That handler owns the writes that leave a
 * receipt (save, edit, Forget, Restore), which the manager reuses; this one
 * owns only what the manager adds:
 *
 * - `WORKSHOP_MEMORY_LIST`: the folder as the tab and the manager draw it,
 *   with the frame's estimate and each memory's residency.
 * - `WORKSHOP_MEMORY_MANAGER_ACTION`: Always load in full (budget-checked),
 *   Delete (the store's claimed delete, `changed` or `busy` said as such),
 *   Open file by `entryKey`, and Open memory folder.
 *
 * None of them changes the room: no receipt (a load-in-full toggle leaves
 * none, as Slice 3's edit doesn't; D7 names no receipt for Delete), no
 * snapshot, so none waits on the session-operation gate. Every write goes
 * through the library's single-writer queue. Memory Off doesn't stop them
 * (D8: the writer keeps access); only a workspace without memory does.
 *
 * Each request carries a webview-minted id the host echoes. Answers name no
 * memory text; logs carry ids, actions and reasons, never a title or a path.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { LogSink, ShellService } from '@/platform';
import {
  MessageType,
  type WorkshopMemoryListingMessage,
  type WorkshopMemoryListMessage,
  type WorkshopMemoryManagerActionMessage,
  type WorkshopMemoryManagerResultMessage,
  type WorkshopMemoryManagerResultPayload
} from '@messages';
import type { ProjectMemoryLibrary } from '@/application/services/workshop/memory/ProjectMemoryLibrary';
import type { ProjectMemoryDeleteRefusalReason } from '@/application/services/workshop/memory/ProjectMemoryWrites';
import type { ProjectMemoryManagerFile } from '@/application/services/workshop/memory/ProjectMemoryManager';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/** The library's manager half; satisfied by ProjectMemoryLibrary. */
export type WorkshopProjectMemoryManagerPort = Pick<
  ProjectMemoryLibrary,
  'managerListing' | 'managerFile' | 'memoryFolder' | 'setLoadInFull' | 'remove'
>;

const LOG = '[WorkshopProjectMemoryManagerHandler]';
const REQUEST_ID_CHARACTERS = 128;
const QUERY_CHARACTERS = PROMPT_BUDGETS.workshopProjectMemory.queryCharacters;
const MEMORY_ID = /^mem-[0-9a-f]{6}$/;

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the library's kebab-case reasons. */
const WRITE_REFUSALS: Readonly<Record<ProjectMemoryDeleteRefusalReason, string>> = {
  off: 'Project memory is off.',
  'no-workspace': 'Project memory isn’t available here: no folder is open. Open a single folder to use project memory.',
  'multi-root': 'Project memory isn’t available here: this workspace has several folders. Open a single folder to use project memory.',
  'workspace-changed': 'The workspace changed since this room opened, so its memory can’t be changed here.',
  'not-ready': 'Wait for the room to finish loading, then try again.',
  unknown: 'The memory folder couldn’t be listed just now. Your memory files weren’t touched.',
  missing: 'That memory is no longer in the folder.',
  busy: 'Another VS Code window is changing that memory. Try again when it’s done.',
  conflict: 'Two files hold that memory’s id. Fix one in the editor first.',
  invalid: 'That memory can’t be saved as written.',
  failed: 'That couldn’t be done. Try again.',
  'pinned-budget': 'Can’t load this one in full: memories loaded in full would pass their budget.',
  changed: 'That memory’s file changed before it could be deleted, so nothing was deleted.'
};

const FILE_REFUSALS: Readonly<Record<Extract<ProjectMemoryManagerFile, { kind: 'refused' }>['reason'], string>> = {
  stale: 'That file is no longer where the list said. The list has been read again.',
  'set-aside': 'That copy has no file of its own yet. Memory moves it to one as soon as it can.',
  unavailable: 'Project memory isn’t available here.',
  unknown: 'The memory folder couldn’t be listed just now. Your memory files weren’t touched.'
};
/* eslint-enable @typescript-eslint/naming-convention */

export class WorkshopProjectMemoryManagerHandler {
  constructor(
    private readonly library: WorkshopProjectMemoryManagerPort,
    private readonly shell: Pick<ShellService, 'openFileInEditor' | 'revealFileInOS'>,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly reportError: (message: string) => void
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_MEMORY_LIST, this.handleList.bind(this));
    router.register(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, this.handleAction.bind(this));
  }

  async handleList(message: WorkshopMemoryListMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    const query = message.payload?.query;
    if (!requestId || typeof query !== 'string') {
      this.reportError('A memory listing must name its request and carry a query');
      return;
    }
    const listing = await this.library.managerListing(query.slice(0, QUERY_CHARACTERS));
    const reply: WorkshopMemoryListingMessage = {
      type: MessageType.WORKSHOP_MEMORY_LISTING,
      source: 'extension.workshop',
      payload: { requestId, ...listing },
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  async handleAction(message: WorkshopMemoryManagerActionMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId || !payload) {
      this.reportError('A memory manager action must name its request');
      return;
    }
    switch (payload.action) {
      case 'set-load-in-full': {
        if (!MEMORY_ID.test(String(payload.memoryId)) || typeof payload.loadInFull !== 'boolean') {
          return this.refuse(requestId, WRITE_REFUSALS.missing, 'load-in-full refused reason=malformed');
        }
        const result = await this.library.setLoadInFull(payload.memoryId, payload.loadInFull);
        if (result.kind === 'refused') {
          return this.answer({ requestId, ok: false, error: WRITE_REFUSALS[result.reason], ...(result.budget ? { budget: result.budget } : {}) },
            `load-in-full refused memoryId=${payload.memoryId} reason=${result.reason}`);
        }
        return this.answer({ requestId, ok: true }, `load-in-full ${payload.loadInFull ? 'on' : 'off'} memoryId=${payload.memoryId}${result.unchanged ? ' unchanged' : ''}`);
      }
      case 'delete': {
        if (!MEMORY_ID.test(String(payload.memoryId))) {
          return this.refuse(requestId, WRITE_REFUSALS.missing, 'delete refused reason=malformed');
        }
        const result = await this.library.remove(payload.memoryId);
        return result.kind === 'deleted'
          ? this.answer({ requestId, ok: true }, `delete memoryId=${payload.memoryId}`)
          : this.answer({ requestId, ok: false, error: WRITE_REFUSALS[result.reason] }, `delete refused memoryId=${payload.memoryId} reason=${result.reason}`);
      }
      case 'open-file': {
        const file = typeof payload.entryKey === 'string' ? await this.library.managerFile(payload.entryKey) : { kind: 'refused' as const, reason: 'stale' as const };
        if (file.kind === 'refused') {
          return this.answer({ requestId, ok: false, error: FILE_REFUSALS[file.reason] }, `open file refused reason=${file.reason}`);
        }
        return this.opened(requestId, 'open file', () => this.shell.openFileInEditor(file.path));
      }
      case 'open-folder': {
        const folder = await this.library.memoryFolder();
        if (folder.kind === 'refused') {
          return this.answer({ requestId, ok: false, error: folder.reason === 'unavailable' ? FILE_REFUSALS.unavailable : WRITE_REFUSALS.failed },
            `open folder refused reason=${folder.reason}`);
        }
        return this.opened(requestId, 'open folder', () => this.shell.revealFileInOS(folder.path));
      }
      default:
        return this.refuse(requestId, WRITE_REFUSALS.failed, 'action refused reason=unknown-action');
    }
  }

  private async opened(requestId: string, action: string, open: () => Promise<void>): Promise<void> {
    try {
      await open();
      this.answer({ requestId, ok: true }, action);
    } catch (error) {
      this.answer({ requestId, ok: false, error: WRITE_REFUSALS.failed }, `${action} failed (${error instanceof Error ? error.name : 'error'})`);
    }
  }

  private refuse(requestId: string, error: string, line: string): void {
    this.answer({ requestId, ok: false, error }, line);
  }

  private answer(payload: WorkshopMemoryManagerResultPayload, line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
    const reply: WorkshopMemoryManagerResultMessage = {
      type: MessageType.WORKSHOP_MEMORY_MANAGER_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }
}

function requestIdOf(payload: { requestId?: unknown } | undefined): string | undefined {
  const requestId = payload?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= REQUEST_ID_CHARACTERS
    ? requestId
    : undefined;
}
