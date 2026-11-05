/**
 * The Pinned context tab's routes (ADR 2026-11-04 D6, D8, D9; epic Slice 3):
 * the Workshop's thirteenth route owner, composed in
 * `WorkshopSliceComposition`.
 *
 * - **Request** answers the list as the library describes it now, with the
 *   host's platform for the webview's match rule. The first request also
 *   posts the first room's seed report to the status line, once (Slice 2b,
 *   deviation 4).
 * - **Pin, unpin and move** change only the list file, never a room, so they
 *   are direct routes. Each goes through the library, which captures the
 *   live room when asked and passes it to the store as `beforeCommit`.
 * - **Pin by attachment id** resolves each `ctx-N` in the live room here:
 *   a file's catalog key or `relativePath` becomes the entry, and anything
 *   else is refused before anything is read.
 * - **Attach missing** changes the room, so it goes through
 *   `registerMutation` and is refused while a run is going. It attaches
 *   each ready pinned file the room lacks through the ordinary aggregate
 *   path, so the "Added context" divider and delta delivery are today's.
 * - **Open** opens a file the library resolved from the list as read now,
 *   never a path taken from the message.
 *
 * Every answer after a change carries the current list. Logs carry actions,
 * counts and categories, never a path, a name or a file's text.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';
import { workshopSessionStartResult } from '@handlers/domain/workshop/WorkshopSessionStartResult';
import type { LogSink, ShellService } from '@/platform';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopPinnedContextDescription,
  WorkshopPinnedContextServices,
  WorkshopPinnedContextWriteResult
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';
import {
  MessageType,
  type ConfiguredResourceRef,
  type WorkshopAttachPinnedContextMessage,
  type WorkshopMovePinnedContextMessage,
  type WorkshopOpenPinnedContextFileMessage,
  type WorkshopPinContextAttachmentsMessage,
  type WorkshopPinContextResourcesMessage,
  type WorkshopPinnedContextAction,
  type WorkshopPinnedContextMessage,
  type WorkshopPinnedContextNotice,
  type WorkshopPinnedContextPayload,
  type WorkshopRequestPinnedContextMessage,
  type WorkshopTurn,
  type WorkshopUnpinContextMessage
} from '@messages';
import { isContextPathGroup } from '@shared/types/context';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPinnedContextMatches } from '@shared/constants/workshopPinnedContext';
import type { WorkshopPinnedContextEntry } from '@shared/types/workshopPinnedContext';

const LOG = '[WorkshopPinnedContextHandler]';
const REQUEST_ID_CHARACTERS = 128;
const REVISION_CHARACTERS = 128;
const ENTRY_PATH_CHARACTERS = 1024;
const PIN_REQUEST_ITEMS = PROMPT_BUDGETS.workshopPinnedContext.files;
const ATTACHMENT_ID = /^ctx-\d{1,9}$/;

/** The tab's own words for what only the handler knows. */
const WORDS = {
  malformed: 'That request couldn’t be read. Nothing was changed.',
  notInRoom: 'That file isn’t attached to this conversation any more. Nothing was pinned.',
  outsideProject: 'Only files inside this project can be pinned.',
  running: 'Wait for the reply to finish to attach files to this conversation. Pinning and unpinning still work, and apply to new conversations.',
  nothingMissing: 'Every pinned file is already in this conversation.',
  listUnavailable: 'Pinned context couldn’t be read just now, so nothing was attached.',
  openFailed: 'That file couldn’t be opened.'
} as const;

/** The session service's half this handler uses. */
export type WorkshopPinnedContextSessionPort = Pick<WorkshopSessionService, 'getContextAttachments' | 'getContextAttachment' | 'addContextAttachment'>;

export interface WorkshopPinnedContextEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  markDirty: (reason: string) => void;
  sendStatus: (message: string) => void;
  /** A run that blocks attaching to the room: a reply or the Context wizard. */
  activeRunLabel: () => string | undefined;
  /** Resolves once the room has hydrated, so the first room's report exists. */
  roomReady: () => Promise<unknown>;
}

export class WorkshopPinnedContextHandler {
  constructor(
    private readonly pinnedContext: WorkshopPinnedContextServices,
    private readonly session: WorkshopPinnedContextSessionPort,
    private readonly shell: Pick<ShellService, 'openFileInEditor'>,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopPinnedContextEffects
  ) {}

