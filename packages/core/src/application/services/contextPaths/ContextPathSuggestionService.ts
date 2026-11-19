/**
 * ContextPathSuggestionService — "Suggest from my folders" (ADR 2026-11-19
 * D18, D21, D24): the names-only scan, one helper call, the one checker,
 * and the proposal held for the writer's Apply.
 *
 * - **Built once,** in `extension.ts`, and placed in `CoreServices`. No
 *   handler constructs it. A persona's proposal (C2) reuses the same
 *   checker and `applyContextPathProposal`.
 * - **One proposal held,** under a host-minted id, until the next
 *   suggestion or a reload. Apply names that id and ticked groups only.
 * - **A newer suggestion stops the one in flight.** The stopped one answers
 *   `cancelled`.
 * - **The helper proposes; only Apply writes** (ADR 2026-11-05 D2).
 * - **Logs carry counts and outcomes,** never a folder, file name, path or
 *   pattern.
 */

import type { LogSink } from '@/platform';
import { CONTEXT_PATH_GROUPS, type ContextPathGroup, type ContextPathGroupApplyOutcome } from '@shared/types';
import type {
  ContextPathProposalView,
  ContextPathsSuggestionOutcome
} from '@messages';
import type { HelperRunResult } from '@services/helper/HelperAgentService';
import type { ProjectLocationsInput, ProjectLocationsProposal } from '@services/helper/tasks/ProjectLocationsTask';
import { projectLocationsFoldersSent } from '@services/helper/tasks/ProjectLocationsTask';
import { applyContextPathProposal } from './ContextPathApply';
import type { ContextPathCheckedProposal, ContextPathProposalChecker } from './ContextPathProposalChecker';
import type { ContextPathSettingsWriter } from './ContextPathSettingsWriter';
import type { ProjectFolderScan } from './ProjectFolderScan';

/** The helper's one task this service runs. */
export interface ProjectLocationsHelper {
  run(
    task: 'project-locations',
    input: ProjectLocationsInput,
    options?: { signal?: AbortSignal }
  ): Promise<HelperRunResult<ProjectLocationsProposal>>;
}

export interface ContextPathSuggestionAnswer {
  readonly outcome: ContextPathsSuggestionOutcome;
  readonly proposalId?: string;
  readonly view?: ContextPathProposalView;
}

export interface ContextPathApplyAnswer {
  readonly outcome: 'done' | 'unknown-proposal';
  readonly groups: ContextPathGroupApplyOutcome[];
}

/** The service's surface the Settings route reads. */
export type ContextPathSuggestions = Pick<ContextPathSuggestionService, 'suggest' | 'apply' | 'everyGroupEmpty'>;

const LOG = '[ContextPaths]';

export class ContextPathSuggestionService {
  private held: { readonly id: string; readonly proposal: ContextPathCheckedProposal } | undefined;
  private inFlight: AbortController | undefined;
  private minted = 0;
  private readonly idPrefix = `cps-${Math.random().toString(36).slice(2, 10)}`;

  constructor(
    private readonly scan: Pick<ProjectFolderScan, 'scan'>,
    private readonly helper: ProjectLocationsHelper,
    private readonly checker: Pick<ContextPathProposalChecker, 'check' | 'recheck' | 'currentMatches'>,
    private readonly settings: Pick<ContextPathSettingsWriter, 'read' | 'write'>,
    private readonly log: Pick<LogSink, 'appendLine'>
  ) {}

  async suggest(): Promise<ContextPathSuggestionAnswer> {
    // The next suggestion replaces the proposal held, whatever it answers.
    this.held = undefined;
    this.inFlight?.abort();
    const stop = new AbortController();
    this.inFlight = stop;
    try {
      return await this.suggestUnder(stop.signal);
    } finally {
      if (this.inFlight === stop) {
        this.inFlight = undefined;
      }
    }
  }

