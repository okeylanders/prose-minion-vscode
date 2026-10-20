/**
 * The Lightbox's project files (2026-10-20; ADR 2026-10-19 D1, D10): the
 * shared project picker over the writer's configured resources, behind the
 * Lightbox's own routes.
 *
 * The catalog it browses holds only the files the Lightbox can read
 * (Markdown and plain text, `LIGHTBOX_TEXT_FILE_EXTENSIONS`); anything else
 * is left out host-side. The webview names a file by its catalog key
 * (`ConfiguredResourceRef`: group and workspace-relative path), never by a
 * path or URI the host would trust. The host finds the key in a fresh
 * catalog, checks the file is text and inside an open workspace folder, and
 * reads it from there.
 */

import { MessageEnvelope, MessageType } from './base';
import type {
  ConfiguredResourceCatalogPayload,
  ConfiguredResourceRef,
  ConfiguredResourceSearchPayload,
  ConfiguredResourceSearchResults
} from './configuredResources';

/** The picker opened: send the project's readable files. Zero payload. */
export interface LightboxRequestProjectCatalogMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG;
}

export interface LightboxProjectCatalogPayload extends ConfiguredResourceCatalogPayload {
  /** The configured folders could not be read; `entries` is empty. */
  unreadable?: boolean;
}

export interface LightboxProjectCatalogMessage extends MessageEnvelope<LightboxProjectCatalogPayload> {
  type: MessageType.LIGHTBOX_PROJECT_CATALOG;
}

/** "Names + content": search the readable files' text. */
export interface LightboxSearchProjectCatalogMessage extends MessageEnvelope<ConfiguredResourceSearchPayload> {
  type: MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG;
}

export interface LightboxProjectCatalogSearchResultsMessage
  extends MessageEnvelope<ConfiguredResourceSearchResults> {
  type: MessageType.LIGHTBOX_PROJECT_CATALOG_SEARCH_RESULTS;
}

/**
 * Board a project file as the source. The writer's choice is concrete when
 * this arrives, so the host takes its source-request ticket at once, before
 * anything is awaited (PR #148 F-01, PR #152 F-01).
 */
export interface LightboxChooseProjectSourceMessage extends MessageEnvelope<ConfiguredResourceRef> {
  type: MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE;
}