  registerRoutes(router: MessageRouter, registerMutation: WorkshopMutationRouteRegistrar): void {
    router.register(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, this.handleRequest.bind(this));
    router.register(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, this.handlePinResources.bind(this));
    router.register(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, this.handlePinAttachments.bind(this));
    router.register(MessageType.WORKSHOP_UNPIN_CONTEXT, this.handleUnpin.bind(this));
    router.register(MessageType.WORKSHOP_MOVE_PINNED_CONTEXT, this.handleMove.bind(this));
    router.register(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, this.handleOpen.bind(this));
    registerMutation(
      MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT,
      this.handleAttachMissing.bind(this),
      undefined,
      (reason, message: WorkshopAttachPinnedContextMessage) => {
        const requestId = requestIdOf(message.payload);
        if (requestId) {
          void this.answer(requestId, { action: 'attach-missing', ok: false, notice: { kind: 'refused', text: reason } }, 'attach refused (session operation)');
        }
      }
    );
  }

  async handleRequest(message: WorkshopRequestPinnedContextMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (!requestId) {
      this.log('request refused (malformed)');
      return;
    }
    void this.postFirstRoomReport();
    await this.answer(requestId, {}, 'list');
  }

  async handlePinResources(message: WorkshopPinContextResourcesMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    const revision = revisionOf(payload);
    const items = resourcesOf(payload?.items);
    if (!requestId) {
      return this.log('pin refused (malformed)');
    }
    if (!revision || !items) {
      return this.refuse(requestId, 'pin-resources', WORDS.malformed, 'pin refused (malformed)');
    }
    const result = await this.pinnedContext.library.pinResources(revision, items);
    return this.settle(requestId, 'pin-resources', result, `pin ${items.length} by key`);
  }

  async handlePinAttachments(message: WorkshopPinContextAttachmentsMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    const revision = revisionOf(payload);
    const ids = payload?.attachmentIds;
    if (!requestId) {
      return this.log('pin refused (malformed)');
    }
    if (!revision || !Array.isArray(ids) || ids.length === 0 || ids.length > PIN_REQUEST_ITEMS || !ids.every((id) => typeof id === 'string' && ATTACHMENT_ID.test(id))) {
      return this.refuse(requestId, 'pin-attachments', WORDS.malformed, 'pin refused (malformed ids)');
    }
    const entries: WorkshopPinnedContextEntry[] = [];
    for (const id of ids) {
      const attachment = this.session.getContextAttachment(id);
      if (!attachment) {
        return this.refuse(requestId, 'pin-attachments', WORDS.notInRoom, 'pin refused (not in room)');
      }
      const written = attachment.kind === 'file' ? attachment.configuredResource?.path ?? attachment.relativePath : undefined;
      // Windows may hand back `\`; on POSIX it is a filename character, which the path rule refuses (PR #208 F02).
      const entryPath = written !== undefined && this.pinnedContext.library.platform === 'windows' ? written.replace(/\\/g, '/') : written;
      if (!entryPath) {
        return this.refuse(requestId, 'pin-attachments', WORDS.outsideProject, `pin refused (${attachment.kind} without a project path)`);
      }
      entries.push({ path: entryPath });
    }
    const result = await this.pinnedContext.library.pinPaths(revision, entries);
    return this.settle(requestId, 'pin-attachments', result, `pin ${entries.length} by id`);
  }

