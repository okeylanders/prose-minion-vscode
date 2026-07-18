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
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';

interface WorkshopTurnBubbleProps {
  turn: WorkshopTurn;
  quickActionToolId: WorkshopToolId | null;
  quickActionsDisabled?: boolean;
  canTalkDirectly?: boolean;
  promotedFindingKeys?: ReadonlySet<string>;
  findingsStale?: boolean;
  onQuickAction: (toolId: WorkshopToolId, reportTurnId: string, label: string) => void;
  onTalkDirectly: (toolId: WorkshopToolId) => void;
  onAddTodo?: (sourceTurnId: string, findingKey: string) => void;
  onCopy: (content: string, turn: WorkshopTurn) => void;
  onSave: (content: string, turn: WorkshopTurn) => void;
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
export const WORKSHOP_TURN_ID_ATTRIBUTE = 'data-turn-id';

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

const capabilityMetadataRows = (turn: WorkshopTurn): string[] => {
  const metadata = turn.capability?.metadata;
  if (!metadata) return [];
  const rows: string[] = [];
  if (typeof metadata.successCount === 'number' && typeof metadata.totalBlocks === 'number') {
    rows.push(`${metadata.successCount}/${metadata.totalBlocks} dictionary sections completed`);
  }
  if (typeof metadata.totalDuration === 'number') {
    rows.push(`Completed in ${(metadata.totalDuration / 1000).toFixed(1)}s`);
  }
  if (Array.isArray(metadata.partialFailures) && metadata.partialFailures.length > 0) {
    rows.push(`Partial failures: ${metadata.partialFailures.join(', ')}`);
  }
  if (metadata.truncated === true) {
    rows.push(turn.capability?.operation.startsWith('resource.')
      ? 'Result was bounded by the project-resource limits'
      : 'Result reached its response-token limit');
  }
  if (typeof metadata.fileCount === 'number') {
    rows.push(`${metadata.fileCount} configured ${metadata.fileCount === 1 ? 'file' : 'files'} listed`);
  }
  if (metadata.searchMode === 'catalog' && typeof metadata.catalogEntriesScanned === 'number') {
    rows.push(`${metadata.catalogEntriesScanned} configured ${metadata.catalogEntriesScanned === 1 ? 'path' : 'paths'} searched`);
  }
  if (typeof metadata.filesScanned === 'number' && metadata.filesScanned > 0) {
    rows.push(`${metadata.filesScanned} configured ${metadata.filesScanned === 1 ? 'file' : 'files'} searched`);
  }
  if (typeof metadata.matchCount === 'number') {
    rows.push(`${metadata.matchCount} ${metadata.matchCount === 1 ? 'match' : 'matches'} found`);
  }
  if (
    typeof metadata.startLine === 'number' &&
    typeof metadata.endLine === 'number' &&
    typeof metadata.totalLines === 'number'
  ) {
    rows.push(`lines ${metadata.startLine}–${metadata.endLine} of ${metadata.totalLines}`);
  }
  if (typeof metadata.bytes === 'number' && typeof metadata.totalBytes === 'number') {
    rows.push(`${metadata.bytes.toLocaleString()} of ${metadata.totalBytes.toLocaleString()} bytes read`);
  } else if (typeof metadata.bytesScanned === 'number' && metadata.bytesScanned > 0) {
    rows.push(`${metadata.bytesScanned.toLocaleString()} bytes searched`);
  }
  return rows;
};

export const WorkshopTurnBubble: React.FC<WorkshopTurnBubbleProps> = React.memo(({
  turn,
  quickActionToolId,
  quickActionsDisabled = false,
  canTalkDirectly = false,
  promotedFindingKeys = new Set(),
  findingsStale = false,
  onQuickAction,
  onTalkDirectly,
  onAddTodo = () => undefined,
  onCopy,
  onSave
}) => {
  // Persona replies are editorial conversation, not a tool artifact. Never
  // reinterpret their headings as tool variations with copy/save provenance.
  const parsedVariations = React.useMemo(
    () => turn.personaId || turn.capability ? null : parseVariations(turn.content),
    [turn.capability, turn.content, turn.personaId]
  );

  const capabilityLabel = turn.capability
    ? `${turn.capability.operation.startsWith('dictionary.')
      ? "Writer's Dictionary"
      : turn.capability.operation.startsWith('resource.')
        ? 'Project Resources'
        : turn.toolLabel ?? 'Analysis'} · ${turn.capability.requestSummary} · requested by ${workshopPersonaLabel(turn.capability.requestedByPersonaId)}`
    : undefined;
  const capabilityMetadata = capabilityMetadataRows(turn);
  const turnIdentity = { [WORKSHOP_TURN_ID_ATTRIBUTE]: turn.id };

  if (turn.artifact === 'excerpt_revision') {
    return (
      <div className="pm-ws-revision-divider" role="separator">
        <span>{turn.content}</span>
      </div>
    );
  }

  if (turn.role === 'user') {
    if (turn.kind === 'message') {
      return (
        <div className="pm-ws-turn pm-ws-turn-user">
          {turn.messageAttachments && turn.messageAttachments.length > 0 && (
            <div className="pm-ws-turn-attachments" aria-label="Message attachments">
              {turn.messageAttachments.map((attachment) => (
                <span key={attachment.id} className="pm-ws-turn-attachment" title={attachment.relativePath ?? attachment.label}>
                  <Icon name="doc" size={11} /> {attachment.label} ·{' '}
                  {attachment.words.toLocaleString()} words
                  {attachment.truncation ? ' (head slice)' : ''}
                </span>
              ))}
            </div>
          )}
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
      <div
        className="pm-ws-turn pm-ws-turn-assistant"
        {...turnIdentity}
        tabIndex={-1}
      >
        <div className="pm-ws-turn-head">
          <span className="pm-ws-eyebrow">
            <Icon name={turn.personaId ? 'person' : 'sparkle'} size={12} />{' '}
            {turn.personaLabel ?? turn.toolLabel ?? 'Follow-up'}
          </span>
          {turn.usage && (
            <span
              className="pm-ws-turn-usage"
              title={`${turn.usage.totalTokens.toLocaleString()} tokens processed across ${turn.usage.requestCount ?? 1} ${(turn.usage.requestCount ?? 1) === 1 ? 'call' : 'calls'}`}
            >
              {turn.usage.totalTokens.toLocaleString()} processed
            </span>
          )}
        </div>
        {turn.truncated && (
          <p className="pm-ws-turn-truncated">Response hit the max-token limit and was truncated.</p>
        )}
        {turn.capability ? (
          <details className="pm-ws-capability-artifact">
            <summary>
              <span>{capabilityLabel}</span>
              <span className={`pm-ws-capability-status pm-ws-capability-status-${turn.capability.status}`}>
                {turn.capability.status}
              </span>
            </summary>
            {capabilityMetadata.length > 0 && (
              <ul className="pm-ws-capability-metadata" aria-label="Capability metadata">
                {capabilityMetadata.map((row) => <li key={row}>{row}</li>)}
              </ul>
            )}
            <MarkdownRenderer content={turn.content} className="pm-ws-turn-body" />
          </details>
        ) : parsedVariations ? (
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
                      onClick={() => onCopy(variation.content, turn)}
                    >
                      <Icon name="copy" size={13} /> Copy
                    </button>
                    <button
                      className="pm-ws-var-action"
                      type="button"
                      onClick={() => onSave(variation.content, turn)}
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
        {turn.actionableFindings && (
          <div className="pm-ws-findings" aria-label="Actionable findings">
            <div className="pm-ws-findings-head">
              <div className="pm-ws-findings-title">Add a next step</div>
              {turn.actionableFindings.some((finding) => !promotedFindingKeys.has(finding.key)) && (
                <button
                  className="pm-ws-findings-add-all"
                  type="button"
                  disabled={findingsStale}
                  title={findingsStale ? 'These findings belong to a superseded excerpt.' : undefined}
                  onClick={() => turn.actionableFindings?.forEach((finding) => {
                    if (!promotedFindingKeys.has(finding.key)) {
                      onAddTodo(turn.id, finding.key);
                    }
                  })}
                >
                  Add all
                </button>
              )}
            </div>
            {turn.actionableFindings.map((finding) => {
              const promoted = promotedFindingKeys.has(finding.key);
              const disabled = promoted || findingsStale;
              return (
                <div className="pm-ws-finding" key={finding.key}>
                  <span>
                    {finding.priority && (
                      <span className={`pm-ws-priority pm-ws-priority-${finding.priority}`}>
                        {finding.priority}
                      </span>
                    )}
                    {finding.text}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    title={findingsStale ? 'This finding belongs to a superseded excerpt.' : undefined}
                    onClick={() => onAddTodo(turn.id, finding.key)}
                  >
                    <Icon name={promoted ? 'check' : 'plus'} size={12} />
                    {promoted ? 'Added' : findingsStale ? 'Stale' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="pm-ws-turn-actions">
          <button type="button" onClick={() => onCopy(turn.content, turn)}>
            <Icon name="copy" size={13} /> Copy
          </button>
          <button type="button" onClick={() => onSave(turn.content, turn)}>
            <Icon name="save" size={13} /> Save to notes
          </button>
          {canTalkDirectly && turn.toolId && (
            <button type="button" onClick={() => onTalkDirectly(turn.toolId!)}>
              <Icon name="dialogue" size={13} /> Talk directly to {turn.toolLabel}
            </button>
          )}
        </div>
      </div>
      {quickActionToolId && (
        <WorkshopQuickActionBar
          toolId={quickActionToolId}
          disabled={quickActionsDisabled}
          onAction={(toolId, label) => onQuickAction(toolId, turn.reportTurnId!, label)}
        />
      )}
    </>
  );
});

WorkshopTurnBubble.displayName = 'WorkshopTurnBubble';
