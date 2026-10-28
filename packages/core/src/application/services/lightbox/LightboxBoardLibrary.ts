/**
 * LightboxBoardLibrary — when Lightbox boards are saved, and how a saved one
 * comes back (ADR 2026-10-19 D12 addendum; Slice 5A; epic decisions 27–31;
 * Slice 5A.1, decisions 33–35).
 * Built once at the composition root and carried in `CoreServices`, over the
 * one LightboxService, LightboxBoardStore and reading runner. Handlers call
 * it; it constructs nothing.
 *
 * - **Saves (decision 27; one file per board from Slice 5A.2, decision
 *   46).** A run that landed readings saves its board as it stands
 *   (`saveAfterRun`), rewriting the file that holds it in place. A board
 *   measured from new text saves itself once, to a new file named by
 *   default, unless a saved board of its source already holds that text.
 *   Nothing is pruned. `LightboxBoardSaves`, built here, decides.
 * - **The board on screen (PR #163 F-01).** Every adoption (built, opened or
 *   restored) is the board on screen, so the reload pointer follows it at
 *   once: to the file that already holds it, without writing a duplicate,
 *   or, for a board no file holds yet, to the file its save commits or the
 *   newest one holding its text. Each adoption is pushed to the rail.
 * - **Every chapter (Slice 5A.2).** The shelf lists the saved boards of
 *   every source, newest first, for the Boards menu and browser; each row
 *   carries its source and its name, the file's own or, for a file saved
 *   before names, the default its source and its time give. Opening one of
 *   another chapter is a source choice like any other. A board file the
 *   writer picks with the system picker (`openFile`) opens by its id when it
 *   is one of the store's own, and otherwise as a snapshot no file of the
 *   store holds: never written, and its next save writes a new file in the
 *   store, keeping its board's id and name.
 * - **Open is a snapshot (decision 29).** The board exactly as saved, under
 *   a source ticket taken before anything is awaited: a newer source wins
 *   over it, and it wins over an older one (PR #148 F-01). It is refused at
 *   once while a run reads the board it would replace, and checked again,
 *   with nothing awaited, at the adoption.
 * - **Restore (decision 30).** The first mount of a session in which no
 *   source was chosen reopens the last board on screen, under its own ticket.
 *   A restore that fails is logged; the writer asked for nothing, so nothing
 *   is refused.
 * - **The shelf.** The rail's listing for a board's source, every saved
 *   board newest first, and, for a snapshot, whether its file still holds
 *   the text it was read from. Read live; the listing is the last thing
 *   awaited, so answers leave in the store's order. A shelf names the
 *   adoption it was built for (PR #163 F-02): a board keeps its id across
 *   snapshots, so a shelf built across a newer snapshot's adoption is
 *   outdated (`describesCurrent`) and never posted as current. Readings,
 *   saves and deletes keep the adoption, so a shelf also names its
 *   observation (PR #163 F-05): a number taken, in order, before anything
 *   is awaited. Every change the rail must hear (an adoption, a committed
 *   save, a delete's answer) starts a new observation, so a shelf observed
 *   before one already sent has nothing newer to say.
 * - **Names and sparks in place (Slice 5A.1, decisions 33 and 35).** A
 *   board's name belongs to the board, and every save writes it; a rename,
 *   and a spark set aside, rewrite the file that holds the board in place
 *   (`LightboxBoardEdits`, which this library builds and answers for). A
 *   restore whose file is shown gone forgets the reload pointer; one whose
 *   file another window holds (busy), or whose folder could not be read,
 *   keeps it, and a board left mid-rewrite is put back by the store's read
 *   and restored (PR #164 F-02 and its re-review).
 * - **Owed writes drain at shutdown (PR #183 F-03).** Every write it starts
 *   (a save after a run, a measured board's first save, a rename, a spark's
 *   mark, a delete) is owed until it settles. `drain` waits for all of them,
 *   and for any started while it waits. The composition root awaits it at
 *   deactivation, once the Lightbox tab is disposed: its handler stops the
 *   runs it started, and each that landed readings queues its save then.
 *
 * Logs carry file ids, counts and reasons; never the writer's text or a
 * board's name.
 */

