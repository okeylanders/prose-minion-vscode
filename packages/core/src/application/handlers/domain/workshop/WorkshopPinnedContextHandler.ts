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
  type WorkshopPinContextPickFileMessage,
  type WorkshopPinContextResourcesMessage,
  type WorkshopPinnedContextAction,
  type WorkshopPinnedContextMessage,
  type WorkshopPinnedContextNotice,
  type WorkshopRequestPinnedContextMessage,
  type WorkshopTurn,
  type WorkshopUnpinContextMessage
} from '@messages';
import { isContextPathGroup } from '@shared/types/context';
import { workshopPinnedContextMatches } from '@shared/constants/workshopPinnedContext';
import {
  workshopPinnedAttachResultWords,
  workshopPinnedContextPayloadOf,
  type WorkshopPinnedAttachLeftOut
} from '@handlers/domain/workshop/WorkshopPinnedContextAnswers';
import { WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS, type WorkshopPinnedContextEntry } from '@shared/types/workshopPinnedContext';

const LOG = '[WorkshopPinnedContextHandler]';
const REQUEST_ID_CHARACTERS = 128;
const REVISION_CHARACTERS = 128;
/**
 * How many items one pin request may name, as a message-shape check only. It is
 * not the list's 20-file bound: a room can hold more attachments than that, and
 * the writes refuse a pin past the list's bound with words that name it. Using
 * the list's bound here refused Pin what's attached now, with 22 attachments,
 * as an unreadable request (Slice 5 live pass).
 */
const PIN_REQUEST_ITEMS = 1_000;
const ATTACHMENT_ID = /^ctx-\d{1,9}$/;

/** The tab's own words for what only the handler knows. */
const WORDS = {
  malformed: 'That request couldn’t be read. Nothing was changed.',
  notInRoom: 'That file isn’t attached to this conversation any more. Nothing was pinned.',
  outsideProject: 'Only files inside this project can be pinned.',
  running: 'Wait for the reply to finish to attach files to this conversation. Pinning and unpinning still work, and apply to new conversations.',
  listUnavailable: 'Pinned context couldn’t be read just now, so nothing was attached.',
  workspaceChanged: 'The project folder changed, so nothing was attached. Try again.',
  openFailed: 'That file couldn’t be opened.'
} as const;

/** The session service's half this handler uses. */
export type WorkshopPinnedContextSessionPort = Pick<WorkshopSessionService, 'getContextAttachments' | 'getContextAttachment' | 'addContextAttachment'>;

type AttachOutcome =
  | { readonly attached: readonly string[]; readonly leftOut: readonly WorkshopPinnedAttachLeftOut[] }
  | { readonly refused: string; readonly line: string };

export interface WorkshopPinnedContextEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  markDirty: (reason: string) => void;
  sendStatus: (message: string) => void;
  /** A run that blocks attaching to the room: a reply or the Context wizard. */
  activeRunLabel: () => string | undefined;
  /** Resolves once the room has hydrated, so the first room's report exists. */
  roomReady: () => Promise<unknown>;
  /**
   * Run room work in the coordinator's session-operation queue (the room's
   * existing ownership, as Refresh changed files uses), so an Open or reset
   * waits behind it rather than capturing a rollback before it lands.
   */
  runRoomOperation: (work: () => Promise<void>) => Promise<void>;
}

export class WorkshopPinnedContextHandler {
  constructor(
    private readonly pinnedContext: WorkshopPinnedContextServices,
    private readonly session: WorkshopPinnedContextSessionPort,
    private readonly shell: Pick<ShellService, 'openFileInEditor' | 'pickFile'>,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopPinnedContextEffects
  ) {}

