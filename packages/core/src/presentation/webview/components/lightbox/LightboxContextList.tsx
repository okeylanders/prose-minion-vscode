/**
 * LightboxContextList — the rail's context files (ADR 2026-10-19 D9).
 *
 * Props-only. Project files the writer attaches to inform the readings (who
 * someone is, what the voice should be). They follow the chapter in each
 * call as a labeled section and count toward the fit check, but they are
 * never evidence: the host only ever checks quotes against the chapter.
 *
 * "Add from project…" opens the shared project picker to attach several at
 * once, as the Workshop's context panel does (2026-10-20); its "Explore
 * project folders…" is the system picker. A refusal's reason shows here.
 */
import * as React from 'react';
import type { LightboxContextState } from '@hooks/domain/useLightbox';
import { Icon } from '@components/shared/Icon';

export interface LightboxContextListProps {
  context: LightboxContextState;
  /** Opens the project picker to attach context. */
  onAddFromProject: () => void;
  onRemove: (id: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxContextList: React.FC<LightboxContextListProps> = ({ context, onAddFromProject, onRemove }) => (
  <section className="pm-ws-block pm-lb-context" aria-label="Context">
    <div className="pm-ws-block-head">
      <p className="pm-ws-eyebrow">Context</p>
      <span className="pm-lb-meta">
        {context.files.length === 0 ? 'none' : `${context.totalWords.toLocaleString('en-US')} words`}
      </span>
    </div>
    {context.files.length > 0 && (
      <ul className="pm-lb-context-list">
        {context.files.map((file) => (
          <li key={file.id} className="pm-lb-context-item">
            <Icon name="doc" size={12} />
            <span className="pm-lb-context-path" title={file.displayPath}>{file.displayPath}</span>
            <span className="pm-lb-context-words">{file.wordCount.toLocaleString('en-US')} w</span>
            <button
              type="button"
              className="pm-lb-context-remove"
              aria-label={`Remove ${file.displayPath}`}
              onClick={() => onRemove(file.id)}
            >
              <Icon name="x" size={11} />
            </button>
          </li>
        ))}
      </ul>
    )}
    {context.notice && <p className="pm-lb-context-notice" role="alert">{context.notice}</p>}
    <div className="pm-lb-button-row">
      <button type="button" className="pm-lb-button is-grow" onClick={onAddFromProject}>
        Add from project…
      </button>
    </div>
    <p className="pm-lb-caption">
      Context informs the readings. It never becomes evidence: only the chapter can be quoted.
      {context.ceilingWords > 0 ? ` Up to ${context.ceilingWords.toLocaleString('en-US')} words.` : ''}
    </p>
  </section>
);
