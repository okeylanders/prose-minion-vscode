/**
 * One group of a checked context-path proposal, as the Settings sheet and a
 * persona's card in the Workshop draw it (ADR 2026-11-19 D23): the current
 * patterns and their count, the proposed patterns kept and their counts,
 * each dropped with its reason, a few example files, the files another
 * group would share, and a checkbox. One component, so the two never draw
 * a group differently.
 */

import * as React from 'react';
import type { ContextPathGroupView } from '@shared/types';
import {
  CONTEXT_PATH_DROP_WORDS,
  CONTEXT_PATH_GROUP_LABELS,
  CONTEXT_PATH_NOT_OFFERED_WORDS
} from '@shared/constants/contextPathSuggestionWords';

const files = (count: number | null) => (count === null ? 'couldn\'t count' : `${count} ${count === 1 ? 'file' : 'files'}`);

export const ContextPathGroupRow: React.FC<{
  group: ContextPathGroupView;
  ticked: boolean;
  disabled: boolean;
  onToggle: () => void;
}> = ({ group, ticked, disabled, onToggle }) => {
  const label = CONTEXT_PATH_GROUP_LABELS[group.group];
  const proposed = group.proposed!;
  const offered = group.offer.offered;
  return (
    <li className="pm-cps-group" data-offered={offered ? 'true' : 'false'}>
      <label className="pm-cps-group-head">
        <input type="checkbox" checked={offered && ticked} disabled={!offered || disabled} onChange={onToggle} />
        <span className="pm-cps-group-label">{label}</span>
        <span className="pm-cps-group-count">{files(proposed.count)}</span>
      </label>
      {!group.offer.offered && <div className="pm-cps-note">{CONTEXT_PATH_NOT_OFFERED_WORDS[group.offer.reason]}</div>}
      <div className="pm-cps-line">
        <span className="pm-cps-key">Now</span>
        {group.current.patterns.length > 0
          ? group.current.patterns.map((pattern) => <code key={pattern}>{pattern}</code>)
          : <em>none</em>}
        <span className="pm-cps-count">{files(group.current.count)}</span>
      </div>
      <div className="pm-cps-line">
        <span className="pm-cps-key">Proposed</span>
        {proposed.kept.length > 0
          ? proposed.kept.map((kept) => <span key={kept.pattern}><code>{kept.pattern}</code> <span className="pm-cps-count">{files(kept.count)}</span></span>)
          : <em>nothing kept</em>}
      </div>
      {proposed.examples.length > 0 && (
        <div className="pm-cps-line pm-cps-examples">
          <span className="pm-cps-key">For example</span>
          {proposed.examples.map((example) => <code key={example}>{example}</code>)}
        </div>
      )}
      {proposed.shared.count > 0 && (
        <div className="pm-cps-line pm-cps-shared">
          <span className="pm-cps-key">Shared</span>
          <span>
            {files(proposed.shared.count)} another group also finds
            {proposed.shared.examples.length > 0 && ', such as '}
            {proposed.shared.examples.map((shared, index) => (
              <span key={shared.path}>
                {index > 0 && '; '}
                <code>{shared.path}</code> ({shared.groups.map((other) => CONTEXT_PATH_GROUP_LABELS[other]).join(', ')})
              </span>
            ))}
          </span>
        </div>
      )}
      {proposed.dropped.length > 0 && (
        <ul className="pm-cps-dropped" aria-label={`${label}: patterns left out`}>
          {proposed.dropped.map((dropped, index) => (
            <li key={`${dropped.pattern}-${index}`}><code>{dropped.pattern || ' '}</code> {CONTEXT_PATH_DROP_WORDS[dropped.reason]}</li>
          ))}
        </ul>
      )}
    </li>
  );
};
