/**
 * The Lightbox's handoffs to the Workshop, and its tray (ADR 2026-10-19 D11;
 * Slices 3 and 4). Owned by `LightboxHandler`, which routes `LIGHTBOX_HAND_OFF`,
 * `LIGHTBOX_OPEN_WORKSHOP` and the tray's mount here; split out so the
 * handler stays within its size. Holds no service of its own: everything is
 * the handler's, passed in.
 *
 * **Handoffs.** `LIGHTBOX_HAND_OFF` names an item on the board the webview
 * shows, by id only. Every check runs against the host's current board and
 * text: the board is still the one on screen; for a file, the file on disk
 * still has the board's hash (read before anything leaves); then the pure
 * preparation for the kind resolves the item, refuses a stale, withheld or
 * re-reading one, re-checks its quotes and bounds what leaves
 * (`LightboxHandoff` for a borrowed field, `LightboxTileHandoff` for a
 * reading tile). The composition root's `handOffToWorkshop` carries it into
 * the Workshop's own message path and settles with the Workshop's answer:
 * opened (a tile: staged above the composer) only when a visible Workshop
 * claimed it. One handoff at a time per tab, refused rather than queued, and
 * none from a closed tab: nothing is posted after the tab closed.
 *
 * **The tray.** What the Workshop holds: the Lightbox tiles waiting above its
 * composer, read through a port the composition supplies, posted on mount
 * and reveal and whenever the Workshop's pending attachments change. The
 * Lightbox never changes them; it only reads them.
 *
 * Logs name kinds, counts, paths and host-owned refusals; never a reading's
 * words, a term or a quote.
 */

import { LogSink } from '@/platform';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  LIGHTBOX_HANDOFF_REFUSALS,
  LIGHTBOX_SEED_HAND_OFF_KIND,
  LIGHTBOX_WORKSHOP_REFUSALS,
  lightboxHandoffSentMessage,
  parseLightboxHandOffRequest,
  prepareLightboxHandoff
} from '@/infrastructure/lightbox/LightboxHandoff';
import {
  LIGHTBOX_TILE_HANDOFF_REFUSALS,
  LIGHTBOX_TILE_WORKSHOP_REFUSALS,
  lightboxTileStagedMessage,
  prepareLightboxTileHandoff
} from '@/infrastructure/lightbox/LightboxTileHandoff';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import {
  LightboxHandOffPayload,
  LightboxHandOffResultMessage,
  LightboxWorkshopHandoff,
  LightboxWorkshopHandoffOutcome,
  LightboxWorkshopHandoffRefusal,
  LightboxWorkshopTrayMessage,
  LightboxWorkshopTrayTile,
  MessageType
} from '@messages';
import { MessageTransport } from '@handlers/MessageHandlerContracts';

const SOURCE = 'extension.lightbox';

/** The composition root's handoff into the Workshop; settles with the Workshop's answer (PR #150 F-03). */
export type LightboxWorkshopHandoffPort = (handoff: LightboxWorkshopHandoff) => Promise<LightboxWorkshopHandoffOutcome>;

/** What the Workshop holds for the Lightbox: the tiles waiting above its composer, and word when they change. */
export interface LightboxWorkshopTrayPort {
  read(): LightboxWorkshopTrayTile[];
  /** Returns the unsubscribe closure its caller must own. */
  subscribe(listener: () => void): () => void;
}

/** The Workshop ports a Lightbox tab may use beyond the handoff itself. */
export interface LightboxWorkshopPorts {
  tray?: LightboxWorkshopTrayPort;
  openWorkshop?: () => void;
}

export interface LightboxHandoffRouteDependencies extends LightboxWorkshopPorts {
  lightboxService: LightboxService;
  textSourceResolver: TextSourceResolver;
  postMessage: MessageTransport;
  outputChannel: LogSink;
  handOffToWorkshop?: LightboxWorkshopHandoffPort;
}

