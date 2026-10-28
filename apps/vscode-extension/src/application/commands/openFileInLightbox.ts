/**
 * Open File in Lightbox (launch entry points, 2026-10-20; ADR 2026-10-19 D1).
 *
 * The adapter's one path for boarding a whole file. The Explorer, editor
 * title and editor context menus pass the file's URI; the Command Palette
 * passes nothing, so the active editor's file is used; and "Open Selection in
 * Lightbox" with nothing selected arrives here the same way. The result is the
 * selection command's `LightboxSetSourcePayload` without text, handed to
 * `LightboxPanelProvider.seedSource`: there is no second board path. With
 * several files selected in the Explorer, VS Code passes the one right-clicked
 * first, and that one is boarded (one file per board, writer decision 7).
 *
 * Only the checks the host alone can make live here. Each refusal is a
 * message, and nothing is sent:
 * - An untitled document has no file behind it. It is refused, and the
 *   message points to Open Selection in Lightbox, which boards its text as a
 *   selection the writer chose, not as a file it is not.
 * - A URI that is not on disk (`file:`), cannot be read as text, or is not
 *   Markdown or plain text is refused.
 * The rest belongs to the Lightbox: a file over the word ceiling, empty, or
 * outside the workspace is refused in the tab by LightboxHandler, exactly as
 * for "Choose file".
 *
 * A dirty document boards its saved copy. The file source, "Re-read file"
 * and the handoff's hash check (D4) all read the file on disk, so a board of
 * unsaved editor text would be stale against its own file the moment it
 * appeared. The writer is told that the unsaved changes are not on it.
 *
 * Source ownership (PR #152 F-01). Loading a menu's URI is asynchronous, so
 * the launch takes the Lightbox's source-request ticket as soon as its target
 * is concrete, before that first await, and boards under it. Every other
 * source (a selection, a picked file, a re-read) takes a newer ticket when
 * the writer chooses it, so a launch whose document loads late is dropped
 * rather than replacing the newer source. The ticket is taken after the
 * refusals that need no loading (no file, not a URI, untitled, not on disk,
 * an active document in another language): those take no request and
 * change nothing. A launch refused after loading (unreadable as text, or
 * another language) has taken one. It still counts as the writer's newest
 * choice, as a source the Lightbox refuses does, so an older launch still
 * loading is dropped; but nothing is sent, so the board and any standing
 * refusal stay as they were, and the next choice takes a newer ticket.
 *
 * This module never imports `vscode`: the composition root passes the host
 * as a port, so these rules are tested without a VS Code mock. Logs name
 * paths and reasons, never the writer's text.
 */

import type { LightboxSetSourcePayload, LightboxSourceTicket } from '@prose-minion/core';

/** The language ids the menus offer the command for, and the only ones it boards. */
export const LIGHTBOX_FILE_LANGUAGE_IDS: readonly string[] = ['markdown', 'plaintext'];

/** The parts of a URI this command reads; a `vscode.Uri` has them all. */
export interface LightboxFileUri {
  readonly scheme: string;
  readonly path: string;
  toString(): string;
}

/** The parts of a text document this command reads; a `vscode.TextDocument` has them all. */
export interface LightboxFileDocument<U extends LightboxFileUri> {
  readonly uri: U;
  readonly languageId: string;
  readonly isDirty: boolean;
}

/** What the composition root provides: VS Code's editor, workspace and window, and the Lightbox panel. */
export interface OpenFileInLightboxHost<U extends LightboxFileUri> {
  /** The command's argument as a URI, or undefined when it is not one. */
  toUri(value: unknown): U | undefined;
  /** The active editor's document, if there is one. */
  activeDocument(): LightboxFileDocument<U> | undefined;
  /** Loads the document at `uri` without showing it; rejects when it cannot be read as text. */
  openTextDocument(uri: U): PromiseLike<LightboxFileDocument<U>>;
  asRelativePath(uri: U): string;
  /** The shared LightboxService's `beginSourceRequest`: this launch becomes the writer's newest source request. */
  beginSourceRequest(): LightboxSourceTicket;
  /**
   * `LightboxPanelProvider.seedSource`: opens or reveals the tab and boards the
   * payload under `ticket`. False when a newer source was chosen meanwhile:
   * then nothing is opened or sent.
   */
  seedSource(payload: LightboxSetSourcePayload, ticket: LightboxSourceTicket): boolean;
  showWarning(message: string): void;
  showInformation(message: string): void;
  log(line: string): void;
}

export type OpenFileInLightboxRefusal =
  | 'no-file'
  | 'not-a-uri'
  | 'untitled'
  | 'not-on-disk'
  | 'not-text'
  | 'unsupported-language';

export type OpenFileInLightboxOutcome =
  | { kind: 'seeded'; payload: LightboxSetSourcePayload; savedCopyOnly: boolean }
  /** The document loaded after the writer chose a newer source; nothing was sent. */
  | { kind: 'superseded'; payload: LightboxSetSourcePayload }
  | { kind: 'refused'; reason: OpenFileInLightboxRefusal; message: string };

interface Refusal {
  reason: OpenFileInLightboxRefusal;
  message: string;
  name?: string;
}

