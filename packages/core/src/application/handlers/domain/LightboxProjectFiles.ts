/**
 * The Lightbox's project files (2026-10-20; ADR 2026-10-19 D1, D10): what
 * the shared project picker browses and searches in the Lightbox, and how a
 * catalog key the webview names becomes a file the host reads.
 *
 * It reads the same configured-resource catalog the Workshop's context
 * selector reads (`WorkshopContextIntakeService.openCatalog`, built once at
 * the composition root) and searches it with the same content search
 * (`ConfiguredResourceContentSearch`); there is no second catalog.
 *
 * - **Only text.** The catalog the webview sees holds only Markdown and
 *   plain-text files (`isLightboxTextFile`): anything else is left out, not
 *   shown disabled, because the Lightbox cannot read it at all. The context
 *   paths admit only `.md` and `.txt` today, so this is a guard against a
 *   wider catalog later rather than a filter writers will see.
 * - **Ids only.** The webview names a file by its catalog key, `{ group, path }`.
 *   `resolve` looks the key up in a fresh catalog, so a path the catalog
 *   does not list is refused, and checks the file is text and inside an open
 *   workspace folder (`isPathWithinRoot`) before handing back where to read
 *   it. The reader (TextSourceResolver) checks containment again.
 * - **Answers name their request.** A catalog or search request carries the
 *   `requestId` the webview minted for it, and its answer echoes that id
 *   (PR #154 F-01), so the webview can drop an answer it no longer waits
 *   for. A request with no id is ignored: nothing could claim its answer.
 * - **Identity without paths.** Each row carries `lightboxFileKey` of its
 *   absolute path, the key the context shelf gives the same file, so the
 *   webview can mark the row attached without either path being posted
 *   (PR #154 F-02).
 *
 * Nothing here posts, takes a source-request ticket or touches the board:
 * the handlers that own those do. Logs name paths and counts, never text.
 */

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LogSink, Workspace } from '@/platform';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { searchConfiguredResourceContent } from '@/application/services/ConfiguredResourceContentSearch';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { isContextPathGroup } from '@shared/types/context';
import { isLightboxTextFile } from '@shared/constants/lightbox';
import { lightboxFileKey } from '@/infrastructure/lightbox/LightboxFileKey';
import type {
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults,
  LightboxProjectCatalogEntry,
  LightboxProjectCatalogPayload,
  LightboxProjectCatalogSearchResultsPayload
} from '@messages';

/** What the Lightbox reads its project files through, from the composition root. */
export interface LightboxProjectFilePorts {
  /** The configured-resource catalog (the Workshop's context selector reads it too). */
  catalog: Pick<WorkshopContextIntakeService, 'openCatalog'>;
  /** The open workspace folders a project file must sit inside. */
  workspace: Pick<Workspace, 'workspaceFolders'>;
}

/** A project file the host may read: where, its URI, and the name the writer sees. */
export interface LightboxProjectFile {
  absolutePath: string;
  sourceUri: string;
  displayPath: string;
}

/** Why a named project file will not be read. */
export interface LightboxProjectFileRefusal {
  why: 'not-listed' | 'not-text' | 'outside-workspace' | 'catalog-unreadable';
  message: string;
  displayPath?: string;
  suggestion?: string;
}

export type LightboxProjectFileResolution =
  | { kind: 'file'; file: LightboxProjectFile }
  | { kind: 'refused'; refusal: LightboxProjectFileRefusal };

const LOG = '[LightboxProjectFiles]';
/** The longest request id echoed back; the webview's are far shorter. */
const MAX_REQUEST_ID_LENGTH = 200;

/** The catalog as listed, before it is paired with the request it answers. */
type LightboxProjectCatalogListing = Omit<LightboxProjectCatalogPayload, 'requestId'>;

/** The catalog key a webview payload names, or undefined when it names none. */
export function lightboxProjectFileRef(payload: unknown): ConfiguredResourceRef | undefined {
  const candidate = payload as { group?: unknown; path?: unknown } | undefined;
  if (
    typeof candidate?.group !== 'string' ||
    !isContextPathGroup(candidate.group) ||
    typeof candidate.path !== 'string' ||
    candidate.path.trim().length === 0
  ) {
    return undefined;
  }
  return { group: candidate.group, path: candidate.path };
}

export class LightboxProjectFiles {
  constructor(
    private readonly ports: LightboxProjectFilePorts,
    private readonly outputChannel: LogSink
  ) {}

