/** Paste-only project context shared with the Workshop host and tool runs. */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';

interface ContextBriefPanelProps {
  value: string;
  pendingDelivery: boolean;
  onSave: (text?: string) => void;
}

export const ContextBriefPanel: React.FC<ContextBriefPanelProps> = ({
  value,
  pendingDelivery,
  onSave
}) => {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const wordCount = React.useMemo(() => countWords(draft), [draft]);
  const isDirty = draft.trim() !== value.trim();
  const willTrim = wordCount > PROMPT_BUDGETS.contextBrief.words;

  return (
    <div className="pm-ws-block">
      <div className="pm-ws-block-head">
        <div className="pm-ws-eyebrow">Context Brief</div>
        <span className={`pm-ws-brief-count${willTrim ? ' pm-ws-brief-count-warn' : ''}`}>
          {wordCount.toLocaleString()} / {PROMPT_BUDGETS.contextBrief.words.toLocaleString()} words
        </span>
      </div>
      <textarea
        className="pm-ws-brief-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Paste project context, character notes, or story-bible essentials."
        rows={5}
        aria-label="Workshop context brief"
      />
      {willTrim && (
        <p className="pm-ws-brief-note pm-ws-brief-note-warn">
          The host and tools will receive the first{' '}
          {PROMPT_BUDGETS.contextBrief.words.toLocaleString()} words.
        </p>
      )}
      {pendingDelivery && !isDirty && (
        <p className="pm-ws-brief-note">Shared with your next host message.</p>
      )}
      <div className="pm-ws-excerpt-actions">
        <button
          className="pm-ws-pin-btn"
          type="button"
          disabled={!isDirty}
          onClick={() => onSave(draft.trim() || undefined)}
        >
          <Icon name="check" size={13} /> Save brief
        </button>
        {(draft.trim() || value) && (
          <button
            className="pm-ws-excerpt-edit"
            type="button"
            onClick={() => {
              setDraft('');
              onSave(undefined);
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
