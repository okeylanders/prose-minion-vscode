/**
 * The tab's changes to the pinned-context list (ADR 2026-11-04 D5, D6, D8;
 * epic Slice 3). The library owns this; no handler constructs it.
 *
 * - **Asked, then checked at the commit.** Every change captures the
 *   accepted room when it is asked, before anything awaits; its `still` is
 *   the store's `beforeCommit` (Slice 2b's live-room check, D5).
 * - **Against the revision the tab read.** Another revision answers
 *   `changed`, and nothing is written. The store checks it again at its turn.
 * - **The host decides what a file is.** A pin by catalog key is checked
 *   against a fresh catalog; a pin by path (from a room's attachment) is
 *   checked against the path rule and read through the intake doors, which
 *   refuse anything outside the folder or reached through a link. Entries
 *   are named only by keys into the list as read now.
 * - **Bounds before the write** (D6): at most `files` entries, and the
 *   pinned files' words, read now, within the context budget.
 *
 * Logs carry counts and categories, never a path, a name or a file's text.
 */

import * as path from 'node:path';
import type { LogSink } from '@/platform';
import type { ConfiguredResourceRef } from '@messages';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type {
  WorkshopPinnedContextRead,
  WorkshopPinnedContextStore,
  WorkshopPinnedContextUpdateResult
} from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import {
  WORKSHOP_PINNED_CONTEXT_FILES,
  WORKSHOP_PINNED_CONTEXT_FILE_BYTES,
  workshopPinnedContextPathFault,
  workshopPinnedContextPathKey,
  type WorkshopPinnedContextEntry,
  type WorkshopPinnedContextList,
  type WorkshopPinnedContextPathPlatform
} from '@shared/types/workshopPinnedContext';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  workshopPinnedFileLabel,
  workshopPinnedListedUnderRoot,
  type WorkshopPinnedContextFileReader,
  type WorkshopPinnedContextIntakePort
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader';
import type {
  WorkshopPinnedContextAsk,
  WorkshopPinnedContextOpenTarget,
  WorkshopPinnedContextWriteResult
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';
import {
  WORKSHOP_PINNED_WORDS,
  workshopPinnedFileFaultWords,
  workshopPinnedListRefusalWords,
  workshopPinnedBackslashWords,
  workshopPinnedListUnavailableWords,
  workshopPinnedOverBudgetWords
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextWords';

const LOG = '[WorkshopPinnedContext]';

/** The store's half the writes use. */
export type WorkshopPinnedContextWriteStorePort = Pick<WorkshopPinnedContextStore, 'availability' | 'read' | 'update'>;

/** A readable list at the tab's revision, in the folder it lives in. */
interface AtRevision {
  readonly rootPath: string;
  readonly files: readonly WorkshopPinnedContextEntry[];
}

const refused = (words: string, category: string): WorkshopPinnedContextWriteResult => ({ kind: 'refused', words, category });

export class WorkshopPinnedContextWrites {
  constructor(
    private readonly store: WorkshopPinnedContextWriteStorePort,
    private readonly intake: Pick<WorkshopPinnedContextIntakePort, 'openCatalog'>,
    private readonly reader: WorkshopPinnedContextFileReader,
    private readonly platform: WorkshopPinnedContextPathPlatform,
    private readonly outputChannel: LogSink
  ) {}

  async pinResources(ask: WorkshopPinnedContextAsk, revision: string, items: readonly ConfiguredResourceRef[]): Promise<WorkshopPinnedContextWriteResult> {
    const list = await this.atRevision(ask, revision);
    if (!isList(list)) {
      return list;
    }
    let summaries: readonly ContextResourceSummary[];
    try {
      summaries = (await this.intake.openCatalog()).entries();
    } catch {
      return this.refuse(WORKSHOP_PINNED_WORDS.catalogUnreadable, 'catalog-unreadable');
    }
    const entries: WorkshopPinnedContextEntry[] = [];
    for (const item of items) {
      const summary = summaries.find((entry) => entry.group === item.group && entry.path === item.path);
      if (!summary) {
        return this.refuse(WORKSHOP_PINNED_WORDS.notInCatalog, 'not-in-catalog');
      }
      if (!isPathWithinRoot(list.rootPath, summary.absolutePath)) {
        return this.refuse(WORKSHOP_PINNED_WORDS.outsideProject, 'outside');
      }
      // The reader's rule (PR #208 F01): a row is this root's only when the root and its path give it back.
      if (!workshopPinnedListedUnderRoot(list.rootPath, summary) || workshopPinnedContextPathFault(summary.path) !== undefined) {
        return this.refuse(WORKSHOP_PINNED_WORDS.workspaceChanged, 'workspace-changed');
      }
      entries.push({ path: summary.path });
    }
    return this.pin(ask, revision, list, entries);
  }

  async pinPaths(ask: WorkshopPinnedContextAsk, revision: string, entries: readonly WorkshopPinnedContextEntry[]): Promise<WorkshopPinnedContextWriteResult> {
    for (const entry of entries) {
      const fault = workshopPinnedContextPathFault(entry.path);
      if (fault === 'backslash') {
        // A file inside the project whose name holds `\` (POSIX): format 1 can't name it.
        return this.refuse(workshopPinnedBackslashWords(workshopPinnedFileLabel(entry.path)), 'backslash');
      }
      if (fault !== undefined) {
        return this.refuse(WORKSHOP_PINNED_WORDS.outsideProject, 'outside');
      }
    }
    const list = await this.atRevision(ask, revision);
    return isList(list) ? this.pin(ask, revision, list, entries) : list;
  }

  /**
   * A file the host's picker chose: the folder is the one asked in, captured
   * before the pick is awaited, and the file must lie inside it (ADR D8). Its
   * path relative to that folder is the entry; `\` is a separator only on
   * Windows, so on POSIX a name holding one is refused by the path rule.
   */
  async pinPicked(
    ask: WorkshopPinnedContextAsk,
    revision: string,
    pick: (projectFolder: string) => Promise<string | undefined>
  ): Promise<WorkshopPinnedContextWriteResult | { readonly kind: 'cancelled' }> {
    // The root the room was asked in, never the folder as it reads later (PR #208 F01).
    const where = ask.where;
    if (!where) {
      return this.notAsked();
    }
    const picked = await pick(where.rootPath);
    if (picked === undefined) {
      this.log('Pick cancelled');
      return { kind: 'cancelled' };
    }
    if (!ask.still()) {
      return this.refuse(WORKSHOP_PINNED_WORDS.workspaceChanged, 'unavailable');
    }
    if (!isPathWithinRoot(where.rootPath, picked)) {
      return this.refuse(WORKSHOP_PINNED_WORDS.outsideProject, 'outside');
    }
    const relative = path.relative(where.rootPath, picked);
    const entryPath = this.platform === 'windows' ? relative.replace(/\\/g, '/') : relative;
    return this.pinPaths(ask, revision, [{ path: entryPath }]);
  }

  async unpin(ask: WorkshopPinnedContextAsk, revision: string, entryPath: string): Promise<WorkshopPinnedContextWriteResult> {
    const list = await this.atRevision(ask, revision);
    if (!isList(list)) {
      return list;
    }
    const key = this.key(entryPath);
    if (!list.files.some((entry) => this.key(entry.path) === key)) {
      return this.refuse(WORKSHOP_PINNED_WORDS.notListed, 'not-listed');
    }
    return this.write(ask, revision, (current) => ({ files: current.files.filter((entry) => this.key(entry.path) !== key) }), 'unpin');
  }

  async move(ask: WorkshopPinnedContextAsk, revision: string, entryPath: string, direction: 'up' | 'down'): Promise<WorkshopPinnedContextWriteResult> {
    const list = await this.atRevision(ask, revision);
    if (!isList(list)) {
      return list;
    }
    const key = this.key(entryPath);
    const at = list.files.findIndex((entry) => this.key(entry.path) === key);
    if (at < 0) {
      return this.refuse(WORKSHOP_PINNED_WORDS.notListed, 'not-listed');
    }
    const to = direction === 'up' ? at - 1 : at + 1;
    if (to < 0 || to >= list.files.length) {
      return { kind: 'ok', written: false };
    }
    return this.write(ask, revision, (current) => {
      const index = current.files.findIndex((entry) => this.key(entry.path) === key);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= current.files.length) {
        return current;
      }
      const files = [...current.files];
      [files[index], files[target]] = [files[target], files[index]];
      return { files };
    }, 'move');
  }

  /** An entry's file, or the list file: resolved from the list as read now, and contained. */
  async openTarget(entryPath: string | undefined): Promise<WorkshopPinnedContextOpenTarget> {
    const where = this.store.availability();
    if (!where.available) {
      return { kind: 'refused', words: workshopPinnedListUnavailableWords(where.reason), category: where.reason };
    }
    const read = await this.store.read({ filePath: where.filePath });
    if (entryPath === undefined) {
      return read.state === 'absent'
        ? { kind: 'refused', words: WORKSHOP_PINNED_WORDS.noListFile, category: 'absent' }
        : { kind: 'file', fsPath: where.filePath };
    }
    if (read.state !== 'ok') {
      return { kind: 'refused', words: WORKSHOP_PINNED_WORDS.notListed, category: `list-${read.state}` };
    }
    const key = this.key(entryPath);
    const entry = read.list.files.find((file) => this.key(file.path) === key);
    if (!entry) {
      return { kind: 'refused', words: WORKSHOP_PINNED_WORDS.notListed, category: 'not-listed' };
    }
    const fsPath = path.join(where.rootPath, ...entry.path.split('/'));
    return isPathWithinRoot(where.rootPath, fsPath)
      ? { kind: 'file', fsPath }
      : { kind: 'refused', words: WORKSHOP_PINNED_WORDS.outsideProject, category: 'outside' };
  }

  /** Read, check the bounds against every pinned file as it reads now, then write. */
  private async pin(
    ask: WorkshopPinnedContextAsk,
    revision: string,
    list: AtRevision,
    asked: readonly WorkshopPinnedContextEntry[]
  ): Promise<WorkshopPinnedContextWriteResult> {
    const known = new Set(list.files.map((entry) => this.key(entry.path)));
    const added: WorkshopPinnedContextEntry[] = [];
    for (const entry of asked) {
      const key = this.key(entry.path);
      if (!known.has(key)) {
        known.add(key);
        added.push({ path: entry.path });
      }
    }
    if (added.length === 0) {
      return { kind: 'ok', written: false };
    }
    if (list.files.length + added.length > WORKSHOP_PINNED_CONTEXT_FILES) {
      return this.refuse(WORKSHOP_PINNED_WORDS.tooManyFiles, 'too-many');
    }
    let reads;
    try {
      ({ reads } = await this.reader.readAll(list.rootPath, [...list.files, ...added]));
    } catch {
      return this.refuse(WORKSHOP_PINNED_WORDS.readFailed, 'read-failed');
    }
    if (reads.some((read) => read.state === 'unreadable' && read.fault === 'workspace-changed')) {
      return this.refuse(WORKSHOP_PINNED_WORDS.workspaceChanged, 'workspace-changed');
    }
    for (const read of reads.slice(list.files.length)) {
      if (read.state === 'missing') {
        return this.refuse(`Can’t pin ${read.label}: it isn’t there.`, 'missing');
      }
      if (read.state === 'unreadable') {
        return read.fault === 'refused'
          ? this.refuse(WORKSHOP_PINNED_WORDS.outsideProject, 'outside')
          : this.refuse(`Can’t pin ${read.label}: ${workshopPinnedFileFaultWords(read.fault)}`, `unreadable-${read.fault}`);
      }
    }
    const words = reads.reduce((total, read) => total + (read.state === 'ready' ? read.input.words : 0), 0);
    if (words > PROMPT_BUDGETS.contextAttachments.words) {
      const labels = added.map((entry) => workshopPinnedFileLabel(entry.path));
      return this.refuse(workshopPinnedOverBudgetWords(labels, words), 'over-budget');
    }
    return this.write(ask, revision, (current) => {
      const present = new Set(current.files.map((entry) => this.key(entry.path)));
      return { files: [...current.files, ...added.filter((entry) => !present.has(this.key(entry.path)))] };
    }, `pin ${added.length}`);
  }

  /** The list at the tab's revision, or why there is none to change. */
  private async atRevision(ask: WorkshopPinnedContextAsk, revision: string): Promise<AtRevision | WorkshopPinnedContextWriteResult> {
    const where = ask.where;
    if (!where) {
      return this.notAsked();
    }
    const read = await this.store.read({ filePath: where.filePath });
    const refusal = this.readRefusal(read);
    if (refusal) {
      return refusal;
    }
    if (read.state !== 'ok' && read.state !== 'absent') {
      return this.refuse(WORKSHOP_PINNED_WORDS.readFailed, read.state);
    }
    if (read.revision !== revision) {
      this.log(`Not written: the list changed (${read.state})`);
      return { kind: 'changed' };
    }
    return { rootPath: where.rootPath, files: read.state === 'ok' ? read.list.files : [] };
  }

  private readRefusal(read: WorkshopPinnedContextRead): WorkshopPinnedContextWriteResult | undefined {
    switch (read.state) {
      case 'unreadable':
        return this.refuse(workshopPinnedListRefusalWords(read.reason, read.entry, WORKSHOP_PINNED_CONTEXT_FILE_BYTES), 'list-unreadable');
      case 'unavailable':
        return this.refuse(workshopPinnedListUnavailableWords(read.reason), read.reason);
      case 'busy':
        return this.refuse(WORKSHOP_PINNED_WORDS.busy, 'busy');
      case 'io':
        return this.refuse(WORKSHOP_PINNED_WORDS.io, 'io');
      default:
        return undefined;
    }
  }

  private async write(
    ask: WorkshopPinnedContextAsk,
    revision: string,
    change: (list: WorkshopPinnedContextList) => WorkshopPinnedContextList,
    action: string
  ): Promise<WorkshopPinnedContextWriteResult> {
    let result: WorkshopPinnedContextUpdateResult;
    try {
      result = await this.store.update(revision, change, { beforeCommit: ask.still });
    } catch {
      return this.refuse(WORKSHOP_PINNED_WORDS.io, 'failed');
    }
    if (result.ok) {
      this.log(`Written (${action}, files=${result.list.files.length})`);
      return { kind: 'ok', written: true };
    }
    switch (result.reason) {
      case 'changed':
        this.log(`Not written: the list changed (${action})`);
        return { kind: 'changed' };
      case 'invalid':
        return this.refuse(WORKSHOP_PINNED_WORDS.invalid, `invalid-${result.refusal}`);
      case 'unreadable':
        return this.refuse(WORKSHOP_PINNED_WORDS.listUnreadable, 'list-unreadable');
      case 'unavailable':
        return this.refuse(WORKSHOP_PINNED_WORDS.workspaceChanged, 'unavailable');
      case 'busy':
        return this.refuse(WORKSHOP_PINNED_WORDS.busy, 'busy');
      case 'io':
        return this.refuse(WORKSHOP_PINNED_WORDS.io, 'io');
    }
  }

  /** A change asked with no accepted room: no single folder, or the room not settled yet. */
  private notAsked(): WorkshopPinnedContextWriteResult {
    const now = this.store.availability();
    return now.available
      ? this.refuse(WORKSHOP_PINNED_WORDS.notReady, 'not-ready')
      : this.refuse(workshopPinnedListUnavailableWords(now.reason), now.reason);
  }

  private key(entryPath: string): string {
    return workshopPinnedContextPathKey(entryPath, this.platform);
  }

  private refuse(words: string, category: string): WorkshopPinnedContextWriteResult {
    this.log(`Not written (${category})`);
    return refused(words, category);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

function isList(value: AtRevision | WorkshopPinnedContextWriteResult): value is AtRevision {
  return 'rootPath' in value;
}
