/** Workshop context, configured-resource, and message-attachment contracts. */

import { MessageEnvelope, MessageType } from '../base';
import { ContextPathGroup } from '../../context';
/**
 * Canonical configured-resource key from the context-path resolver, stamped
 * during source resolution so model-requested reads can cite `{ group, path }`
 * instead of reconstructing a path (Sprint 12).
 */
export interface WorkshopConfiguredResourceRef {
  group: ContextPathGroup;
  path: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message attachments — one-shot writer thread-artifacts (Sprint 12 Phase 6B;
// ADR 2026-07-18). They belong to exactly ONE room turn inside a
// `<thread-artifact id="ta-N">` frame and are delivered once per host/guest
// through room offsets. They have no standing budget and remain addressable by
// their stable host-minted id. Direct tool turns stay private.
// ─────────────────────────────────────────────────────────────────────────────

/** A message attachment carries a head slice past its cap, and the UI says so. */
export interface WorkshopMessageAttachmentTruncation {
  keptWords: number;
  totalWords: number;
}

/**
 * Display-safe pending/shipped message-attachment metadata. Content stays
 * host-side; the pill (and later the manifest row) is the inspectable
 * artifact. The id is the ADR's `ta-N` surgery/manifest address.
 */
export interface WorkshopMessageAttachmentSnapshot {
  /** Host-minted stable thread-artifact id (`ta-N`). */
  id: string;
  /** Display label: file basename. */
  label: string;
  words: number;
  /** Workspace-relative display path (never absolute). */
  relativePath?: string;
  configuredResource?: WorkshopConfiguredResourceRef;
  truncation?: WorkshopMessageAttachmentTruncation;
}

/**
 * Host-resolved source material a widget can read without asking a persona to
 * copy it into the recommendation. References remain display-safe across IPC;
 * the excerpt and attachment bodies never leave host-owned session state until
 * the writer deliberately generates.
 */
export type WorkshopWidgetSourceReference =
  | { kind: 'active-excerpt' }
  | { kind: 'context-attachment'; attachmentId: string };

// ─────────────────────────────────────────────────────────────────────────────
// Context attachments (Sprint 12) — the ordered, removable list that replaced
// the single paste-only context brief.
// ─────────────────────────────────────────────────────────────────────────────

/** Who put this attachment in the list. Wizard picks render with a wand. */
export type WorkshopContextAttachmentOrigin = 'writer' | 'wizard';

/** A file attachment carries a head slice, and the UI says so durably. */
export interface WorkshopContextAttachmentTruncation {
  keptWords: number;
  totalWords: number;
}

/**
 * Display-safe attachment metadata as exposed to the webview. Content stays
 * host-side — the pill is the inspectable artifact (label, kind, size,
 * remove control), never a second copy of the text.
 */
export interface WorkshopContextAttachmentSnapshot {
  /** Host-generated stable id; remove routes address this. */
  id: string;
  kind: 'text' | 'file';
  origin: WorkshopContextAttachmentOrigin;
  /** Display label: file basename, or the first words of a text note. */
  label: string;
  words: number;
  /** Workspace-relative display path (file kind only; never absolute). */
  relativePath?: string;
  configuredResource?: WorkshopConfiguredResourceRef;
  truncation?: WorkshopContextAttachmentTruncation;
  /**
   * Text-kind ONLY: the note's full content, so the pill is inspectable —
   * typed notes and wizard briefs have no on-disk home to re-read. File
   * content stays host-side (re-readable, potentially large).
   */
  content?: string;
  /** Epoch ms when attached (host-stamped). */
  addedAt: number;
}

/** Add a typed/pasted context note; the host derives the label and word count. */
export interface WorkshopAddContextTextPayload {
  text: string;
}

export interface WorkshopAddContextTextMessage
  extends MessageEnvelope<WorkshopAddContextTextPayload> {
  type: MessageType.WORKSHOP_ADD_CONTEXT_TEXT;
}

/**
 * Add a file attachment via the host's file picker (Sprint 12; the Context
 * Selector modal's "Explore project folders…" escape hatch reuses this
 * route). Zero payload — the dialog IS the input.
 */
export interface WorkshopAddContextFileMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_ADD_CONTEXT_FILE;
}

/**
 * Re-read every file-backed standing context attachment and adopt only the
 * snapshots whose bounded prompt text changed. Text notes are session-owned
 * and intentionally excluded.
 */
export interface WorkshopRefreshContextFilesMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REFRESH_CONTEXT_FILES;
}

export interface WorkshopRemoveContextAttachmentPayload {
  id: string;
}

export interface WorkshopRemoveContextAttachmentMessage
  extends MessageEnvelope<WorkshopRemoveContextAttachmentPayload> {
  type: MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT;
}

/**
 * Replace one text attachment's body from the shared Edit/Preview sheet.
 * Writer notes and wizard-generated briefs are session-owned; file-backed
 * attachments always remain read-only and refresh from their source.
 */
export interface WorkshopUpdateContextTextPayload {
  id: string;
  text: string;
}