  private async suggestUnder(signal: AbortSignal): Promise<ContextPathSuggestionAnswer> {
    const end = (outcome: ContextPathsSuggestionOutcome, detail = ''): ContextPathSuggestionAnswer => {
      this.log.appendLine(`${LOG} Suggestion: ${outcome}${detail}`);
      return { outcome };
    };
    let scanned;
    try {
      scanned = await this.scan.scan();
    } catch {
      return end('failed', ', the scan failed');
    }
    if (signal.aborted) {
      return end('cancelled');
    }
    if (!scanned) {
      return end('no-workspace');
    }
    if (scanned.folders.length === 0) {
      // An empty scan with unreadable folders is not an empty project (PR #288 P2).
      return scanned.unreadable > 0
        ? end('scan-incomplete', `, ${scanned.unreadable} folder(s) unreadable`)
        : end('no-folders');
    }
    const input: ProjectLocationsInput = {
      folders: scanned.folders,
      scanStopped: scanned.stopped.length > 0,
      foldersUnreadable: scanned.unreadable
    };
    const answer = await this.helper.run('project-locations', input, { signal });
    if (signal.aborted) {
      return end('cancelled');
    }
    if (answer.kind === 'unconfigured') {
      return end('unconfigured');
    }
    if (answer.kind !== 'drafted') {
      return end(answer.kind === 'failed' && answer.reason === 'cancelled' ? 'cancelled' : 'failed');
    }
    const proposed = answer.value.groups;
    if (Object.keys(proposed).length === 0) {
      return end('nothing-proposed');
    }
    let checked;
    try {
      checked = await this.checker.check(proposed);
    } catch {
      return end('failed', ', the check failed');
    }
    if (signal.aborted) {
      return end('cancelled');
    }
    if (checked.kind === 'no-workspace') {
      return end('no-workspace');
    }
    this.minted += 1;
    const id = `${this.idPrefix}:${this.minted}`;
    const sent = projectLocationsFoldersSent(input);
    const view: ContextPathProposalView = {
      ...checked.proposal.view,
      scan: {
        folders: scanned.folders.length,
        sent,
        stopped: input.scanStopped || sent < scanned.folders.length,
        unreadable: scanned.unreadable
      }
    };
    this.held = { id, proposal: { ...checked.proposal, view } };
    this.log.appendLine(`${LOG} Suggestion: proposed${describeView(view, sent)}${scanned.unreadable > 0 ? `; ${scanned.unreadable} folder(s) unreadable` : ''}`);
    return { outcome: 'proposed', proposalId: id, view };
  }

  async apply(proposalId: string, groups: readonly ContextPathGroup[]): Promise<ContextPathApplyAnswer> {
    const held = this.held;
    if (!held || held.id !== proposalId) {
      this.log.appendLine(`${LOG} Apply: the proposal is no longer held`);
      return { outcome: 'unknown-proposal', groups: [] };
    }
    const ticked = CONTEXT_PATH_GROUPS.filter((group) => groups.includes(group));
    const outcomes = await applyContextPathProposal(held.proposal, ticked, {
      checker: this.checker,
      settings: this.settings,
      log: this.log
    });
    return { outcome: 'done', groups: outcomes };
  }

  /** True only when a folder is open, every search completed, and no group matches a file. */
  async everyGroupEmpty(): Promise<boolean> {
    try {
      const matches = await this.checker.currentMatches();
      if (!matches) {
        return false;
      }
      return CONTEXT_PATH_GROUPS.every((group) => {
        const files = matches[group];
        return files !== undefined && !files.incomplete && files.files.size === 0;
      });
    } catch {
      return false;
    }
  }
}

/** Counts only: groups proposed and offered, patterns kept, unmatched and refused, files matched. */
function describeView(view: ContextPathProposalView, sent: number): string {
  let proposed = 0;
  let offered = 0;
  let kept = 0;
  let unmatched = 0;
  let incomplete = 0;
  let refused = 0;
  let matches = 0;
  for (const group of view.groups) {
    if (!group.proposed) {
      continue;
    }
    proposed += 1;
    offered += group.offer.offered ? 1 : 0;
    kept += group.proposed.kept.length;
    matches += group.proposed.count;
    for (const dropped of group.proposed.dropped) {
      if (dropped.reason === 'unmatched') {
        unmatched += 1;
      } else if (dropped.reason === 'incomplete') {
        incomplete += 1;
      } else {
        refused += 1;
      }
    }
  }
  return `, ${sent} folder(s) sent, ${proposed} group(s) proposed, ${offered} offered;`
    + ` ${kept} pattern(s) kept, ${unmatched} unmatched, ${incomplete} incomplete, ${refused} refused; ${matches} match(es)`;
}