import * as path from 'node:path';
import type {
  LightboxBoard,
  LightboxBoardShelf,
  LightboxSavedBoardSummary,
  LightboxSnapshotFile,
  LightboxSnapshotState
} from '@messages';
import type { LogSink, Workspace } from '@/platform';
import { ListenerSet } from '@/utils/ListenerSet';
import { lightboxDefaultBoardName } from '@shared/constants/lightboxBoardName';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import type { LightboxSavableBoard, LightboxService, LightboxSourceTicket } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import type { LightboxBoardRead, LightboxBoardStore } from '@/infrastructure/storage/LightboxBoardStore';
import { LIGHTBOX_BOARD_NOTICES, type LightboxBoardAction } from '@/application/services/lightbox/LightboxBoardNotices';
import { LightboxBoardEdits, type LightboxBoardRename } from '@/application/services/lightbox/LightboxBoardEdits';
import { LightboxBoardSaves } from '@/application/services/lightbox/LightboxBoardSaves';

export { LIGHTBOX_BOARD_NOTICES } from '@/application/services/lightbox/LightboxBoardNotices';
export type { LightboxBoardAction } from '@/application/services/lightbox/LightboxBoardNotices';
export type { LightboxBoardRename } from '@/application/services/lightbox/LightboxBoardEdits';

const LOG = '[LightboxBoardLibrary]';

const OPEN_SUGGESTION = 'Choose another saved board, or read the chapter again.';

export interface LightboxBoardLibraryPorts {
  service: Pick<
    LightboxService,
    | 'addOutcomeListener'
    | 'adoptionOf'
    | 'adoptSaved'
    | 'beginSourceRequest'
    | 'boardOfFile'
    | 'currentBoard'
    | 'currentSavable'
    | 'forgetSaved'
    | 'hasSourceRequests'
    | 'isCurrentRequest'
    | 'markSaved'
    | 'nameBoard'
    | 'refuseSource'
    | 'retainedForSource'
    | 'savable'
  >;
  store: Pick<
    LightboxBoardStore,
    'availability' | 'delete' | 'lastOnScreen' | 'listAll' | 'locate' | 'read' | 'readOutside' | 'rememberOnScreen' | 'replace' | 'save'
  >;
  runs: Pick<LightboxReadingRunner, 'activeRun'>;
  textSourceResolver: Pick<TextSourceResolver, 'resolve'>;
  workspace: Pick<Workspace, 'workspaceFolders'>;
  outputChannel: LogSink;
}

export interface LightboxBoardLibraryOptions {
  /** The zone a default name's time is told in; the host's own when absent (tests pin one). */
  timeZone?: string;
}

/** The rail's shelf, naming the board it describes (`null`: none), that board's adoption, and when it was observed. */
export interface LightboxBoardShelfAnswer {
  boardId: string | null;
  adoption: number | null;
  /** Ascending per session, taken when the shelf began, before its first await (PR #163 F-05). */
  observation: number;
  shelf: LightboxBoardShelf;
}

export class LightboxBoardLibrary {
  private readonly shelfListeners: ListenerSet<[]>;
  private readonly edits: LightboxBoardEdits;
  private readonly saves: LightboxBoardSaves;
  private readonly unsubscribe: () => void;
  private restoring?: Promise<void>;
  private observations = 0;
  /** Writes started and not yet settled (PR #183 F-03). */
  private readonly owed = new Set<Promise<unknown>>();

  constructor(private readonly ports: LightboxBoardLibraryPorts, private readonly options: LightboxBoardLibraryOptions = {}) {
    this.shelfListeners = new ListenerSet<[]>(`${LOG} Shelf listener`, ports.outputChannel);
    const announce = () => this.shelfListeners.emit();
    this.edits = new LightboxBoardEdits({ ...ports, announce });
    this.saves = new LightboxBoardSaves({ ...ports, announce, owe: (write) => this.owe(write), timeZone: options.timeZone });
    // Every adoption is the board on screen: the pointer follows it, and the rail hears it.
    this.unsubscribe = ports.service.addOutcomeListener((change) => {
      if (change.kind === 'board') {
        this.saves.onScreen(change.board);
        this.shelfListeners.emit();
      }
    });
  }

