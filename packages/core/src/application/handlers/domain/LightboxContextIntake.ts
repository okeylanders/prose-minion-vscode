/**
 * The Lightbox's context intake (ADR 2026-10-19 D9; the project picker,
 * 2026-10-20): how a file reaches the context shelf, by either door.
 *
 * - **The system picker** (`LIGHTBOX_ADD_CONTEXT_FILES`, and the project
 *   picker's "Explore project folders…"): one file, as before.
 * - **The project picker** (`LIGHTBOX_ADD_PROJECT_CONTEXT`): one or more
 *   catalog keys, in the writer's order. Each is resolved as a source is
 *   (`LightboxProjectFiles`: in a fresh catalog, Markdown or plain text,
 *   inside an open workspace folder), never from a path the webview sends.
 *
 * Both doors then meet the same rules, which are the shelf's own: a file
 * that is the board's own source is refused (context informs the chapter;
 * it is not the chapter), as is one that cannot be read; the shelf refuses
 * an empty file, one already on it (the same absolute path, whichever door
 * added it), and one that would take the shelf past
 * `PROMPT_BUDGETS.contextFiles.words`. Files are added one at a time, so each
 * is held to the total the earlier ones left. Every refusal is reported with
 * its reason; none is dropped silently.
 *
 * Context is never evidence: the shelf's text reaches a call only as the
 * labeled section after the chapter, and the quote verifier searches the
 * chapter alone, whichever door a file came in by.
 *
 * Nothing here posts. The reading handler posts the shelf after every add,
 * and the webview asks for a fresh estimate when the list changes; the
 * shelf's revision moves, so a press priced before the add is refused.
 * Logs name paths and counts, never text.
 */

import type { LogSink, ShellService } from '@/platform';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { LIGHTBOX_TEXT_FILE_EXTENSIONS } from '@shared/constants/lightbox';
import {
  LightboxProjectFiles,
  lightboxProjectFileRef
} from '@handlers/domain/LightboxProjectFiles';

const LOG = '[LightboxReadingHandler]';
const OWN_SOURCE = 'That file is the board\'s own source. Context informs the chapter; it is not the chapter.';
const UNREADABLE = 'Could not read that file. Choose a text or Markdown file inside an open workspace folder.';

/** What an add asks the reading handler to show: a notice when something was refused. */
export interface LightboxContextIntakeOutcome {
  notice?: string;
}

export interface LightboxContextIntakeDeps {
  lightboxService: Pick<LightboxService, 'currentRereadTarget'>;
  shelf: LightboxContextShelf;
  textSourceResolver: TextSourceResolver;
  shell: Pick<ShellService, 'pickFile'>;
  projectFiles: LightboxProjectFiles;
  outputChannel: LogSink;
}

/** A file to add, already known to be one the host may read. */
interface LightboxContextCandidate {
  absolutePath: string;
  /** The name to use when the file cannot be read. */
  displayPath: string;
}

export class LightboxContextIntake {
  constructor(private readonly deps: LightboxContextIntakeDeps) {}

  /** The system picker: one file. Undefined when the writer dismissed it, which changes nothing. */
  async addPicked(): Promise<LightboxContextIntakeOutcome | undefined> {
    const picked = await this.deps.shell.pickFile({
      title: 'Add a context file to the Lightbox',
      openLabel: 'Add',
      // eslint-disable-next-line @typescript-eslint/naming-convention -- dialog filter keys are display names.
      filters: { 'Text files': [...LIGHTBOX_TEXT_FILE_EXTENSIONS], 'All files': ['*'] }
    });
    if (!picked) {
      return undefined;
    }
    const notice = await this.add({ absolutePath: picked.fsPath, displayPath: picked.fsPath });
    return notice ? { notice } : {};
  }

  /**
   * The project picker: the files `items` names, in order. A request naming
   * no catalog file at all is refused as such; items that name none are
   * counted in the notice.
   */
  async addFromProject(items: unknown): Promise<LightboxContextIntakeOutcome> {
    const named = Array.isArray(items) ? items : [];
    const refs = named.flatMap((item) => {
      const ref = lightboxProjectFileRef(item);
      return ref ? [ref] : [];
    });
    if (refs.length === 0) {
      this.deps.outputChannel.appendLine(`${LOG} Ignored a project context request that named no catalog file`);
      return { notice: 'Choose at least one file from the project list.' };
    }
    const notices: string[] = [];
    if (refs.length < named.length) {
      notices.push(`${named.length - refs.length} of the chosen files could not be found in the project list.`);
    }
    let added = 0;
    for (const ref of refs) {
      const resolved = await this.deps.projectFiles.resolve(ref);
      if (resolved.kind === 'refused') {
        const { displayPath, message } = resolved.refusal;
        this.deps.outputChannel.appendLine(`${LOG} Context refused for ${displayPath ?? ref.path} (${resolved.refusal.why})`);
        notices.push(`${displayPath ?? ref.path}: ${message}`);
        continue;
      }
      const notice = await this.add(resolved.file);
      if (notice) {
        // The shelf's own notices name the file; the read and own-source ones do not.
        const { displayPath } = resolved.file;
        notices.push(notice.includes(displayPath) ? notice : `${displayPath}: ${notice}`);
      } else {
        added += 1;
      }
    }
    if (notices.length === 0) {
      return {};
    }
    const summary = added > 0 ? `Added ${added} of ${named.length}. ` : '';
    return { notice: summary + notices.join(' ') };
  }

  /** Read and shelve one file; the notice to show when it was refused. */
  private async add(candidate: LightboxContextCandidate): Promise<string | undefined> {
    if (this.deps.lightboxService.currentRereadTarget()?.rereadPath === candidate.absolutePath) {
      return OWN_SOURCE;
    }
    let resolved: { text: string; displayPath: string };
    try {
      const source = await this.deps.textSourceResolver.resolve({ mode: 'activeFile', pathText: candidate.absolutePath });
      resolved = { text: source.text, displayPath: source.displayPath ?? source.relativePaths[0] ?? candidate.displayPath };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.deps.outputChannel.appendLine(`${LOG} Could not read a context file: ${detail}`);
      return UNREADABLE;
    }
    const result = this.deps.shelf.add({ ...resolved, sourceKey: candidate.absolutePath });
    this.deps.outputChannel.appendLine(
      result.added
        ? `${LOG} Context added: ${result.file.displayPath} (${result.file.wordCount} words)`
        : `${LOG} Context refused for ${resolved.displayPath}`
    );
    return result.added ? undefined : result.notice;
  }
}
