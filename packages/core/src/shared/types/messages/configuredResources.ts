/**
 * Configured project resources: the files the writer's context paths name,
 * grouped by category (Characters, Chapters & Scenes, Manuscript, …), as a
 * webview browses and searches them (Workshop Sprint 12; shared with the
 * Lightbox's source picker, 2026-10-20).
 *
 * Every path here is the context-path resolver's display-safe,
 * workspace-relative path, and `{ group, path }` is the catalog key. A webview
 * names a resource by that key only; the host looks it up in a fresh catalog
 * and never trusts a path or URI from the webview. No absolute path crosses
 * these contracts.
 *
 * Each tab keeps its own routes (`WORKSHOP_*` for the Workshop's context
 * selector, `LIGHTBOX_*` for the Lightbox's source); these are the payload
 * shapes they share, and what the shared picker component renders.
 */

import { ContextPathGroup } from '../context';

/** A configured resource by its catalog key. */
export interface ConfiguredResourceRef {
  group: ContextPathGroup;
  /** Resolver's display-safe workspace-relative path — the canonical key. */
  path: string;
}

/** One configured resource as a picker browses it. */
export interface ConfiguredResourceEntry extends ConfiguredResourceRef {
  label: string;
  /** Byte size from catalog admission; word counts happen when the file is read. */
  sizeBytes: number;
}

/** The catalog a picker browses. */
export interface ConfiguredResourceCatalogPayload {
  entries: ConfiguredResourceEntry[];
}

/**
 * Content search over the catalog (name matching is client-side: the webview
 * already holds the catalog). Bounded by the same limits as the Workshop
 * persona capability's resource.search.
 */
export interface ConfiguredResourceSearchPayload {
  query: string;
}

export interface ConfiguredResourceSearchResults {
  query: string;
  matches: ConfiguredResourceRef[];
  /** True when a file/byte bound stopped the scan early. */
  bounded: boolean;
}