/** The words each kind's checks use where they differ. */
const WORDS = {
  [LIGHTBOX_SEED_HAND_OFF_KIND]: {
    busy: LIGHTBOX_HANDOFF_REFUSALS.busy,
    boardChanged: LIGHTBOX_HANDOFF_REFUSALS.boardChanged,
    fileChanged: LIGHTBOX_HANDOFF_REFUSALS.fileChanged,
    workshop: LIGHTBOX_WORKSHOP_REFUSALS
  },
  tile: {
    busy: LIGHTBOX_TILE_HANDOFF_REFUSALS.busy,
    boardChanged: LIGHTBOX_TILE_HANDOFF_REFUSALS.boardChanged,
    fileChanged: LIGHTBOX_TILE_HANDOFF_REFUSALS.fileChanged,
    workshop: LIGHTBOX_TILE_WORKSHOP_REFUSALS
  }
} as const;

type LightboxHandoffWords = (typeof WORDS)[keyof typeof WORDS];

/** Outcomes after which a granted tile may have been staged though its answer never arrived (F-08). */
const LOST_ANSWERS: ReadonlySet<LightboxWorkshopHandoffRefusal> = new Set<LightboxWorkshopHandoffRefusal>(['reset', 'closed']);

export class LightboxHandoffRoute {
  /** True while a handoff is being checked or awaited; a second press is refused, not queued. */
  private handingOff = false;
  private disposed = false;
  private trayUnsubscribe?: () => void;

  constructor(private readonly deps: LightboxHandoffRouteDependencies) {}

  /** Nothing more is posted; the tray stops listening. A handoff in flight settles without a word. */
  dispose(): void {
    this.disposed = true;
    this.trayUnsubscribe?.();
    this.trayUnsubscribe = undefined;
  }

  /** Hear the Workshop's tray, once (the handler calls this on its webview's first Lightbox message). */
  subscribeTray(): void {
    if (this.trayUnsubscribe || this.disposed || !this.deps.tray) {
      return;
    }
    this.trayUnsubscribe = this.deps.tray.subscribe(() => this.postTray());
  }

  /** Post what the Workshop holds now; a tab with no tray port posts nothing, and its tray stays empty. */
  postTray(): void {
    const tray = this.deps.tray;
    if (this.disposed || !tray) {
      return;
    }
    const message: LightboxWorkshopTrayMessage = {
      type: MessageType.LIGHTBOX_WORKSHOP_TRAY,
      source: SOURCE,
      payload: { tiles: tray.read() },
      timestamp: Date.now()
    };
    void this.deps.postMessage(message);
  }

  /** The tray's "Open Workshop →". */
  openWorkshop(): void {
    if (!this.disposed) {
      this.deps.openWorkshop?.();
    }
  }

  async handle(payload: unknown): Promise<void> {
    if (this.disposed) {
      return;
    }
    const request = parseLightboxHandOffRequest(payload);
    const words = WORDS[request?.kind ?? LIGHTBOX_SEED_HAND_OFF_KIND];
    const sent = payload as { boardId?: unknown; fieldId?: unknown } | undefined;
    const echo: LightboxHandOffPayload = request ?? {
      kind: LIGHTBOX_SEED_HAND_OFF_KIND,
      boardId: String(sent?.boardId ?? ''),
      fieldId: String(sent?.fieldId ?? '')
    };
    const refuse = (reason: string): void => {
      this.deps.outputChannel.appendLine(`[LightboxHandler] Handoff refused: ${reason}`);
      this.postResult({ ...echo, ok: false, message: reason });
    };
    if (!request) {
      refuse(LIGHTBOX_HANDOFF_REFUSALS.unknown);
      return;
    }
    if (this.handingOff) {
      refuse(words.busy);
      return;
    }
    this.handingOff = true;
    try {
      await this.handOff(request, words, refuse);
    } finally {
      this.handingOff = false;
    }
  }