  /** Stop hearing the service (composition-root teardown). */
  dispose(): void {
    this.unsubscribe();
  }

  /**
   * Settle every write this library owes, and any started while it waits
   * (PR #183 F-03). Never rejects: a write that fails has said so already.
   */
  async drain(): Promise<void> {
    while (this.owed.size > 0) {
      await Promise.allSettled([...this.owed]);
    }
  }

  /** Hear each adoption and each committed save, so a rail shows it. Returns the unsubscribe closure the caller must own. */
  addShelfListener(listener: () => void): () => void {
    return this.shelfListeners.add(listener);
  }

  /** A run on `boardId` ended having landed readings: save the board as it stands now, in its own file (decision 46). */
  saveAfterRun(boardId: string): Promise<void> {
    return this.owe(this.saves.saveAfterRun(boardId));
  }

  /**
   * Reopen the last board on screen, once per session and only while no
   * source has been chosen. Concurrent mounts share the one attempt.
   */
  restore(): Promise<void> {
    if (!this.restoring) {
      this.restoring = this.ports.service.hasSourceRequests() ? Promise.resolve() : this.restoreOnce();
    }
    return this.restoring;
  }

  /** Open a saved board as the board on screen, exactly as saved. */
  async open(fileId: string): Promise<LightboxBoardAction> {
    const { service } = this.ports;
    if (this.reading(service.currentBoard())) {
      this.ports.outputChannel.appendLine(`${LOG} Open of ${fileId} refused: a run is reading the board on screen`);
      return { notice: LIGHTBOX_BOARD_NOTICES.reading };
    }
    // The writer's choice is concrete: the ticket comes before the read (PR #148 F-01).
    const ticket = service.beginSourceRequest();
    const read = await this.ports.store.read(fileId);
    return this.adopt(ticket, fileId, read, 'open');
  }

  /**
   * Open a board file the writer picked with the system picker (Slice
   * 5A.2): one of the store's own opens by its id, as Open does; any other
   * is read where it is, never written, and adopted as a snapshot no file of
   * the store holds, so its next save writes a new file in the store.
   */
  async openFile(filePath: string): Promise<LightboxBoardAction> {
    const fileId = this.ports.store.locate(filePath);
    if (fileId) {
      return this.open(fileId);
    }
    const { service } = this.ports;
    if (this.reading(service.currentBoard())) {
      this.ports.outputChannel.appendLine(`${LOG} Open of a board file refused: a run is reading the board on screen`);
      return { notice: LIGHTBOX_BOARD_NOTICES.reading };
    }
    // The writer's choice is concrete once the picker returns: the ticket comes before the read.
    const ticket = service.beginSourceRequest();
    const read = await this.ports.store.readOutside(filePath);
    return this.adopt(ticket, undefined, read, 'open');
  }

  /** Name a board, rename it, or unname it (Slice 5A.1; `LightboxBoardEdits`). */
  rename(request: LightboxBoardRename): Promise<LightboxBoardAction> {
    return this.owe(this.edits.rename(request));
  }

  /** A spark on `boardId` was set aside or brought back: its file takes that spark's mark in place (Slice 5A.1; `LightboxBoardEdits`). */
  keepSpark(boardId: string, tileId: string): Promise<void> {
    return this.owe(this.edits.keepSpark(boardId, tileId));
  }

  /** Delete a saved board's file; the board on screen, if it came from it, stays as it is. */
  remove(fileId: string): Promise<LightboxBoardAction> {
    return this.owe(this.deleteFile(fileId));
  }

