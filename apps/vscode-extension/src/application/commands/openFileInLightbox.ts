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
 * This module never imports `vscode`: the composition root passes the host
 * as a port, so these rules are tested without a VS Code mock. Logs name
 * paths and reasons, never the writer's text.
 */

import type { LightboxSetSourcePayload } from '@prose-minion/core';

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
  /** `LightboxPanelProvider.seedSource`: opens or reveals the tab and boards the payload. */
  seedSource(payload: LightboxSetSourcePayload): void;
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
  | { kind: 'refused'; reason: OpenFileInLightboxRefusal; message: string };

interface Refusal {
  reason: OpenFileInLightboxRefusal;
  message: string;
  name?: string;
}

/**
 * Board `target` (a URI from a menu), or the active editor's file when there
 * is no target. Resolves once the payload is handed over or the refusal shown.
 */
export async function openFileInLightbox<U extends LightboxFileUri>(
  target: unknown,
  host: OpenFileInLightboxHost<U>
): Promise<OpenFileInLightboxOutcome> {
  const found = await findDocument(target, host);
  if ('reason' in found) {
    return refuse(host, found);
  }
  const document = found;
  const unsaved = schemeRefusal(document.uri);
  if (unsaved) {
    return refuse(host, unsaved);
  }
  if (!LIGHTBOX_FILE_LANGUAGE_IDS.includes(document.languageId)) {
    const name = fileName(document.uri);
    return refuse(host, {
      reason: 'unsupported-language',
      message: `The Lightbox opens Markdown and plain-text files, and “${name}” is neither.`,
      name
    });
  }

  const relativePath = host.asRelativePath(document.uri);
  const payload: LightboxSetSourcePayload = { sourceUri: document.uri.toString(), relativePath };
  host.seedSource(payload);
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

async function findDocument<U extends LightboxFileUri>(
  target: unknown,
  host: OpenFileInLightboxHost<U>
): Promise<LightboxFileDocument<U> | Refusal> {
  if (target === undefined || target === null) {
    return host.activeDocument() ?? {
      reason: 'no-file',
      message: 'Open a Markdown or plain-text file to board it in the Lightbox.'
    };
  }
  const uri = host.toUri(target);
  if (!uri) {
    return { reason: 'not-a-uri', message: 'Open File in Lightbox needs a file to open.' };
  }
  // Checked before opening: opening an untitled URI would create the document.
  const unsaved = schemeRefusal(uri);
  if (unsaved) {
    return unsaved;
  }
  try {
    return await host.openTextDocument(uri);
  } catch {
    const name = fileName(uri);
    return {
      reason: 'not-text',
      message: `“${name}” can’t be read as text. The Lightbox opens Markdown and plain-text files.`,
      name
    };
  }
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