/** A target known without awaiting: a document already open, or a file URI still to load. */
type ChosenTarget<U extends LightboxFileUri> =
  | { kind: 'document'; document: LightboxFileDocument<U> }
  | { kind: 'uri'; uri: U };

/**
 * Board `target` (a URI from a menu), or the active editor's file when there
 * is no target. Resolves once the payload is handed over, dropped for a newer
 * source, or the refusal shown.
 */
export async function openFileInLightbox<U extends LightboxFileUri>(
  target: unknown,
  host: OpenFileInLightboxHost<U>
): Promise<OpenFileInLightboxOutcome> {
  const chosen = chooseTarget(target, host);
  if ('reason' in chosen) {
    return refuse(host, chosen);
  }
  // The target is concrete: own the request before the first await (PR #152 F-01).
  const ticket = host.beginSourceRequest();
  const document = chosen.kind === 'document' ? chosen.document : await loadDocument(chosen.uri, host);
  if ('reason' in document) {
    return refuse(host, document);
  }

  const relativePath = host.asRelativePath(document.uri);
  const payload: LightboxSetSourcePayload = { sourceUri: document.uri.toString(), relativePath };
  if (!host.seedSource(payload, ticket)) {
    host.log(`[Lightbox] Open File in Lightbox: dropped ${relativePath}; a newer source was chosen while it loaded`);
    return { kind: 'superseded', payload };
  }
  if (document.isDirty) {
    host.log(`[Lightbox] Open File in Lightbox: boarding the saved copy of ${relativePath}; the editor has unsaved changes`);
    host.showInformation(
      `The Lightbox boarded the saved copy of “${relativePath}”. ` +
        'Your unsaved changes are not on the board: save, then choose Re-read file.'
    );
  } else {
    host.log(`[Lightbox] Open File in Lightbox: boarding ${relativePath}`);
  }
  return { kind: 'seeded', payload, savedCopyOnly: document.isDirty };
}

/** Every check that needs no loading. */
function chooseTarget<U extends LightboxFileUri>(
  target: unknown,
  host: OpenFileInLightboxHost<U>
): ChosenTarget<U> | Refusal {
  if (target === undefined || target === null) {
    const active = host.activeDocument();
    if (!active) {
      return { reason: 'no-file', message: 'Open a Markdown or plain-text file to board it in the Lightbox.' };
    }
    return documentRefusal(active) ?? { kind: 'document', document: active };
  }
  const uri = host.toUri(target);
  if (!uri) {
    return { reason: 'not-a-uri', message: 'Open File in Lightbox needs a file to open.' };
  }
  // Checked before opening: opening an untitled URI would create the document.
  return schemeRefusal(uri) ?? { kind: 'uri', uri };
}

async function loadDocument<U extends LightboxFileUri>(
  uri: U,
  host: OpenFileInLightboxHost<U>
): Promise<LightboxFileDocument<U> | Refusal> {
  let document: LightboxFileDocument<U>;
  try {
    document = await host.openTextDocument(uri);
  } catch {
    const name = fileName(uri);
    return {
      reason: 'not-text',
      message: `“${name}” can’t be read as text. The Lightbox opens Markdown and plain-text files.`,
      name
    };
  }
  return documentRefusal(document) ?? document;
}

/** A document the Lightbox cannot board: not on disk, or neither Markdown nor plain text. */
function documentRefusal<U extends LightboxFileUri>(document: LightboxFileDocument<U>): Refusal | undefined {
  const unsaved = schemeRefusal(document.uri);
  if (unsaved) {
    return unsaved;
  }
  if (LIGHTBOX_FILE_LANGUAGE_IDS.includes(document.languageId)) {
    return undefined;
  }
  const name = fileName(document.uri);
  return {
    reason: 'unsupported-language',
    message: `The Lightbox opens Markdown and plain-text files, and “${name}” is neither.`,
    name
  };
}

/** Untitled and other non-disk documents: there is no file for the Lightbox to read or re-read. */
function schemeRefusal(uri: LightboxFileUri): Refusal | undefined {
  if (uri.scheme === 'file') {
    return undefined;
  }
  const name = fileName(uri);
  if (uri.scheme === 'untitled') {
    return {
      reason: 'untitled',
      message:
        `“${name}” isn’t saved yet, so there is no file to board. ` +
        'Save it first, or select its text and run Open Selection in Lightbox.',
      name
    };
  }
  return {
    reason: 'not-on-disk',
    message: `The Lightbox boards files saved on disk, and “${name}” is not one.`,
    name
  };
}

function refuse<U extends LightboxFileUri>(
  host: OpenFileInLightboxHost<U>,
  refusal: Refusal
): OpenFileInLightboxOutcome {
  host.log(`[Lightbox] Open File in Lightbox refused (${refusal.reason})${refusal.name ? `: ${refusal.name}` : ''}`);
  host.showWarning(refusal.message);
  return { kind: 'refused', reason: refusal.reason, message: refusal.message };
}

function fileName(uri: LightboxFileUri): string {
  return uri.path.split('/').filter(Boolean).pop() ?? uri.toString();
}
