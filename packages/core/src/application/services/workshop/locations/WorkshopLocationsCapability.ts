/**
 * The project's context paths for one persona turn (ADR 2026-11-19 D26):
 * turns one validated `locations.*` request into a capability result.
 * Read-only, and private to the persona that asked.
 *
 * - **One scan, one checker, one reader,** C1's: the names-only
 *   `ProjectFolderScan`, the `ContextPathProposalChecker` over the real
 *   resolver, and the settings' read. This adapter writes nothing: only the
 *   writer's Apply on a proposal card does (D24, D27).
 * - **`locations.current`** is the checker's view of an empty proposal:
 *   each group's patterns, count, examples and level, by the same rules.
 * - **`locations.folders`** pages one scan per turn: a continuation does
 *   not scan again.
 * - **`locations.check`** is the checker's answer for the patterns given.
 * - **Nothing joins the manifest,** and no operation is publishable.
 * - Logs carry the operation, counts and outcomes: never a folder or file
 *   name, a path or a pattern (D28). A result carries no usage.
 */

import type { LogSink } from '@/platform';
import type { WorkshopPersonaId } from '@messages';
import type { ContextPathGroup, ContextPathProposalView } from '@shared/types';
import type { WorkshopCapabilityResult, WorkshopLocationsRequest } from '@shared/types/workshopCapabilities';
import type { ContextPathProposal, ContextPathProposalChecker } from '@/application/services/contextPaths/ContextPathProposalChecker';
import type { ProjectFolderScan, ProjectFolderScanResult } from '@/application/services/contextPaths/ProjectFolderScan';
import {
  WORKSHOP_LOCATIONS_NO_WORKSPACE,
  workshopLocationsBody,
  workshopLocationsRequestSummary
} from '@/application/services/workshop/locations/WorkshopLocationsCopy';
import {
  renderWorkshopLocationsCheck,
  renderWorkshopLocationsCurrent,
  renderWorkshopLocationsFolders
} from '@/application/services/workshop/locations/WorkshopLocationsRenderer';

/**
 * What a persona's `locations.*` calls and a proposal's settlement read
 * (ADR 2026-11-19 D18): the scan and the checker built once in
 * `extension.ts`. Neither can write a setting.
 */
export interface WorkshopLocationsPorts {
  readonly scan: Pick<ProjectFolderScan, 'scan'>;
  readonly checker: Pick<ContextPathProposalChecker, 'check'>;
}

export interface WorkshopLocationsTurnContext {
  readonly requestId: string;
  readonly personaId: WorkshopPersonaId;
  readonly signal: AbortSignal;
}

type Request<C extends WorkshopLocationsRequest['capability']> = Extract<WorkshopLocationsRequest, { capability: C }>;

export class WorkshopLocationsCapability {
  private scanned: Promise<ProjectFolderScanResult | undefined> | undefined;

  constructor(
    private readonly ports: WorkshopLocationsPorts,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopLocationsTurnContext
  ) {}

  async fulfill(request: WorkshopLocationsRequest): Promise<WorkshopCapabilityResult> {
    this.throwIfAborted();
    switch (request.capability) {
      case 'locations.current':
        return this.current(request);
      case 'locations.folders':
        return this.folders(request);
      case 'locations.check':
        return this.check(request);
      default:
        return assertNever(request);
    }
  }

  private async current(request: Request<'locations.current'>): Promise<WorkshopCapabilityResult> {
    const view = await this.checked({}, request);
    if (!('groups' in view)) {
      return view;
    }
    const content = renderWorkshopLocationsCurrent(view);
    const counted = view.groups.filter((group) => group.current.count !== null);
    this.log(`current groups=${view.groups.length} uncounted=${view.groups.length - counted.length} ` +
      `files=${counted.reduce((sum, group) => sum + group.current.count!, 0)}`);
    return this.success(request, content, {
      outcome: 'current',
      groups: view.groups.length,
      groupsUncounted: view.groups.length - counted.length
    }, counted.length < view.groups.length ? 'partial' : 'success');
  }

