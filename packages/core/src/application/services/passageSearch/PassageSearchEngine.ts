/**
 * PassageSearchEngine — what a caller of Passage Search holds (ADR
 * 2026-11-20 D1, D2). It resolves a request's scopes to files, then asks
 * `PassageSearchService` to plan and run the model work.
 *
 * - **Callers own consent.** The engine asks the writer nothing and shows
 *   nothing. `plan` sends nothing to a model; only `run` does, and it runs
 *   exactly the plan it is given: the plan's texts, the plan's model.
 * - **No caller is named.** Every caller holds the same engine, and nothing
 *   here knows which one is asking.
 * - **Built once,** in `extension.ts`, and placed in `CoreServices`. Nothing
 *   else constructs it.
 * - **The organizing pass afterwards is the caller's explicit action**
 *   (D12a): `planOrganize(result)`, then `organize(result, organizePlan)`.
 *   A caller that never offers it never calls it.
 *
 * Logs carry counts and closed reasons only (D22).
 */

import type { LogSink } from '@/platform';
import type {
  PassageSearchPlan,
  PassageSearchPlanOutcome,
  PassageSearchRefusal,
  PassageSearchResult,
  PassageSearchRunOptions
} from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchOrganizePlan, PassageSearchOrganizePlanOutcome } from '@services/search/passage/PassageSearchOrganizer';
import { passageSearchRefusal } from '@services/search/passage/PassageSearchRefusals';
import type { PassageSearchService } from '@services/search/passage/PassageSearchService';
import { passageSearchRequestRefusal, type PassageSearchRequest } from '@/application/services/passageSearch/PassageSearchRequest';
import type { PassageSearchScopeFiles } from '@/application/services/passageSearch/PassageSearchScopeFiles';

export interface PassageSearchEngine {
  /** Resolve, read, chunk and price: the plan, or a refusal in host words. Sends nothing to a model. */
  plan(request: PassageSearchRequest): Promise<PassageSearchPlanOutcome>;
  /** Run exactly `plan`. Stop is the caller's signal; what was found comes back either way. */
  run(plan: PassageSearchPlan, options?: PassageSearchRunOptions): Promise<PassageSearchResult>;
  /** Price an organizing pass over a result, exactly. Sends nothing to a model. */
  planOrganize(result: PassageSearchResult): Promise<PassageSearchOrganizePlanOutcome>;
  /** Make the pass the caller priced; the result comes back with its analysis, or as it was with why not. */
  organize(result: PassageSearchResult, plan: PassageSearchOrganizePlan, options?: Pick<PassageSearchRunOptions, 'signal'>): Promise<PassageSearchResult>;
}

/** The model work the engine asks for. */
export type PassageSearchModelWork = Pick<PassageSearchService, 'model' | 'plan' | 'run' | 'planOrganize' | 'organize'>;

export class ProjectPassageSearchEngine implements PassageSearchEngine {
  constructor(
    private readonly scopeFiles: Pick<PassageSearchScopeFiles, 'editorNow' | 'resolve'>,
    private readonly service: PassageSearchModelWork,
    private readonly log: LogSink
  ) {}

  async plan(request: PassageSearchRequest): Promise<PassageSearchPlanOutcome> {
    const malformed = passageSearchRequestRefusal(request);
    if (malformed) {
      return this.refused(malformed, request);
    }
    // Taken now, before anything is awaited: the editor the writer is in at the press, never one they have left.
    const editor = this.scopeFiles.editorNow();
    // Read once, before any file is listed or read: the plan is priced for this model and runs on it.
    const model = await this.service.model();
    if (!model) {
      return this.refused(passageSearchRefusal('no-key'), request);
    }
    const resolved = await this.scopeFiles.resolve(request.scopes, editor);
    if (resolved.kind === 'refused') {
      return this.refused(resolved.refusal, request);
    }
    if (resolved.files.length === 0) {
      return this.refused(passageSearchRefusal('no-files'), request);
    }
    return this.service.plan({
      model,
      question: request.question.trim(),
      organize: request.organize,
      files: resolved.files,
      leftOut: resolved.leftOut
    });
  }

  run(plan: PassageSearchPlan, options?: PassageSearchRunOptions): Promise<PassageSearchResult> {
    return this.service.run(plan, options);
  }

  planOrganize(result: PassageSearchResult): Promise<PassageSearchOrganizePlanOutcome> {
    return this.service.planOrganize(result);
  }

  organize(result: PassageSearchResult, plan: PassageSearchOrganizePlan, options?: Pick<PassageSearchRunOptions, 'signal'>): Promise<PassageSearchResult> {
    return this.service.organize(result, plan, options);
  }

  private refused(refusal: PassageSearchRefusal, request: PassageSearchRequest): PassageSearchPlanOutcome {
    this.log.appendLine(`[PassageSearch] Plan refused (${refusal.reason}): ${request.scopes.length} scope(s).`);
    return { kind: 'refused', refusal };
  }
}
