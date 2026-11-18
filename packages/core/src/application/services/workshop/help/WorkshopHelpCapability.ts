import type { LogSink } from '@/platform';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import type { WorkshopCapabilityResult, WorkshopHelpRequest } from '@shared/types/workshopCapabilities';
import {
  fitWorkshopReadToWindow,
  workshopReadEvidenceTokens
} from '@/application/services/workshop/reads/WorkshopReadWindowFit';
import { workshopHelpRequestSummary } from '@/application/services/workshop/help/WorkshopHelpCopy';
import {
  renderWorkshopHelpRead,
  renderWorkshopHelpSearch
} from '@/application/services/workshop/help/WorkshopHelpRenderer';
import {
  searchWorkshopHelp,
  type WorkshopHelpReferencePort
} from '@/application/services/workshop/help/WorkshopHelpReference';

/** A persona's private reads share the installation's immutable index. */
export class WorkshopHelpCapability {
  constructor(
    private readonly reference: WorkshopHelpReferencePort,
    private readonly log: LogSink,
    private readonly turn: { readonly signal: AbortSignal }
  ) {}

  async fulfill(request: WorkshopHelpRequest, window?: CapabilityContextWindow): Promise<WorkshopCapabilityResult> {
    this.turn.signal.throwIfAborted();
    const index = await this.reference.load();
    this.turn.signal.throwIfAborted();
    const version = this.reference.version;
    if (!index) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: workshopHelpRequestSummary(request),
        error: `The Prose Minion reference for version ${version} is unavailable. Tell the writer you cannot check it.`
      };
    }
    let render: (take: number) => WorkshopCapabilityResult;
    let count: number;
    switch (request.capability) {
      case 'help.search': {
        const matches = searchWorkshopHelp(index, request.query);
        count = matches.hits.length;
        render = take => renderWorkshopHelpSearch(request, version, matches, take);
        break;
      }
      case 'help.read':
        count = request.sections.length;
        render = take => renderWorkshopHelpRead(request, version, index, take);
        break;
    }
    if (!window) {
      return render(count);
    }
    const half = Math.floor(window.freeInputTokens / 2);
    const fitted = fitWorkshopReadToWindow(size => {
      const outcome = render(size);
      return { size, outcome, tokens: workshopReadEvidenceTokens(outcome) };
    }, count, half, Math.min(count, 1));
    if (fitted.fit) {
      return fitted.fit.outcome;
    }
    this.log.appendLine(`[WorkshopHelpCapability] ${request.capability} refused halfWindow=${half}`);
    return {
      capability: request.capability, status: 'rejected', requestSummary: workshopHelpRequestSummary(request),
      error: `Prose Minion reference, version ${version}. The smallest result does not fit in the ${half} tokens available ` +
        '(half the room left). Say you could not check this here.',
      metadata: { rejectionReason: 'help-context-window', halfWindowTokens: half }
    };
  }
}