  private async deleteFile(fileId: string): Promise<LightboxBoardAction> {
    const result = await this.ports.store.delete(fileId);
    switch (result.kind) {
      case 'deleted':
        this.ports.service.forgetSaved(fileId);
        return {};
      case 'missing':
        return {};
      case 'busy':
        return { notice: LIGHTBOX_BOARD_NOTICES.busy };
      case 'unreadable':
        return { notice: LIGHTBOX_BOARD_NOTICES.deleteUnreadable };
      case 'unavailable':
        return { notice: LIGHTBOX_BOARD_NOTICES.unavailable };
      case 'failed':
        return { notice: LIGHTBOX_BOARD_NOTICES.deleteFailed };
    }
  }

  /** The saved boards of `boardId`'s source (the board on screen when it is not retained), newest first. */
  async shelf(boardId: string | null): Promise<LightboxBoardShelfAnswer> {
    const { service, store } = this.ports;
    const savable = (boardId ? service.savable(boardId) : undefined) ?? service.currentSavable();
    // This shelf's place among the others, taken before anything is awaited (PR #163 F-05).
    const observation = ++this.observations;
    // Captured before the first await, and checked by `describesCurrent` before the shelf leaves.
    const adoption = savable ? service.adoptionOf(savable.board.boardId) ?? null : null;
    const snapshot = savable && await this.snapshotState(savable);
    // The listing is the last thing awaited: answers leave in the store's order. Every chapter's (Slice 5A.2).
    const listing = await store.listAll();
    const latest = savable && service.savable(savable.board.boardId);
    const boards = listing.entries.map((entry): LightboxSavedBoardSummary => ({
      fileId: entry.fileId,
      name: entry.name ?? lightboxDefaultBoardName(entry.source, entry.savedAt, this.options.timeZone),
      savedAt: entry.savedAt,
      source: entry.source,
      wordCount: entry.wordCount,
      lenses: entry.lenses,
      staleLenses: entry.staleLenses,
      ...(entry.costUsd !== undefined ? { costUsd: entry.costUsd } : {}),
      ...(entry.models.length > 0 ? { models: entry.models } : {}),
      onScreen: latest?.savedFileId !== undefined && entry.fileId === latest.savedFileId
    }));
    const name = latest?.name;
    return {
      boardId: savable?.board.boardId ?? null,
      adoption,
      observation,
      shelf: {
        availability: store.availability(),
        ...(name !== undefined ? { name } : {}),
        boards,
        unreadable: listing.unreadable,
        ...(listing.unreadableFolders > 0 ? { unreadableFolders: listing.unreadableFolders } : {}),
        ...(snapshot ? { snapshot } : {})
      }
    };
  }

  /** Whether a shelf still describes the adoption it was built for; a newer snapshot of the same board makes it outdated. */
  describesCurrent(answer: LightboxBoardShelfAnswer): boolean {
    return answer.boardId === null || this.ports.service.adoptionOf(answer.boardId) === answer.adoption;
  }

  private async restoreOnce(): Promise<void> {
    const fileId = this.ports.store.lastOnScreen();
    if (!fileId) {
      return;
    }
    const ticket = this.ports.service.beginSourceRequest();
    const read = await this.ports.store.read(fileId);
    // A pointer to a file that is gone would be tried, and logged, every session: forget it (5A tech debt).
    // `missing` is established absence, neither the file nor a claim on it (the store classifies every one); a file
    // another window holds is `busy`, and one whose folder could not be read is `unreadable`: the pointer stays.
    if (read.kind === 'missing' && this.ports.store.lastOnScreen() === fileId) {
      this.ports.store.rememberOnScreen(undefined);
    }
    await this.adopt(ticket, fileId, read, 'restore');
  }

