/**
 * Lightbox passages (Slice 4E; ADR 2026-10-19 D10, D12): the third Lightbox
 * handler, beside `LightboxHandler` (the board) and `LightboxReadingHandler`
 * (the readings), composed like them in `MessageHandler`.
 *
 * `LIGHTBOX_REQUEST_PASSAGE` asks for the text a pinned paragraph or counted
 * item stands in, by board id and content hash. The host answers from the
 * text that board was measured from (`LightboxService.passageSource`), never
 * from the file as it is now, so the passage is what was counted:
 * - a board no longer held, or held over other text, is refused as
 *   `changed`, so the webview never shows another text as this board's;
 * - a paragraph or term the board does not list is refused as
 *   `not-on-board`;
 * - otherwise the passage is cut by `buildLightboxPassage`.
 *
 * The reply echoes the request's id, board id and hash
 * (`LIGHTBOX_PASSAGE`), and the webview takes only the one it waits for. A
 * request with no id is ignored, as the project picker's are (PR #154 F-01).
 * Nothing is kept here: the reply is computed and posted.
 *
 * Logs name the item's kind and the counts, and say when a passage's
 * instances disagree with the board's figure. They never carry the text,
 * the word or the phrase.
 */

import type { LogSink } from '@/platform';
import {
  LightboxPassage,
  LightboxPassageItem,
  LightboxPassageMessage,
  LightboxPassageTerm,
  LightboxRequestPassageMessage,
  MessageType
} from '@messages';
import { LIGHTBOX_PASSAGE_BOUNDS, isLightboxStyleFlagId } from '@shared/constants/lightboxPassages';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import type { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { buildLightboxPassage, lightboxBoardCountOf } from '@/infrastructure/lightbox/LightboxPassages';

const SOURCE = 'extension.lightbox';
const PARTS_OF_SPEECH = ['nouns', 'verbs', 'adjectives', 'adverbs'] as const;

/** What a term is, for a log line that names no word. */
const TERM_LOG_NAMES: Readonly<Record<LightboxPassageTerm['kind'], string>> = {
  word: 'a top word',
  pos: 'a part-of-speech word',
  phrase: 'a repeated phrase',
  hapax: 'a hapax word',
  flag: 'a style flag'
};

export class LightboxPassageHandler {
  constructor(
    private readonly lightboxService: Pick<LightboxService, 'passageSource'>,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LIGHTBOX_REQUEST_PASSAGE, this.handleRequestPassage.bind(this));
  }

  async handleRequestPassage(message: LightboxRequestPassageMessage): Promise<void> {
    const payload = message.payload as Partial<LightboxRequestPassageMessage['payload']> | undefined;
    const requestId = boundedName(payload?.requestId);
    const boardId = boundedName(payload?.boardId);
    const contentHash = boundedName(payload?.contentHash);
    if (!requestId || !boardId || !contentHash) {
      this.outputChannel.appendLine('[LightboxPassageHandler] A passage request without its request id, board id or hash was ignored.');
      return;
    }
    const item = passageItemOf(payload?.item);
    const source = this.lightboxService.passageSource(boardId);
    let passage: LightboxPassage;
    if (!source || source.board.source.contentHash !== contentHash) {
      passage = { kind: 'refused', reason: 'changed' };
    } else if (!item) {
      passage = { kind: 'refused', reason: 'not-on-board' };
    } else {
      passage = buildLightboxPassage(source.board, source.passages, item);
      if (passage.kind === 'instances' && item.kind === 'instances') {
        const counted = lightboxBoardCountOf(source.board, item.term);
        if (counted !== passage.instances) {
          this.outputChannel.appendLine(
            `[LightboxPassageHandler] ✗ ${TERM_LOG_NAMES[item.term.kind]}: ${passage.instances} instances found, ` +
            `but the board counts ${counted ?? 'none'}.`
          );
        }
      }
    }
    this.outputChannel.appendLine(`[LightboxPassageHandler] ${logLine(item, passage)} (board ${boardId}).`);
    const reply: LightboxPassageMessage = {
      type: MessageType.LIGHTBOX_PASSAGE,
      source: SOURCE,
      payload: { requestId, boardId, contentHash, passage },
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }
}

/** A non-empty string within the bound, or undefined. */
function boundedName(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= LIGHTBOX_PASSAGE_BOUNDS.nameCharacters ? value : undefined;
}

function paragraphNumber(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 1 ? (value as number) : undefined;
}

/** A term exactly as the contract shapes it, or undefined. */
function passageTermOf(value: unknown): LightboxPassageTerm | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const word = boundedName(record.word);
  switch (record.kind) {
    case 'word':
      return word ? { kind: 'word', word } : undefined;
    case 'hapax':
      return word ? { kind: 'hapax', word } : undefined;
    case 'pos': {
      const pos = PARTS_OF_SPEECH.find((candidate) => candidate === record.pos);
      return word && pos ? { kind: 'pos', pos, word } : undefined;
    }
    case 'phrase': {
      const phrase = boundedName(record.phrase);
      return phrase ? { kind: 'phrase', phrase } : undefined;
    }
    case 'flag':
      return isLightboxStyleFlagId(record.flag) ? { kind: 'flag', flag: record.flag } : undefined;
    default:
      return undefined;
  }
}

/** An item exactly as the contract shapes it, or undefined. */
function passageItemOf(value: unknown): LightboxPassageItem | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === 'instances') {
    const term = passageTermOf(record.term);
    return term ? { kind: 'instances', term } : undefined;
  }
  if (record.kind === 'paragraphs') {
    const from = paragraphNumber(record.from);
    const to = paragraphNumber(record.to);
    const via = record.via === undefined ? undefined : passageTermOf(record.via);
    if (from === undefined || to === undefined || (record.via !== undefined && !via)) {
      return undefined;
    }
    return { kind: 'paragraphs', from, to, ...(via ? { via } : {}) };
  }
  return undefined;
}

/** What was asked and answered, in counts: no text, no word. */
function logLine(item: LightboxPassageItem | undefined, passage: LightboxPassage): string {
  const asked = !item
    ? 'An unreadable passage request'
    : item.kind === 'paragraphs'
      ? `¶${item.from}–¶${item.to}${item.via ? `, lit by ${TERM_LOG_NAMES[item.via.kind]}` : ''}`
      : `The instances of ${TERM_LOG_NAMES[item.term.kind]}`;
  switch (passage.kind) {
    case 'refused':
      return `${asked}: refused, ${passage.reason}`;
    case 'paragraphs':
      return `${asked}: ${counted(passage.paragraphs.length, 'paragraph')} sent, ${passage.moreParagraphs} past the bound` +
        (passage.lit !== undefined ? `, ${passage.lit} lit` : '');
    case 'instances':
      return `${asked}: ${passage.instances} in ${counted(passage.sentences, 'sentence')}, ${counted(passage.rows.length, 'row')} sent, ` +
        `${passage.more.rows} past the bound`;
  }
}

function counted(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