  /** The answer to a catalog request, under its id; undefined for a request with none. */
  async catalogReply(request: unknown): Promise<LightboxProjectCatalogPayload | undefined> {
    const requestId = this.requestIdOf(request, 'catalog');
    return requestId ? { ...(await this.catalog()), requestId } : undefined;
  }

  /** The answer to a content search, under its id; undefined for a request with no id or query, or a failure. */
  async searchReply(request: unknown): Promise<LightboxProjectCatalogSearchResultsPayload | undefined> {
    const requestId = this.requestIdOf(request, 'search');
    const results = requestId ? await this.search((request as { query?: unknown }).query) : undefined;
    return results && requestId ? { ...results, requestId } : undefined;
  }

  /** The readable files, as the picker browses them; empty and `unreadable` when the folders could not be read. */
  private async catalog(): Promise<LightboxProjectCatalogListing> {
    let entries: LightboxProjectCatalogEntry[];
    let left = 0;
    try {
      const all = (await this.ports.catalog.openCatalog()).entries();
      const text = all.filter((entry) => isLightboxTextFile(entry.path));
      left = all.length - text.length;
      entries = text.map(({ group, path: entryPath, label, sizeBytes, absolutePath }) => ({
        group,
        path: entryPath,
        label,
        sizeBytes,
        fileKey: lightboxFileKey(absolutePath)
      }));
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Could not read the configured resource catalog: ${detailOf(error)}`);
      return { entries: [], unreadable: true };
    }
    this.outputChannel.appendLine(
      `${LOG} Catalog: ${entries.length} text file(s)` + (left > 0 ? `; ${left} other file(s) left out` : '')
    );
    return { entries };
  }

  /** "Names + content": the readable files whose text holds `query`; undefined for an empty query or a failure. */
  private async search(query: unknown): Promise<ConfiguredResourceSearchResults | undefined> {
    if (typeof query !== 'string' || query.trim().length === 0) {
      return undefined;
    }
    try {
      const catalog = await this.ports.catalog.openCatalog();
      const text = catalog.entries().filter((entry) => isLightboxTextFile(entry.path));
      return await searchConfiguredResourceContent(catalog, text, query);
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Content search failed: ${detailOf(error)}`);
      return undefined;
    }
  }

  /** Where to read the file `ref` names, or why it will not be read. */
  async resolve(ref: ConfiguredResourceRef): Promise<LightboxProjectFileResolution> {
    let summary;
    try {
      summary = (await this.ports.catalog.openCatalog()).find(ref);
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Could not read the configured resource catalog: ${detailOf(error)}`);
      return refused({
        why: 'catalog-unreadable',
        message: 'Could not read your configured project folders.',
        displayPath: ref.path,
        suggestion: 'Use Explore project folders… to choose the file instead.'
      });
    }
    if (!summary) {
      return refused({
        why: 'not-listed',
        message: 'That file is no longer in your configured project folders.',
        displayPath: ref.path,
        suggestion: 'Open the project list again, or use Explore project folders….'
      });
    }
    if (!isLightboxTextFile(summary.path)) {
      return refused({
        why: 'not-text',
        message: `The Lightbox reads Markdown and plain-text files, and “${path.basename(summary.path)}” is neither.`,
        displayPath: summary.path
      });
    }
    const inside = this.ports.workspace.workspaceFolders()
      .some((folder) => isPathWithinRoot(folder.path, summary.absolutePath));
    if (!inside) {
      this.outputChannel.appendLine(`${LOG} Refused ${summary.path}: not inside an open workspace folder`);
      return refused({
        why: 'outside-workspace',
        message: 'The Lightbox reads files inside an open workspace folder.',
        displayPath: summary.path,
        suggestion: 'Open the folder that holds it, or choose another file.'
      });
    }
    return {
      kind: 'file',
      file: {
        absolutePath: summary.absolutePath,
        sourceUri: pathToFileURL(summary.absolutePath).href,
        displayPath: summary.path
      }
    };
  }

  /** The id a request carries for its answer to echo, or undefined (logged) when it carries none. */
  private requestIdOf(request: unknown, what: 'catalog' | 'search'): string | undefined {
    const requestId = (request as { requestId?: unknown } | undefined)?.requestId;
    if (typeof requestId === 'string' && requestId.length > 0 && requestId.length <= MAX_REQUEST_ID_LENGTH) {
      return requestId;
    }
    this.outputChannel.appendLine(`${LOG} Ignored a ${what} request with no request id`);
    return undefined;
  }
}

function refused(refusal: LightboxProjectFileRefusal): LightboxProjectFileResolution {
  return { kind: 'refused', refusal };
}

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
