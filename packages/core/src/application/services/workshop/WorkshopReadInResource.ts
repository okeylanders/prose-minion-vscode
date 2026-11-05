/**
 * The Read in reader's host side (ADR 2026-11-03 D4, access).
 *
 * A manifest row names a file a persona read by `{ group, path }`. The webview
 * sends that pair back; this module decides whether it names a configured
 * project resource, exactly as `resource.read` would, and reads its current
 * text under `resource.read`'s ceilings. Anything else is refused by reason,
 * and a refusal never carries file content.
 */

import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup } from '@shared/types/context';
import {
  configuredResourceFingerprint,
  findConfiguredResource,
  isSafeConfiguredResourcePath,
  sliceUtf8
} from './WorkshopConfiguredResourceLookup';

/** The configured catalog as the reader needs it; `WorkshopContextIntakeCatalog` is one. */
export interface WorkshopReadInCatalog {
  entries(): ContextResourceSummary[];
  readText(summary: ContextResourceSummary): Promise<string | undefined>;
}

export type WorkshopReadInRefusalReason =
  | 'unknown-group'
  | 'unsafe-path'
  | 'not-configured'
  | 'ambiguous'
  | 'too-large'
  | 'unreadable';

const MIB = 1024 * 1024;

const unhandledRefusal = (reason: never): never => {
  throw new Error(`Unhandled Read in refusal: ${String(reason)}`);
};

/** Host words for each refusal. None names the file or its content. */
export function workshopReadInRefusalMessage(reason: WorkshopReadInRefusalReason): string {
  switch (reason) {
    case 'unknown-group':
      return 'That group is not one of the configured project-resource groups.';
    case 'unsafe-path':
      return 'Only a workspace-relative configured path can be read here.';
    case 'not-configured':
      return 'That file is not one of the configured project resources in its group.';
    case 'ambiguous':
      return 'That path matches more than one configured resource when letter case is ignored.';
    case 'too-large':
      return `That file is larger than the ${PROMPT_BUDGETS.workshopResource.readSourceBytes / MIB} MiB read ceiling.`;
    case 'unreadable':
      return 'That file could not be read.';
    default:
      return unhandledRefusal(reason);
  }
}


export type WorkshopReadInResolution =
  | { kind: 'resolved'; resource: ContextResourceSummary }
  | { kind: 'refused'; reason: WorkshopReadInRefusalReason };

export type WorkshopReadInRead =
  | {
      kind: 'content';
      resource: ContextResourceSummary;
      content: string;
      /** True when the text stopped at `resource.read`'s byte ceiling. */
      truncated: boolean;
      bytes: number;
      totalBytes: number;
      /**
       * The whole file's fingerprint now, by `resource.read`'s rule. Host-side
       * only: compared with a row's stored one, never sent.
       */
      fingerprint: string;
    }
  | { kind: 'refused'; reason: WorkshopReadInRefusalReason };

/** Resolves a webview's `{ group, path }` against the configured catalog, or refuses it. */
export function resolveWorkshopReadInResource(
  entries: readonly ContextResourceSummary[],
  group: unknown,
  resourcePath: unknown
): WorkshopReadInResolution {
  if (typeof group !== 'string' || !isContextPathGroup(group)) {
    return { kind: 'refused', reason: 'unknown-group' };
  }
  if (
    typeof resourcePath !== 'string'
    || resourcePath.length > PROMPT_BUDGETS.workshopResource.pathCharacters
    || !isSafeConfiguredResourcePath(resourcePath)
  ) {
    return { kind: 'refused', reason: 'unsafe-path' };
  }
  const lookup = findConfiguredResource(entries, group, resourcePath);
  switch (lookup.kind) {
    case 'found':
      return { kind: 'resolved', resource: lookup.resource };
    case 'ambiguous':
      return { kind: 'refused', reason: 'ambiguous' };
    case 'missing':
      return { kind: 'refused', reason: 'not-configured' };
  }
}

/**
 * Reads a resolved resource's current text. A file over `readSourceBytes` is
 * refused, as `resource.read` refuses it; what is shown stops at `readBytes`,
 * and the cut is reported, never hidden.
 */
export async function readWorkshopReadInResource(
  catalog: WorkshopReadInCatalog,
  group: unknown,
  resourcePath: unknown
): Promise<WorkshopReadInRead> {
  const resolution = resolveWorkshopReadInResource(catalog.entries(), group, resourcePath);
  if (resolution.kind === 'refused') {
    return resolution;
  }
  const { resource } = resolution;
  const budgets = PROMPT_BUDGETS.workshopResource;
  if (resource.sizeBytes > budgets.readSourceBytes) {
    return { kind: 'refused', reason: 'too-large' };
  }
  let text: string | undefined;
  try {
    text = await catalog.readText(resource);
  } catch {
    return { kind: 'refused', reason: 'unreadable' };
  }
  if (text === undefined) {
    return { kind: 'refused', reason: 'unreadable' };
  }
  if (Buffer.byteLength(text, 'utf8') > budgets.readSourceBytes) {
    return { kind: 'refused', reason: 'too-large' };
  }
  const sliced = sliceUtf8(text, budgets.readBytes);
  return {
    kind: 'content',
    resource,
    content: sliced.content,
    truncated: sliced.truncated,
    bytes: sliced.bytes,
    totalBytes: sliced.totalBytes,
    fingerprint: configuredResourceFingerprint(text)
  };
}