  /**
   * Adopt a read file under `ticket`, with nothing awaited between the last
   * check and the adoption. `fileId` is the store's file; none for a board
   * file opened from outside the store (Slice 5A.2).
   */
  private adopt(ticket: LightboxSourceTicket, fileId: string | undefined, read: LightboxBoardRead, mode: 'open' | 'restore'): LightboxBoardAction {
    const { service, outputChannel } = this.ports;
    const what = fileId ?? 'a board file outside the boards folder';
    if (!service.isCurrentRequest(ticket)) {
      outputChannel.appendLine(`${LOG} Dropped the ${mode} of ${what}: a newer source was chosen`);
      return {};
    }
    const fail = (message: string): LightboxBoardAction => {
      outputChannel.appendLine(`${LOG} Could not ${mode} ${what}: ${message}`);
      if (mode === 'open') {
        service.refuseSource(ticket, { reason: 'unreadable', message, suggestion: OPEN_SUGGESTION });
      }
      return {};
    };
    if (read.kind !== 'board') {
      return fail(read.kind === 'missing' ? LIGHTBOX_BOARD_NOTICES.missing
        : read.kind === 'unavailable' ? LIGHTBOX_BOARD_NOTICES.unavailable
          : read.kind === 'busy' ? LIGHTBOX_BOARD_NOTICES.busy
            : LIGHTBOX_BOARD_NOTICES.unreadable);
    }
    const held = lightboxBoardOfFile(read.file);
    if (held.kind !== 'board') {
      return fail(LIGHTBOX_BOARD_NOTICES.severalSources);
    }
    // A run that began while the file was read keeps its board.
    if (this.reading(service.currentBoard()) || this.reading(service.retainedForSource(held.board.source))) {
      outputChannel.appendLine(`${LOG} The ${mode} of ${what} was refused: a run is reading the board it would replace`);
      return { notice: LIGHTBOX_BOARD_NOTICES.reading };
    }
    const savedAt = Date.parse(read.file.savedAt);
    const adopted = service.adoptSaved({
      board: held.board,
      text: held.text,
      ...(fileId !== undefined ? { fileId, revision: read.revision } : {}),
      savedAt,
      dropped: read.dropped,
      rereadPath: this.rereadPathOf(held.board),
      // The name its file shows: its own, or, for a file saved before names, the default its source and time give (Slice 5A.2).
      name: held.name ?? lightboxDefaultBoardName(held.board.source, savedAt, this.options.timeZone)
    }, ticket);
    if (adopted.kind === 'superseded') {
      return {};
    }
    // The adoption moved the reload pointer to this file (`onScreen`).
    outputChannel.appendLine(
      `${LOG} ${mode === 'open' ? 'Opened' : 'Restored'} ${what}` +
        (read.dropped > 0 ? `; ${read.dropped} unreadable parts were left out` : '')
    );
    return {};
  }

  /** Hold `write` as owed until it settles, and hand it back. */
  private owe<T>(write: Promise<T>): Promise<T> {
    this.owed.add(write);
    const settled = () => {
      this.owed.delete(write);
    };
    write.then(settled, settled);
    return write;
  }

  private reading(board: LightboxBoard | undefined): boolean {
    return board !== undefined && this.ports.runs.activeRun(board.boardId) !== undefined;
  }

  /** Whether a snapshot's file still holds the text it was read from; undefined for a board built now. */
  private async snapshotState(savable: LightboxSavableBoard): Promise<LightboxSnapshotState | undefined> {
    const { origin, board, rereadPath } = savable;
    if (origin.kind !== 'saved') {
      return undefined;
    }
    let file: LightboxSnapshotFile = 'none';
    if (board.source.kind === 'file') {
      file = 'unreadable';
      if (rereadPath) {
        try {
          const current = await this.ports.textSourceResolver.resolve({ mode: 'activeFile', pathText: rereadPath });
          file = lightboxContentHash(current.text) === board.source.contentHash ? 'same' : 'changed';
        } catch {
          this.ports.outputChannel.appendLine(`${LOG} Could not read ${board.source.displayPath} to compare a saved board`);
        }
      }
    }
    return {
      ...(origin.fileId !== undefined ? { fileId: origin.fileId } : { outside: true as const }),
      savedAt: origin.savedAt,
      file,
      dropped: origin.dropped
    };
  }

  /** Where a saved file source is now: its workspace-relative path under the one open folder. */
  private rereadPathOf(board: LightboxBoard): string | undefined {
    const folders = this.ports.workspace.workspaceFolders();
    if (board.source.kind !== 'file' || folders.length !== 1) {
      return undefined;
    }
    const candidate = path.resolve(folders[0].path, board.source.displayPath);
    return isPathWithinRoot(folders[0].path, candidate) ? candidate : undefined;
  }
}