export interface WorkshopUpdateContextTextMessage
  extends MessageEnvelope<WorkshopUpdateContextTextPayload> {
  type: MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT;
}

/**
 * Fetch one attachment's body for the Edit/Preview sheet (Sprint 13A).
 * Attachment content is prompt-bearing host state and is deliberately NOT in
 * every session snapshot (the shared budget is 50,000 words) — the webview
 * asks for exactly the one the writer opened.
 */
export interface WorkshopRequestContextAttachmentPayload {
  id: string;
}

export interface WorkshopRequestContextAttachmentMessage
  extends MessageEnvelope<WorkshopRequestContextAttachmentPayload> {
  type: MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT;
}

export interface WorkshopContextAttachmentContentPayload {
  id: string;
  /** Absent when the attachment was removed between request and reply. */
  content?: string;
  /** Display-safe reason when the body could not be produced. */
  error?: string;
  /** True when the host can open this attachment's source in an editor tab. */
  canOpenInEditor: boolean;
}

export interface WorkshopContextAttachmentContentMessage
  extends MessageEnvelope<WorkshopContextAttachmentContentPayload> {
  type: MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT;
}

/**
 * Open a file-backed attachment's source in a host editor tab (Sprint 13A).
 * The webview sheet is the prettified markdown read; this is the escape hatch
 * to the real document. Routed through the ShellService port, so core stays
 * host-agnostic.
 */
export interface WorkshopOpenContextAttachmentFilePayload {
  id: string;
}

export interface WorkshopOpenContextAttachmentFileMessage
  extends MessageEnvelope<WorkshopOpenContextAttachmentFilePayload> {
  type: MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Selector modal (Sprint 12 Phase 4) — browse/search the configured
// resource catalog and attach by canonical { group, path }. Display-safe
// resolver paths only; no absolute path ever crosses this contract.
// ─────────────────────────────────────────────────────────────────────────────

/** One configured resource as the modal browses it. */
export interface WorkshopContextCatalogEntry {
  group: ContextPathGroup;
  /** Resolver's display-safe workspace-relative path — the canonical key. */
  path: string;
  label: string;
  /** Byte size from catalog admission; word counts happen at attach time. */
  sizeBytes: number;
}

/** Sent on modal open: "give me the configured resource catalog". */
export interface WorkshopRequestContextCatalogMessage
  extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG;
}

export interface WorkshopContextCatalogPayload {
  entries: WorkshopContextCatalogEntry[];
}

export interface WorkshopContextCatalogMessage
  extends MessageEnvelope<WorkshopContextCatalogPayload> {
  type: MessageType.WORKSHOP_CONTEXT_CATALOG;
}

/**
 * Content search over the configured catalog (name matching is client-side —
 * the webview already holds the catalog). Runs under the same byte/file
 * bounds as the persona capability's resource.search.
 */
export interface WorkshopSearchContextResourcesPayload {
  query: string;
}

export interface WorkshopSearchContextResourcesMessage
  extends MessageEnvelope<WorkshopSearchContextResourcesPayload> {
  type: MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES;
}

export interface WorkshopContextSearchResultsPayload {
  query: string;
  matches: WorkshopConfiguredResourceRef[];
  /** True when a file/byte bound stopped the scan early. */
  bounded: boolean;
}

export interface WorkshopContextSearchResultsMessage
  extends MessageEnvelope<WorkshopContextSearchResultsPayload> {
  type: MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS;
}

/** Attach selected configured resources, in the writer's selection order. */
export interface WorkshopAddContextResourcesPayload {
  items: WorkshopConfiguredResourceRef[];
}

/**
 * Run the Context wizard (Sprint 12): the sidebar Context lane's generation
 * pipeline behind Workshop-scoped routes and the 'workshop-context' streaming
 * domain. One run at a time; results land as wizard-tagged attachments
 * through the standard add path. Zero payload — session state IS the input.
 */
export interface WorkshopRunContextWizardMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_RUN_CONTEXT_WIZARD;
}

export interface WorkshopAddContextResourcesMessage
  extends MessageEnvelope<WorkshopAddContextResourcesPayload> {
  type: MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES;
}

/**
 * Stage configured resources as attachments for the writer's next composer
 * message (Phase 6B): one-shot thread-artifacts, NOT standing context.
 */
export interface WorkshopAttachMessageResourcesPayload {
  items: WorkshopConfiguredResourceRef[];
}

export interface WorkshopAttachMessageResourcesMessage
  extends MessageEnvelope<WorkshopAttachMessageResourcesPayload> {
  type: MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES;
}

/**
 * Stage an explored file (host picker) as a next-message attachment
 * (Phase 6B). Zero payload — the dialog IS the input.
 */
export interface WorkshopAttachMessageFileMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_ATTACH_MESSAGE_FILE;
}

export interface WorkshopRemoveMessageAttachmentPayload {
  id: string;
}

export interface WorkshopRemoveMessageAttachmentMessage
  extends MessageEnvelope<WorkshopRemoveMessageAttachmentPayload> {
  type: MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT;
}
