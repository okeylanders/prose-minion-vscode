import * as React from 'react';
import type { WorkshopHighlightPrompt, WorkshopHighlightPromptAnswer } from '@messages';
import { WorkshopModalShell } from './WorkshopModalShell';

interface Props {
  prompt: WorkshopHighlightPrompt;
  onAnswer: (prompt: WorkshopHighlightPrompt, choice: WorkshopHighlightPromptAnswer['choice']) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export function WorkshopHighlightPromptModal({ prompt, onAnswer }: Props) {
  const proposal = prompt.kind === 'proposal';
  const close = () => onAnswer(prompt, proposal ? 'skip' : 'not-now');
  const count = `${prompt.count} highlight${prompt.count === 1 ? '' : 's'}`;
  return (
    <WorkshopModalShell open titleId="workshop-highlight-prompt-title" className="pm-ws-confirm-modal pm-ws-highlight-prompt"
      closeLabel={proposal ? 'Skip proposed highlights' : 'Close restore prompt'} onClose={close}>
      <div className="pm-ws-session-sheet-head pm-ws-confirm-head">
        <div>
          <h2 id="workshop-highlight-prompt-title">
            {proposal ? `Apply ${prompt.persona}’s highlights?` : 'Restore saved highlights?'}
          </h2>
          <p>
            {proposal ? `“${prompt.title}” has ${count}` : `${count} in ${prompt.setCount} saved set${prompt.setCount === 1 ? '' : 's'}`}
            {' for '}<strong>{prompt.displayPath}</strong>.
          </p>
          {!proposal && <p>You can choose Show on the original reply to restore its highlights, or ask a persona for a fresh set.</p>}
        </div>
        <WorkshopModalShell.CloseButton />
      </div>
      <footer className="pm-ws-session-sheet-foot pm-ws-confirm-foot">
        {!proposal && (
          <button type="button" className="pm-ws-session-secondary" onClick={() => onAnswer(prompt, 'suppress')}>
            Don’t ask again for these highlights
          </button>
        )}
        <button type="button" className="pm-ws-session-secondary" onClick={close}>
          {proposal ? 'Skip' : 'Not now'}
        </button>
        <button type="button" className="pm-ws-session-primary" onClick={() => onAnswer(prompt, proposal ? 'apply' : 'restore')}>
          {proposal ? 'Apply highlights' : 'Restore highlights'}
        </button>
      </footer>
    </WorkshopModalShell>
  );
}