  async handleUnpin(message: WorkshopUnpinContextMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId) {
      return this.log('unpin refused (malformed)');
    }
    const revision = revisionOf(payload);
    const entryPath = entryPathOf(payload?.entryPath);
    if (!revision || entryPath === undefined) {
      return this.refuse(requestId, 'unpin', WORDS.malformed, 'unpin refused (malformed)');
    }
    return this.settle(requestId, 'unpin', await this.pinnedContext.library.unpin(revision, entryPath), 'unpin');
  }

  async handleMove(message: WorkshopMovePinnedContextMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId) {
      return this.log('move refused (malformed)');
    }
    const revision = revisionOf(payload);
    const entryPath = entryPathOf(payload?.entryPath);
    const direction = payload?.direction;
    if (!revision || entryPath === undefined || (direction !== 'up' && direction !== 'down')) {
      return this.refuse(requestId, 'move', WORDS.malformed, 'move refused (malformed)');
    }
    return this.settle(requestId, 'move', await this.pinnedContext.library.move(revision, entryPath, direction), `move ${direction}`);
  }

  async handleOpen(message: WorkshopOpenPinnedContextFileMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId) {
      return this.log('open refused (malformed)');
    }
    const entryPath = payload?.entryPath === undefined ? undefined : entryPathOf(payload.entryPath);
    if (payload?.entryPath !== undefined && entryPath === undefined) {
      return this.refuse(requestId, 'open', WORDS.malformed, 'open refused (malformed)');
    }
    const target = await this.pinnedContext.library.openTarget(entryPath);
    if (target.kind === 'refused') {
      return this.refuse(requestId, 'open', target.words, `open refused (${target.category})`);
    }
    try {
      await this.shell.openFileInEditor(target.fsPath);
    } catch (error) {
      return this.refuse(requestId, 'open', WORDS.openFailed, `open failed (${error instanceof Error ? error.name : 'error'})`);
    }
    await this.answer(requestId, { action: 'open', ok: true }, entryPath === undefined ? 'open list file' : 'open entry');
  }

  /**
   * Attach every ready pinned file this room lacks, in pinned order, through
   * the aggregate's ordinary add: its duplicate and budget guards, and its
   * divider once the room has a conversation. A file that doesn't fit is
   * left out and the next is tried.
   */
  async handleAttachMissing(message: WorkshopAttachPinnedContextMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (!requestId) {
      return this.log('attach refused (malformed)');
    }
    if (this.effects.activeRunLabel()) {
      return this.refuse(requestId, 'attach-missing', WORDS.running, 'attach refused (running)');
    }
    const read = await this.pinnedContext.library.readForSeed();
    if (read.state === 'list-unreadable') {
      return this.refuse(requestId, 'attach-missing', WORDS.listUnavailable, `attach refused (list ${read.category})`);
    }
    if (this.effects.activeRunLabel()) {
      return this.refuse(requestId, 'attach-missing', WORDS.running, 'attach refused (running)');
    }
    const platform = this.pinnedContext.library.platform;
    const attached: string[] = [];
    const leftOut: string[] = [];
    let changed = false;
    for (const file of read.state === 'listed' ? read.files : []) {
      if (file.state !== 'ready') {
        continue;
      }
      if (this.session.getContextAttachments().some((attachment) => workshopPinnedContextMatches(file.entry, attachment, platform))) {
        continue;
      }
      const result = this.session.addContextAttachment(file.input);
      if (!result.ok) {
        if (result.reason !== 'duplicate') {
          leftOut.push(file.label);
        }
        continue;
      }
      changed = true;
      attached.push(file.label);
      if (result.eventTurn) {
        this.effects.postTurn(result.eventTurn);
      }
    }
    if (changed) {
      this.effects.markDirty('pinned context attached');
      this.effects.postSessionState();
    }
    const text = attachedWords(attached, leftOut);
    await this.answer(requestId, { action: 'attach-missing', ok: changed, notice: { kind: changed ? 'done' : 'refused', text } },
      `attach missing (attached=${attached.length}, over-budget=${leftOut.length})`);
  }

  /** The first room's seed report, on the status line, once (Slice 2b, deviation 4). */
  private async postFirstRoomReport(): Promise<void> {
    try {
      await this.effects.roomReady();
    } catch {
      return;
    }
    const report = this.pinnedContext.takeFirstRoomReport();
    if (report) {
      this.log(`first room report (attached=${report.attachedCount}/${report.pinnedCount}, leftOut=${report.leftOut.length})`);
      this.effects.sendStatus(workshopSessionStartResult('carry', report));
    }
  }

  private async settle(requestId: string, action: WorkshopPinnedContextAction, result: WorkshopPinnedContextWriteResult, line: string): Promise<void> {
    switch (result.kind) {
      case 'ok':
        return this.answer(requestId, { action, ok: true }, `${line}${result.written ? '' : ' (unchanged)'}`);
      case 'changed':
        return this.answer(requestId, { action, ok: false, notice: { kind: 'changed' } }, `${line} refused (changed)`);
      case 'refused':
        return this.refuse(requestId, action, result.words, `${line} refused (${result.category})`);
    }
  }

  private refuse(requestId: string, action: WorkshopPinnedContextAction, text: string, line: string): Promise<void> {
    return this.answer(requestId, { action, ok: false, notice: { kind: 'refused', text } }, line);
  }

  /** The list as it reads now, with what the action came to. */
  private async answer(
    requestId: string,
    outcome: { action?: WorkshopPinnedContextAction; ok?: boolean; notice?: WorkshopPinnedContextNotice },
    line: string
  ): Promise<void> {
    this.log(line);
    let description: WorkshopPinnedContextDescription;
    try {
      description = await this.pinnedContext.library.describe();
    } catch {
      description = { state: 'io', words: 'pinned-context.json couldn’t be read. Try again, or check the project folder.' };
    }
    const reply: WorkshopPinnedContextMessage = {
      type: MessageType.WORKSHOP_PINNED_CONTEXT,
      source: 'extension.workshop',
      payload: { ...workshopPinnedContextPayloadOf(description, this.pinnedContext.library.platform, requestId), ...outcome },
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

/** The answer's list, from the library's description. Pure. */
export function workshopPinnedContextPayloadOf(
  description: WorkshopPinnedContextDescription,
  platform: WorkshopPinnedContextPayload['platform'],
  requestId: string | null
): WorkshopPinnedContextPayload {
  const totals = (files: number, words: number) => ({
    words,
    budgetWords: PROMPT_BUDGETS.contextAttachments.words,
    files,
    maxFiles: PROMPT_BUDGETS.workshopPinnedContext.files
  });
  const base = { requestId, platform, entries: [], totals: totals(0, 0), revision: null };
  switch (description.state) {
    case 'listed':
      return {
        ...base,
        availability: { available: true },
        file: { state: description.absent ? 'absent' : 'ok' },
        revision: description.revision,
        entries: description.rows.map((row) => ({
          path: row.path,
          label: row.label,
          ...(row.source?.kind === 'catalog' ? { group: row.source.group } : {}),
          ...(row.state === 'ready' || row.state === 'head-sliced' ? { words: row.words } : {}),
          state: row.state,
          ...(row.stateWords ? { stateWords: row.stateWords } : {}),
          ...(row.state === 'head-sliced' && row.totalWords !== undefined
            ? { truncation: { keptWords: row.words, totalWords: row.totalWords } }
            : {})
        })),
        totals: totals(description.rows.length, description.words)
      };
    case 'unreadable':
      return { ...base, availability: { available: true }, file: { state: 'unreadable', words: description.words } };
    case 'unavailable':
      return { ...base, availability: { available: false, reason: description.reason, words: description.words }, file: { state: 'absent' } };
    case 'busy':
    case 'io':
      return { ...base, availability: { available: true }, file: { state: description.state, words: description.words } };
  }
}

function attachedWords(attached: readonly string[], leftOut: readonly string[]): string {
  if (attached.length === 0 && leftOut.length === 0) {
    return WORDS.nothingMissing;
  }
  const files = (count: number) => `${count} pinned ${count === 1 ? 'file' : 'files'}`;
  const left = leftOut.length > 0
    ? ` Not attached: ${leftOut.join(', ')} (doesn’t fit in the ${PROMPT_BUDGETS.contextAttachments.words.toLocaleString('en-US')}-word context limit).`
    : '';
  return attached.length > 0
    ? `Attached ${files(attached.length)} to this conversation.${left}`
    : `Nothing was attached.${left}`;
}

function requestIdOf(payload: { requestId?: unknown } | undefined): string | undefined {
  const requestId = payload?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= REQUEST_ID_CHARACTERS ? requestId : undefined;
}

function revisionOf(payload: { revision?: unknown } | undefined): string | undefined {
  const revision = payload?.revision;
  return typeof revision === 'string' && revision.length > 0 && revision.length <= REVISION_CHARACTERS ? revision : undefined;
}

function entryPathOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= ENTRY_PATH_CHARACTERS ? value : undefined;
}

function resourcesOf(value: unknown): ConfiguredResourceRef[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > PIN_REQUEST_ITEMS) {
    return undefined;
  }
  const items: ConfiguredResourceRef[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      return undefined;
    }
    const { group, path } = item as { group?: unknown; path?: unknown };
    if (typeof group !== 'string' || !isContextPathGroup(group) || typeof path !== 'string' || path.length === 0 || path.length > ENTRY_PATH_CHARACTERS) {
      return undefined;
    }
    items.push({ group, path });
  }
  return items;
}