  registerRoutes(router: MessageRouter, registerMutation: WorkshopMutationRouteRegistrar): void {
    router.register(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, this.handleRequest.bind(this));
    router.register(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, this.handlePinResources.bind(this));
    router.register(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, this.handlePinAttachments.bind(this));
    router.register(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, this.handlePinPickedFile.bind(this));
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

  /**
   * Explore project folders… in pin mode: the host's own picker, starting in
   * the project folder. The path is the host's; the library pins it only
   * inside the folder of the room it was asked in. A dismissed picker
   * answers nothing.
   */
  async handlePinPickedFile(message: WorkshopPinContextPickFileMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId) {
      return this.log('pick refused (malformed)');
    }
    const revision = revisionOf(payload);
    if (!revision) {
      return this.refuse(requestId, 'pin-file', WORDS.malformed, 'pick refused (malformed)');
    }
    const result = await this.pinnedContext.library.pinPickedFile(revision, async (projectFolder) =>
      (await this.shell.pickFile({ title: 'Pin a file from this project', openLabel: 'Pin', defaultPath: projectFolder }))?.fsPath);
    if (result.kind === 'cancelled') {
      return this.log('pick cancelled');
    }
    return this.settle(requestId, 'pin-file', result, 'pin 1 by pick');
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

    // The read and the install run as one room operation, in the coordinator's own session-operation
    // queue (as Refresh changed files does): an Open or reset asked meanwhile waits behind it, so its
    // rollback checkpoint holds what this attached (PR #210 F02).
    let outcome: AttachOutcome | undefined;
    try {
      await this.effects.runRoomOperation(async () => {
        outcome = await this.attachMissing();
      });
    } catch {
      outcome = { refused: WORDS.workspaceChanged, line: 'attach refused (room operation failed)' };
    }
    if (!outcome || 'refused' in outcome) {
      return this.refuse(requestId, 'attach-missing', outcome?.refused ?? WORDS.workspaceChanged, outcome?.line ?? 'attach refused');
    }
    const { attached, leftOut } = outcome;
    const changed = attached.length > 0;
    await this.answer(requestId, { action: 'attach-missing', ok: changed, notice: { kind: changed ? 'done' : 'refused', text: workshopPinnedAttachResultWords(attached, leftOut) } },
      `attach missing (attached=${attached.length}, ${(['missing', 'unreadable', 'over-budget'] as const)
        .map((reason) => `${reason}=${leftOut.filter((entry) => entry.reason === reason).length}`).join(', ')})`);
  }

  /** Inside the room operation: read for this room, then attach each ready pinned file it lacks. */
  private async attachMissing(): Promise<AttachOutcome> {
    if (this.effects.activeRunLabel()) {
      return { refused: WORDS.running, line: 'attach refused (running)' };
    }
    const { read, still } = await this.pinnedContext.library.readForRoom();
    if (read.state === 'list-unreadable') {
      return { refused: WORDS.listUnavailable, line: `attach refused (list ${read.category})` };
    }
    // Read from the root this room was asked in, and attached only while it is still the room (PR #208 F01).
    if (read.state === 'workspace-changed' || !still()) {
      return { refused: WORDS.workspaceChanged, line: 'attach refused (workspace changed)' };
    }
    if (this.effects.activeRunLabel()) {
      return { refused: WORDS.running, line: 'attach refused (running)' };
    }
    const platform = this.pinnedContext.library.platform;
    const attached: string[] = [];
    const leftOut: WorkshopPinnedAttachLeftOut[] = [];
    for (const file of read.state === 'listed' ? read.files : []) {
      // Already here, whatever the source's health now: the room keeps its own copy (PR #210 F06).
      if (this.session.getContextAttachments().some((attachment) => workshopPinnedContextMatches(file.entry, attachment, platform))) {
        continue;
      }
      if (file.state !== 'ready') {
        leftOut.push({ label: file.label, reason: file.state });
        continue;
      }
      const result = this.session.addContextAttachment(file.input);
      if (!result.ok) {
        if (result.reason !== 'duplicate') {
          leftOut.push({ label: file.label, reason: 'over-budget' });
        }
        continue;
      }
      attached.push(file.label);
      if (result.eventTurn) {
        this.effects.postTurn(result.eventTurn);
      }
    }
    if (attached.length > 0) {
      this.effects.markDirty('pinned context attached');
      this.effects.postSessionState();
    }
    return { attached, leftOut };
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

function requestIdOf(payload: { requestId?: unknown } | undefined): string | undefined {
  const requestId = payload?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= REQUEST_ID_CHARACTERS ? requestId : undefined;
}

function revisionOf(payload: { revision?: unknown } | undefined): string | undefined {
  const revision = payload?.revision;
  return typeof revision === 'string' && revision.length > 0 && revision.length <= REVISION_CHARACTERS ? revision : undefined;
}

function entryPathOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS ? value : undefined;
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
    if (typeof group !== 'string' || !isContextPathGroup(group) || typeof path !== 'string' || path.length === 0 || path.length > WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS) {
      return undefined;
    }
    items.push({ group, path });
  }
  return items;
}