  private async handOff(
    request: LightboxHandOffPayload,
    words: LightboxHandoffWords,
    refuse: (reason: string) => void
  ): Promise<void> {
    const { lightboxService, outputChannel } = this.deps;
    const onScreen = () => lightboxService.currentBoard()?.boardId === request.boardId;
    if (!onScreen()) {
      refuse(words.boardChanged);
      return;
    }
    // A file may have changed on disk since it was boarded: check before anything leaves (D4).
    const target = lightboxService.currentRereadTarget();
    if (target) {
      let current: string;
      try {
        current = (await this.deps.textSourceResolver.resolve({ mode: 'activeFile', pathText: target.rereadPath })).text;
      } catch {
        // The resolver's own wording stays out of the log; the path and the refusal say enough.
        outputChannel.appendLine(`[LightboxHandler] Could not read ${target.displayPath} to check a handoff`);
        refuse(LIGHTBOX_HANDOFF_REFUSALS.fileUnreadable);
        return;
      }
      if (this.disposed) {
        outputChannel.appendLine('[LightboxHandler] Handoff dropped: the Lightbox closed while its file was checked');
        return;
      }
      const board = lightboxService.currentBoard();
      if (!onScreen() || !board) {
        refuse(words.boardChanged);
        return;
      }
      if (lightboxContentHash(current) !== board.source.contentHash) {
        refuse(words.fileChanged);
        return;
      }
    }
    const reading = lightboxService.readingSource(request.boardId);
    if (!reading || !onScreen()) {
      refuse(words.boardChanged);
      return;
    }
    const prepared = request.kind === 'tile'
      ? prepareLightboxTileHandoff(request, reading.board, reading.paragraphTexts)
      : prepareLightboxHandoff(request, reading.board, reading.paragraphTexts);
    if (!prepared.ok) {
      refuse(prepared.reason);
      return;
    }
    if (!this.deps.handOffToWorkshop) {
      refuse(LIGHTBOX_HANDOFF_REFUSALS.noWorkshop);
      return;
    }
    // "Sent" means a visible Workshop claimed and opened (or staged) it: wait for its answer, bounded by the provider.
    const outcome = await this.deps.handOffToWorkshop(prepared.handoff);
    if (this.disposed) {
      outputChannel.appendLine('[LightboxHandler] Handoff answered after the Lightbox closed; nothing posted');
      return;
    }
    if (!outcome.opened) {
      if (prepared.handoff.kind === 'tile' && LOST_ANSWERS.has(outcome.reason) && this.trayHolds(prepared.handoff.tile)) {
        // The Workshop staged it, but its answer was lost: its webview reloaded or its panel
        // closed in between. The session it staged into is its own record, so it counts.
        outputChannel.appendLine(`[LightboxHandler] The Workshop staged a tile; its answer was lost (${outcome.reason}), the session holds it`);
        this.postResult({ ...request, ok: true, message: lightboxTileStagedMessage(prepared.handoff) });
        return;
      }
      refuse(words.workshop[outcome.reason]);
      return;
    }
    const found = `${prepared.quotesFound} of ${prepared.quotesChecked} quotes found again`;
    if (prepared.handoff.kind === 'tile') {
      outputChannel.appendLine(`[LightboxHandler] The Workshop staged a tile: ${prepared.handoff.tile.quotes.length} quotes carried, ${found}`);
      this.postResult({ ...request, ok: true, message: lightboxTileStagedMessage(prepared.handoff) });
      return;
    }
    outputChannel.appendLine(
      `[LightboxHandler] The Workshop opened a borrowed field: ${prepared.handoff.seed.terms.length} counted terms, ${found}`
    );
    this.postResult({ ...request, ok: true, message: lightboxHandoffSentMessage(prepared.handoff) });
  }

  /** Whether the Workshop's session holds this tile above its composer now. */
  private trayHolds(tile: { boardId: string; tileId: string }): boolean {
    return this.deps.tray?.read().some((held) => held.boardId === tile.boardId && held.tileId === tile.tileId) ?? false;
  }

  private postResult(payload: LightboxHandOffResultMessage['payload']): void {
    const message: LightboxHandOffResultMessage = {
      type: MessageType.LIGHTBOX_HAND_OFF_RESULT,
      source: SOURCE,
      payload,
      timestamp: Date.now()
    };
    void this.deps.postMessage(message);
  }
}
