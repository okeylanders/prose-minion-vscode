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
import {
  CONTEXT_PATH_APPLIES_TO_ALL,
  CONTEXT_PATH_EVERY_GROUP_EMPTY
} from '@shared/constants/contextPathSuggestionWords';
import { ContextPathGroupRow as GroupRow } from './ContextPathGroupRow';
import type { UseContextPathsSuggestionReturn } from '@hooks/domain/useContextPathsSuggestion';
import { contextPathsAppliedLines } from '@utils/contextPathsSuggestion';

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
          {(view.scan?.unreadable ?? 0) > 0 && (
            <div className="pm-cps-note">
              {view.scan!.unreadable === 1 ? 'One folder couldn\'t be read' : `${view.scan!.unreadable} folders couldn't be read`}, so this suggestion was made from the rest; files there aren't in it.
            </div>
          )}
          {view.scan?.stopped && (
            <div className="pm-cps-note">The folder scan stopped early, so this suggestion was made from part of the project; the deepest folders were left out.</div>
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
