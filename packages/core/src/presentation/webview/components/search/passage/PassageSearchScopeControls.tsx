/**
 * What Passage Search reads (ADR 2026-11-20 D15): the active file, the
 * selection, a checkbox per context group, and a path or pattern field.
 * Several at once. Posts nothing; the panel's hook owns the choices.
 */

import * as React from 'react';
import type { PassageSearchScopeChoices } from '@messages';
import { CONTEXT_PATH_GROUPS, type ContextPathGroup } from '@shared/types/context';
import { CONTEXT_PATH_GROUP_LABELS } from '@shared/constants/contextPathSuggestionWords';

interface PassageSearchScopeControlsProps {
  scopes: PassageSearchScopeChoices;
  onActiveFile: (on: boolean) => void;
  onSelection: (on: boolean) => void;
  onGroup: (group: ContextPathGroup, on: boolean) => void;
  onPattern: (pattern: string) => void;
}

export const PassageSearchScopeControls: React.FC<PassageSearchScopeControlsProps> = ({
  scopes,
  onActiveFile,
  onSelection,
  onGroup,
  onPattern
}) => (
  <fieldset className="input-container pm-ps-scopes">
    <legend className="text-sm font-medium">Search in</legend>
    <div className="pm-ps-checks">
      <label className="pm-ps-check">
        <input type="checkbox" checked={scopes.activeFile} onChange={(event) => onActiveFile(event.target.checked)} />
        <span>Active file</span>
      </label>
      <label className="pm-ps-check">
        <input type="checkbox" checked={scopes.selection} onChange={(event) => onSelection(event.target.checked)} />
        <span>Selection</span>
      </label>
    </div>
    <div className="pm-ps-group-title text-xs text-gray-500" id="pm-ps-groups-label">Context groups (every file in each)</div>
    <div className="pm-ps-checks" role="group" aria-labelledby="pm-ps-groups-label">
      {CONTEXT_PATH_GROUPS.map((group) => (
        <label className="pm-ps-check" key={group}>
          <input type="checkbox" checked={scopes.groups.includes(group)} onChange={(event) => onGroup(group, event.target.checked)} />
          <span>{CONTEXT_PATH_GROUP_LABELS[group]}</span>
        </label>
      ))}
    </div>
    <label className="block text-sm font-medium mb-2 mt-3" htmlFor="pm-ps-pattern">Paths or patterns</label>
    <span className="text-xs text-gray-500 block mb-1" id="pm-ps-pattern-hint">
      Inside the project, .md and .txt files. One a line, or separated by commas (for example drafts/part-2/*.md).
    </span>
    <textarea
      id="pm-ps-pattern"
      className="w-full"
      rows={2}
      value={scopes.pattern}
      onChange={(event) => onPattern(event.target.value)}
      aria-describedby="pm-ps-pattern-hint"
      spellCheck={false}
    />
  </fieldset>
);
