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
 *
 * Every catalog and search request carries a `requestId` the webview mints
 * for that opening and that operation, and the host echoes it on the answer
 * (PR #154 F-01). The webview takes an answer only when its id is the one it
 * is still waiting for, so an answer to a closed opening, an older query or
 * a cleared search is dropped without touching the one on screen.
 */

import { MessageEnvelope, MessageType } from './base';
import type {
  ConfiguredResourceCatalogPayload,
  ConfiguredResourceRef,
  ConfiguredResourceSearchPayload,
  ConfiguredResourceSearchResults
} from './configuredResources';

/**
 * Pairs a catalog or search request with its answer (PR #154 F-01). The
 * webview mints a fresh id per opening and per operation; the host echoes it
 * unchanged, and ignores a request that carries none.
 */
export interface LightboxProjectRequestCorrelation {
  requestId: string;
}

/** The picker opened: send the project's readable files. */
export type LightboxRequestProjectCatalogPayload = LightboxProjectRequestCorrelation;

export interface LightboxRequestProjectCatalogMessage extends MessageEnvelope<LightboxRequestProjectCatalogPayload> {
  type: MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG;
}

export interface LightboxProjectCatalogPayload
  extends ConfiguredResourceCatalogPayload, LightboxProjectRequestCorrelation {
  /** The configured folders could not be read; `entries` is empty. */
  unreadable?: boolean;
}

export interface LightboxProjectCatalogMessage extends MessageEnvelope<LightboxProjectCatalogPayload> {
  type: MessageType.LIGHTBOX_PROJECT_CATALOG;
}

/** "Names + content": search the readable files' text. */
export type LightboxSearchProjectCatalogPayload = ConfiguredResourceSearchPayload & LightboxProjectRequestCorrelation;

export interface LightboxSearchProjectCatalogMessage extends MessageEnvelope<LightboxSearchProjectCatalogPayload> {
  type: MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG;
}

export type LightboxProjectCatalogSearchResultsPayload = ConfiguredResourceSearchResults & LightboxProjectRequestCorrelation;

export interface LightboxProjectCatalogSearchResultsMessage
  extends MessageEnvelope<LightboxProjectCatalogSearchResultsPayload> {
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

/**
 * Add project files to the context shelf, in the writer's selection order.
 * Each is resolved as a source is, then held to the shelf's own rules (not
 * the board's source, not empty, not already there, within the word
 * ceiling). The answer is `LIGHTBOX_CONTEXT_FILES`, whose notice names every
 * file refused and why; the webview re-estimates when the list changes.
 */
export interface LightboxAddProjectContextPayload {
  items: ConfiguredResourceRef[];
}

export interface LightboxAddProjectContextMessage extends MessageEnvelope<LightboxAddProjectContextPayload> {
  type: MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT;
}
