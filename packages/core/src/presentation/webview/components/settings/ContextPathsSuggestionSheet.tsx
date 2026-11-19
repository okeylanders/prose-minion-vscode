/**
 * ContextPathsSuggestionSheet — "Suggest from my folders" and its review, in
 * the Settings overlay's context-paths section (ADR 2026-11-19 D21, D23,
 * D25). Mounted by `SettingsOverlay` in one line; its state is
 * `useContextPathsSuggestion`'s, held by the App.
 *
 * Per group proposed: the current patterns and their count, the proposed
 * patterns kept and their counts, each dropped with its reason, a few
 * example files, the files another group would share, and a checkbox,
 * ticked by default where something was kept. A group the workspace sets is
 * shown, its checkbox off and disabled. Apply writes the ticked groups for
 * every project (L1).
 */

import * as React from 'react';
import type { ContextPathGroupView } from '@shared/types';
import {
  CONTEXT_PATH_APPLIES_TO_ALL,
  CONTEXT_PATH_DROP_WORDS,
  CONTEXT_PATH_EVERY_GROUP_EMPTY,
  CONTEXT_PATH_GROUP_LABELS,
  CONTEXT_PATH_NOT_OFFERED_WORDS
} from '@shared/constants/contextPathSuggestionWords';
import type { UseContextPathsSuggestionReturn } from '@hooks/domain/useContextPathsSuggestion';
import { contextPathsAppliedLines } from '@utils/contextPathsSuggestion';

const files = (count: number | null) => (count === null ? 'couldn\'t count' : `${count} ${count === 1 ? 'file' : 'files'}`);

const GroupRow: React.FC<{
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

export const ContextPathsSuggestionSheet: React.FC<{ suggestion: UseContextPathsSuggestionReturn }> = ({ suggestion }) => {
  const { phase, view, ticked, applied, note, everyGroupEmpty, requestStatus } = suggestion;

  // Asked each time the section is shown, so the line follows the project.
  React.useEffect(() => {
    requestStatus();
  }, [requestStatus]);

  const busy = phase === 'suggesting' || phase === 'applying';
  const proposedGroups = view?.groups.filter((group) => group.proposed) ?? [];
  const kept = (view?.groups.length ?? 0) - proposedGroups.length;

  return (
    <div className="pm-cps" data-phase={phase}>
      {everyGroupEmpty && phase === 'idle' && <div className="pm-cps-empty">{CONTEXT_PATH_EVERY_GROUP_EMPTY}</div>}
      <div className="pm-cps-actions">
        <button type="button" className="settings-button" onClick={suggestion.suggest} disabled={busy}>
          Suggest from my folders
        </button>
        <span className="pm-cps-status" role="status">
          {phase === 'suggesting' ? 'Reading folder names…' : phase === 'applying' ? 'Applying…' : note ?? ''}
        </span>
      </div>
      <div className="settings-description">
        Reads your folder and file names, never their contents, and proposes patterns for you to review. It is a paid model call.
      </div>
      {(phase === 'review' || phase === 'applying') && view && (
        <section className="pm-cps-sheet" aria-label="Suggested context paths">
          <div className="pm-cps-applies">{CONTEXT_PATH_APPLIES_TO_ALL}</div>
          {view.scan?.stopped && (
            <div className="pm-cps-note">The project has more folders than one suggestion reads; the deepest were left out.</div>
          )}
          {proposedGroups.length === 0 ? (
            <div className="pm-cps-note">Nothing was proposed.</div>
          ) : (
            <ul className="pm-cps-groups">
              {proposedGroups.map((group) => (
                <GroupRow
                  key={group.group}
                  group={group}
                  ticked={ticked.includes(group.group)}
                  disabled={phase === 'applying'}
                  onToggle={() => suggestion.toggleGroup(group.group)}
                />
              ))}
            </ul>
          )}
          {kept > 0 && <div className="pm-cps-note">{kept === 1 ? 'One group wasn\'t proposed and keeps its patterns.' : `${kept} groups weren't proposed and keep their patterns.`}</div>}
          <div className="pm-cps-actions">
            <button type="button" className="settings-button" onClick={suggestion.apply} disabled={busy || ticked.length === 0}>
              Apply
            </button>
            <button type="button" className="settings-button" onClick={suggestion.dismiss} disabled={phase === 'applying'}>
              Cancel
            </button>
          </div>
        </section>
      )}
      {phase === 'applied' && applied && (
        <div className="pm-cps-applied" role="status">
          {contextPathsAppliedLines(applied).map((line) => <div key={line}>{line}</div>)}
          <button type="button" className="settings-button" onClick={suggestion.dismiss}>Done</button>
        </div>
      )}
    </div>
  );
};
