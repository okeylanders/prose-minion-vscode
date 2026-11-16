/**
 * DictionaryHistorySearchBar — the search field at the top of the lookup
 * history popup, its "Also search definitions" toggle, and the line that
 * says how many lookups match (ADR 2026-10-14, the 2026-11-14 amendment).
 *
 * Presentational. The popup owns the query, the rows and every key that
 * leaves the field; this draws them.
 */
import * as React from 'react';
import { Icon } from '@components/shared/Icon';

export interface DictionaryHistorySearchBarProps {
  inputRef: React.RefObject<HTMLInputElement>;
  query: string;
  alsoDefinitions: boolean;
  /** "12 of 500 match"; `''` while nothing is typed. */
  matchLine: string;
  /** "Searching definitions…" or the one line a failed search leaves; `''` otherwise. */
  definitionsLine: string;
  onQueryChange: (query: string) => void;
  onAlsoDefinitionsChange: (on: boolean) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const DictionaryHistorySearchBar: React.FC<DictionaryHistorySearchBarProps> = ({
  inputRef,
  query,
  alsoDefinitions,
  matchLine,
  definitionsLine,
  onQueryChange,
  onAlsoDefinitionsChange,
  onKeyDown
}) => (
  <div className="pm-dictionary-history-search">
    <label className="pm-dictionary-history-search-field">
      <Icon name="search" size={14} />
      <input
        ref={inputRef}
        type="search"
        aria-label="Search lookup history"
        placeholder="Search words, context, files"
        value={query}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </label>
    <div className="pm-dictionary-history-search-options">
      <label className="pm-dictionary-history-search-toggle">
        <input
          type="checkbox"
          checked={alsoDefinitions}
          onChange={(event) => onAlsoDefinitionsChange(event.target.checked)}
        />
        <span>Also search definitions</span>
      </label>
      {/* Always mounted, so a screen reader hears the count change as the writer types. */}
      <span className="pm-dictionary-history-search-status" role="status">
        {matchLine}
        {matchLine && definitionsLine && ' · '}
        {definitionsLine}
      </span>
    </div>
  </div>
);
