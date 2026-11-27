import { randomUUID } from 'node:crypto';
import type { WorkshopHighlightPrompt, WorkshopHighlightPromptAnswer } from '@messages';
import type { WorkshopHighlightProposalDetails } from '@/application/services/workshop/highlights/WorkshopReplyHighlights';

type Proposal = Extract<WorkshopHighlightPrompt, { kind: 'proposal' }>;

/** One unanswered provider reply in this Workshop view. Nothing here is written to the session. */
export class WorkshopHighlightProposal {
  private pending?: {
    readonly prompt: Proposal;
    readonly finish: (apply: boolean) => void;
  };

  constructor(private readonly changed: () => void) {}

  current(): Proposal | undefined {
    return this.pending?.prompt;
  }

  ask(details: WorkshopHighlightProposalDetails, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) {
      return Promise.resolve(false);
    }
    this.cancel();
    const prompt: Proposal = { ...details, kind: 'proposal', promptId: randomUUID() };
    return new Promise((resolve) => {
      const abort = () => finish(false);
      const finish = (apply: boolean) => {
        if (this.pending?.prompt !== prompt) {
          return;
        }
        this.pending = undefined;
        signal.removeEventListener('abort', abort);
        resolve(apply);
        this.changed();
      };
      this.pending = { prompt, finish };
      signal.addEventListener('abort', abort, { once: true });
      this.changed();
    });
  }

  answer(answer: WorkshopHighlightPromptAnswer): void {
    const pending = this.pending;
    if (pending && answer.promptId === pending.prompt.promptId && answer.roomRevision === pending.prompt.roomRevision
      && (answer.choice === 'apply' || answer.choice === 'skip')) {
      pending.finish(answer.choice === 'apply');
    }
  }

  cancel(): void {
    this.pending?.finish(false);
  }
}
