/**
 * LightboxSourcePanel — the rail's source card (ADR 2026-10-19 D10).
 *
 * Props-only, like the Workshop's ExcerptPanel, but over the Lightbox's own
 * routes: the board's source is not the Workshop's excerpt. It shows what was
 * boarded (path, counts, the opening lines) and offers "Choose file" and,
 * for a file-backed source, "Re-read file".
 */
import * as React from 'react';
import type { LightboxSource } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { Icon } from '@components/shared/Icon';

export interface LightboxSourcePanelProps {
  source: LightboxSource | null;
  rereading: boolean;
  onPickFile: () => void;
  onRefresh: () => void;
}

function lineRange(source: LightboxSource): string {
  if (source.startLine === undefined) {
    return '';
  }
  return source.endLine !== undefined && source.endLine !== source.startLine
    ? ` · lines ${source.startLine}–${source.endLine}`
    : ` · line ${source.startLine}`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSourcePanel: React.FC<LightboxSourcePanelProps> = ({
  source,
  rereading,
  onPickFile,
  onRefresh
}) => {
  const ceiling = PROMPT_BUDGETS.lightbox.sourceWords.toLocaleString('en-US');
  return (
    <section className="pm-ws-block pm-lb-source" aria-label="Source">
      <div className="pm-ws-block-head">
        <p className="pm-ws-eyebrow">{source?.kind === 'selection' ? 'Selection' : 'Source'}</p>
        {source && (
          <span className="pm-lb-stat-chip">{source.wordCount.toLocaleString('en-US')} words</span>
        )}
      </div>
      {source ? (
        <>
          <div className="pm-lb-source-path" title={source.displayPath}>
            <Icon name="doc" size={13} />
            <span>{source.displayPath}{lineRange(source)}</span>
          </div>
          <p className="pm-lb-source-preview">{source.preview}</p>
          <p className="pm-lb-source-meta">
            {source.paragraphCount.toLocaleString('en-US')} paragraphs · measured{' '}
            {new Date(source.capturedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
        </>
      ) : (
        <p className="pm-lb-source-empty">
          No source yet. Choose a file, right-click a chapter and pick <b>Open File in Lightbox</b>, or
          select a passage and run <b>Open Selection in Lightbox</b>.
        </p>
      )}
      <div className="pm-lb-button-row">
        {source?.kind === 'file' && (
          <button type="button" className="pm-lb-button is-grow" onClick={onRefresh} disabled={rereading}>
            <Icon name="refresh" size={13} />
            {rereading ? 'Re-reading…' : 'Re-read file'}
          </button>
        )}
        <button type="button" className="pm-lb-button is-grow" onClick={onPickFile}>
          Choose file
        </button>
      </div>
      <p className="pm-lb-caption">
        One file or selection per board, up to {ceiling} words. Counting is free: no model is asked.
      </p>
    </section>
  );
};
