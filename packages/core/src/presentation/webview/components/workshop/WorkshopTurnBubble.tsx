/**
 * WorkshopTurnBubble — one completed entry in the Workshop thread
 * (PR #67 review #6: extracted from WorkshopApp's renderTurn).
 *
 * Tool-run user turns render as a compact request chip; free-text user turns
 * (Sprint 3) as a plain-text message bubble — the user's own words, shown
 * verbatim rather than markdown-rendered. Assistant turns are a card with
 * the tool (or "Follow-up") eyebrow, usage footer, optional truncation
 * notice, and the markdown body. Memoized: turns are immutable once
 * appended, so a bubble never needs to re-render after it first paints —
 * only the live streaming bubble rides the token clock.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { WorkshopToolId, WorkshopTurn } from '@messages';
import { WorkshopQuickActionBar } from './WorkshopQuickActionBar';
import { workshopToolIcon } from './workshopToolIcons';

interface WorkshopTurnBubbleProps {
  turn: WorkshopTurn;
  quickActionToolId: WorkshopToolId | null;
  quickActionsDisabled?: boolean;
  onQuickAction: (toolId: WorkshopToolId, label: string) => void;
  onCopyVariation: (content: string, toolId: WorkshopToolId | null) => void;
  onSaveVariation: (content: string, toolId: WorkshopToolId | null) => void;
}

interface ParsedVariation {
  number: string;
  label: string;
  content: string;
}

interface ParsedVariations {
  intro: string;
  variations: ParsedVariation[];
}

const VARIATION_HEADING = /^#{2,4}\s*Variation\s+(\d+)(?:\s*[-:]\s*(.+))?\s*$/gim;

export const parseVariations = (content: string): ParsedVariations | null => {
  const matches = [...content.matchAll(VARIATION_HEADING)];
  if (matches.length < 2) {
    return null;
  }

  const variations = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    return {
      number: match[1],
      label: match[2]?.trim() || `Option ${match[1]}`,
      content: content.slice(start, end).trim()
    };
  }).filter((variation) => variation.content.length > 0);

  if (variations.length < 2) {
    return null;
  }

  return {
    intro: content.slice(0, matches[0].index ?? 0).trim(),
    variations
  };
};

export const WorkshopTurnBubble: React.FC<WorkshopTurnBubbleProps> = React.memo(({
  turn,
  quickActionToolId,
  quickActionsDisabled = false,
  onQuickAction,
  onCopyVariation,
  onSaveVariation
}) => {
  // Persona replies are editorial conversation, not a tool artifact. Never
  // reinterpret their headings as tool variations with copy/save provenance.
  const parsedVariations = React.useMemo(
    () => turn.personaId ? null : parseVariations(turn.content),
    [turn.content, turn.personaId]
  );

  if (turn.role === 'user') {
    if (turn.kind === 'message') {
      return (
        <div className="pm-ws-turn pm-ws-turn-user">
          <div className="pm-ws-turn-message">{turn.content}</div>
        </div>
      );
    }
    return (
      <div className="pm-ws-turn pm-ws-turn-user">
        <span className="pm-ws-turn-chip">
          {turn.toolId && <Icon name={workshopToolIcon(turn.toolId)} size={13} />} {turn.toolLabel}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="pm-ws-turn pm-ws-turn-assistant">
        <div className="pm-ws-turn-head">
          <span className="pm-ws-eyebrow">
            <Icon name={turn.personaId ? 'person' : 'sparkle'} size={12} />{' '}
            {turn.personaLabel ?? turn.toolLabel ?? 'Follow-up'}
          </span>
          {turn.usage && (
            <span className="pm-ws-turn-usage">{turn.usage.totalTokens.toLocaleString()} tokens</span>
          )}
        </div>
        {turn.truncated && (
          <p className="pm-ws-turn-truncated">Response hit the max-token limit and was truncated.</p>
        )}
        {parsedVariations ? (
          <div className="pm-ws-turn-body">
            {parsedVariations.intro && (
              <MarkdownRenderer content={parsedVariations.intro} className="pm-ws-turn-body" />
            )}
            <div className="pm-ws-var-stack">
              {parsedVariations.variations.map((variation, index) => (
                <div className="pm-ws-var-card" key={`${turn.id}-${index}`}>
                  <div className="pm-ws-var-head">
                    <span className="pm-ws-var-number">Variation {index + 1}</span>
                    <span className="pm-ws-pill">{variation.label}</span>
                  </div>
                  <MarkdownRenderer content={variation.content} className="pm-ws-var-text" />
                  <div className="pm-ws-var-actions">
                    <button
                      className="pm-ws-var-action"
                      type="button"
                      onClick={() => onCopyVariation(variation.content, quickActionToolId)}
                    >
                      <Icon name="copy" size={13} /> Copy
                    </button>
                    <button
                      className="pm-ws-var-action"
                      type="button"
                      onClick={() => onSaveVariation(variation.content, quickActionToolId)}
                    >
                      <Icon name="save" size={13} /> Save to notes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <MarkdownRenderer content={turn.content} className="pm-ws-turn-body" />
        )}
      </div>
      {quickActionToolId && (
        <WorkshopQuickActionBar
          toolId={quickActionToolId}
          disabled={quickActionsDisabled}
          onAction={onQuickAction}
        />
      )}
    </>
  );
});

WorkshopTurnBubble.displayName = 'WorkshopTurnBubble';
