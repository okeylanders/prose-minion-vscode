/**
 * DocumentEditor - platform port for reading the writer's documents by URI
 * (ADR 2026-10-21 D3).
 *
 * A `vscode`-free interface so Draft Edit can place its findings against the
 * live text in any host:
 *   - VS Code adapter = `VsCodeDocumentEditor`, reading through
 *     `workspace.openTextDocument` (the buffer, unsaved edits included).
 *   - Desktop adapter = the desktop app's own document model.
 *
 * Slice 1 is the read half: a snapshot. The write half (`applyEdits`, behind
 * a version check and a review step) arrives with Proofread and Fix, and
 * only Draft Edit's applier may call it.
 */

export interface DocumentSnapshot {
  /** Opaque host id (`uri.toString()` in VS Code). */
  readonly uri: string;
  /** Changes on every edit to the buffer. */
  readonly version: number;
  /** The LIVE buffer, unsaved edits included; never the disk. */
  readonly text: string;
  readonly languageId: string;
}

export interface DocumentEditor {
  /** The document's live state, or undefined when the host cannot open it. */
  snapshot(uri: string): Promise<DocumentSnapshot | undefined>;
}