  private async folders(request: Request<'locations.folders'>): Promise<WorkshopCapabilityResult> {
    let scan: ProjectFolderScanResult | undefined;
    try {
      this.scanned ??= this.ports.scan.scan();
      scan = await this.scanned;
    } catch {
      this.scanned = undefined;
      return this.failed(request, 'scan-failed', 'The folder names could not be read just now. Answer from what you have.');
    }
    this.throwIfAborted();
    if (!scan) {
      return this.noWorkspace(request);
    }
    const rendered = renderWorkshopLocationsFolders(scan, request.page);
    this.log(`folders page=${rendered.page} pages=${rendered.pages} shown=${rendered.shown} notShown=${rendered.notShown} ` +
      `scanned=${scan.folders.length} unreadable=${scan.unreadable} stopped=${scan.stopped.length > 0}`);
    return this.success(request, rendered.content, {
      outcome: 'folders',
      page: rendered.page,
      pages: rendered.pages,
      foldersShown: rendered.shown,
      notShown: rendered.notShown,
      unreadable: scan.unreadable,
      // More is one call away exactly when a later page exists.
      truncated: rendered.page < rendered.pages
    }, scan.stopped.length > 0 || scan.unreadable > 0 ? 'partial' : 'success');
  }

  private async check(request: Request<'locations.check'>): Promise<WorkshopCapabilityResult> {
    const proposal: Partial<Record<ContextPathGroup, string[]>> = {};
    for (const { group, pattern } of request.patterns) {
      (proposal[group] ??= []).push(pattern);
    }
    const view = await this.checked(proposal, request);
    if (!('groups' in view)) {
      return view;
    }
    const content = renderWorkshopLocationsCheck(view);
    let kept = 0;
    let unmatched = 0;
    let incomplete = 0;
    let refused = 0;
    for (const group of view.groups) {
      kept += group.proposed?.kept.length ?? 0;
      for (const dropped of group.proposed?.dropped ?? []) {
        if (dropped.reason === 'unmatched') {
          unmatched += 1;
        } else if (dropped.reason === 'incomplete') {
          incomplete += 1;
        } else {
          refused += 1;
        }
      }
    }
    this.log(`check patterns=${request.patterns.length} kept=${kept} unmatched=${unmatched} incomplete=${incomplete} refused=${refused}`);
    return this.success(request, content, {
      outcome: 'check',
      patterns: request.patterns.length,
      kept,
      unmatched,
      incomplete,
      refused
    }, incomplete > 0 ? 'partial' : 'success');
  }

  /** The checker's view, or the result that says why there is none. */
  private async checked(
    proposal: ContextPathProposal,
    request: WorkshopLocationsRequest
  ): Promise<ContextPathProposalView | WorkshopCapabilityResult> {
    let answer;
    try {
      answer = await this.ports.checker.check(proposal);
    } catch {
      return this.failed(request, 'check-failed', 'The context paths could not be checked just now. Answer from what you have.');
    }
    this.throwIfAborted();
    return answer.kind === 'no-workspace' ? this.noWorkspace(request) : answer.proposal.view;
  }

  private success(
    request: WorkshopLocationsRequest,
    content: string,
    metadata: Record<string, string | number | boolean>,
    status: 'success' | 'partial'
  ): WorkshopCapabilityResult {
    return {
      capability: request.capability,
      status,
      requestSummary: workshopLocationsRequestSummary(request),
      content,
      metadata: { ...metadata, characters: content.length }
    };
  }

  private noWorkspace(request: WorkshopLocationsRequest): WorkshopCapabilityResult {
    return this.failed(request, 'no-workspace', WORKSHOP_LOCATIONS_NO_WORKSPACE);
  }

  private failed(request: WorkshopLocationsRequest, outcome: string, words: string): WorkshopCapabilityResult {
    this.log(`${request.capability} failed reason=${outcome}`);
    const content = workshopLocationsBody([words]);
    return {
      capability: request.capability,
      status: 'failed',
      requestSummary: workshopLocationsRequestSummary(request),
      content,
      metadata: { outcome, characters: content.length },
      error: words
    };
  }

  private throwIfAborted(): void {
    if (this.turn.signal.aborted) {
      const error = new Error('The context-paths read was cancelled.');
      error.name = 'AbortError';
      throw error;
    }
  }

  private log(line: string): void {
    this.outputChannel.appendLine(
      `[WorkshopLocationsCapability] request=${this.turn.requestId} persona=${this.turn.personaId} ${line}`
    );
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled locations request: ${JSON.stringify(value)}`);
}
