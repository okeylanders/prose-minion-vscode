/**
 * ProjectResourcePickerModal — "Choose from project": browse and search the
 * writer's configured resources (the files their context paths name) and
 * pick one or several (Workshop Sprint 12 Phase 4, as its Context Selector;
 * shared with the Lightbox's source, 2026-10-20).
 *
 * Browse mode groups the catalog by category; typing a query switches to
 * search mode: name matches filter client-side (the catalog is already
 * here), and the "Names + content" pill asks the host for a content search
 * (debounced). Result categories render as filter pills plus All. Rows show
 * display-safe resolver paths and byte sizes only; no absolute path reaches
 * this component.
 *
 * - `single` selection: clicking a row picks it and closes (the Workshop's
 *   excerpt, the Lightbox's source).
 * - `multiple` selection: rows toggle, a row the caller calls attached is
 *   disabled, and the caller's footer confirms the selection.
 *
 * Every host effect is a callback: this component posts nothing and names
 * no route, so each tab keeps its own (`WORKSHOP_*`, `LIGHTBOX_*`). The
 * "Explore project folders…" escape hatch is the caller's host picker. It
 * renders in WorkshopModalShell, the boxed-modal chrome every full tab's
 * overlays use, so it joins the overlay stack: Escape closes only the top
 * overlay, focus starts on the close button and returns to the opener. The
 * shell's rules and this picker's (`pm-ws-ctxsel-*`) are the frame's, in
 * styles/fulltab/modal.css.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import type {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults
} from '@messages';
import { CONTEXT_PATH_GROUPS, ContextPathGroup } from '@shared/types/context';

const GROUP_LABELS: Record<ContextPathGroup, string> = {
  characters: 'Characters',
  locations: 'Locations & Settings',
  themes: 'Themes',
  things: 'Things / Props',
  chapters: 'Chapters & Scenes',
  manuscript: 'Manuscript',
  projectBrief: 'Project Brief',
  general: 'General References'
};

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

/** One resource's identity: its group and path (the catalog key). */
export const projectResourceKey = (entry: ConfiguredResourceRef): string =>
  `${entry.group}\u0000${entry.path}`;

type SearchMode = 'names' | 'names+content';

/** The words that differ between the tabs and modes; everything else is shared. */
export interface ProjectResourcePickerCopy {
  /** The small line over the title ("Set excerpt", "Add context"). */
  eyebrow: string;
  /** What picking does, under the title. */
  description: string;
  /** The escape hatch's note, after "Explore project folders…". */
  exploreNote: string;
}

/** What a `multiple` caller's footer works with. */
export interface ProjectResourcePickerFooterState {
  /** The selected entries, in the order the writer chose them. */
  selected: ConfiguredResourceEntry[];
  /** Hand the selection to `onConfirm`, then close. */
  confirm: () => void;
  close: () => void;
}

interface ProjectResourcePickerCommonProps {
  open: boolean;
  copy: ProjectResourcePickerCopy;
  /** aria-label of the close button. */
  closeLabel: string;
  /** Null until the host answers. */
  catalog: ConfiguredResourceEntry[] | null;
  /** The host could not read the configured folders; the empty catalog says so. */
  catalogUnreadable?: boolean;
  /** The host's latest content-search answer (used only when its query matches). */
  searchResults: ConfiguredResourceSearchResults | null;
  /** Ask the host for a content search (after the debounce). */
  onSearch: (query: string) => void;
  /** The query emptied: forget the last content-search answer. */
  onClearSearch: () => void;
  /** The host's own file picker. The picker closes after calling it. */
  onExplore: () => void;
  onClose: () => void;
}

interface ProjectResourcePickerSingleProps {
  selection: 'single';
  /** The footer's instruction ("Click a file to set it as the excerpt"). */
  pickHint: string;
  /** The picked resource, by its key. The picker closes after calling it. */
  onPick: (item: ConfiguredResourceRef) => void;
}

interface ProjectResourcePickerMultipleProps {
  selection: 'multiple';
  /** Rows to show as already attached, disabled. */
  isAttached?: (entry: ConfiguredResourceEntry) => boolean;
  /** The selected resources, by key, in the writer's order. */
  onConfirm: (items: ConfiguredResourceRef[]) => void;
  renderFooter: (state: ProjectResourcePickerFooterState) => React.ReactNode;
}

export type ProjectResourcePickerModalProps = ProjectResourcePickerCommonProps &
  (ProjectResourcePickerSingleProps | ProjectResourcePickerMultipleProps);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const ProjectResourcePickerModal: React.FC<ProjectResourcePickerModalProps> = (props) => {
  const {
    open,
    copy,
    closeLabel,
    catalog,
    catalogUnreadable = false,
    searchResults,
    onSearch,
    onClearSearch,
    onExplore,
    onClose
  } = props;
  const single = props.selection === 'single';
  const [selected, setSelected] = React.useState<Map<string, ConfiguredResourceEntry>>(new Map());
  const [activeGroup, setActiveGroup] = React.useState<ContextPathGroup | null>(null);
  const [query, setQuery] = React.useState('');
  const [searchMode, setSearchMode] = React.useState<SearchMode>('names');
  const [groupFilter, setGroupFilter] = React.useState<ContextPathGroup | 'all'>('all');

  React.useEffect(() => {
    if (open) {
      setSelected(new Map());
      setActiveGroup(null);
      setQuery('');
      setSearchMode('names');
      setGroupFilter('all');
    }
  }, [open]);

  // Debounced host content search — only in names+content mode.
  React.useEffect(() => {
    if (!open || searchMode !== 'names+content' || query.trim().length === 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => onSearch(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [onSearch, open, query, searchMode]);

  React.useEffect(() => {
    if (query.trim().length === 0) {
      onClearSearch();
      setGroupFilter('all');
    }
  }, [onClearSearch, query]);

  const searching = query.trim().length > 0;
  const normalizedQuery = query.trim().toLowerCase();

  const searchRows = React.useMemo(() => {
    if (!searching || !catalog) {
      return [];
    }
    const nameMatches = catalog.filter(
      (entry) =>
        entry.path.toLowerCase().includes(normalizedQuery) ||
        entry.label.toLowerCase().includes(normalizedQuery)
    );
    if (searchMode === 'names') {
      return nameMatches;
    }
    const contentKeys = new Set(
      (searchResults?.query.trim().toLowerCase() === normalizedQuery
        ? searchResults.matches
        : []
      ).map(projectResourceKey)
    );
    const merged = new Map(nameMatches.map((entry) => [projectResourceKey(entry), entry]));
    for (const entry of catalog) {
      if (contentKeys.has(projectResourceKey(entry))) {
        merged.set(projectResourceKey(entry), entry);
      }
    }
    return [...merged.values()];
  }, [catalog, normalizedQuery, searchMode, searchResults, searching]);

  const searchGroups = React.useMemo(
    () => CONTEXT_PATH_GROUPS.filter((group) => searchRows.some((row) => row.group === group)),
    [searchRows]
  );

  const visibleSearchRows = groupFilter === 'all'
    ? searchRows
    : searchRows.filter((row) => row.group === groupFilter);

  const toggle = (entry: ConfiguredResourceEntry) => {
    setSelected((current) => {
      const next = new Map(current);
      const key = projectResourceKey(entry);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, entry);
      }
      return next;
    });
  };

  const selectedEntries = [...selected.values()];

  const fileRow = (entry: ConfiguredResourceEntry, showGroupTag: boolean) => {
    const attached = props.selection === 'multiple' && (props.isAttached?.(entry) ?? false);
    const checked = selected.has(projectResourceKey(entry));
    const pick = () => {
      if (props.selection === 'single') {
        props.onPick({ group: entry.group, path: entry.path });
        onClose();
      } else {
        toggle(entry);
      }
    };
    return (
      <button
        key={projectResourceKey(entry)}
        className={`pm-ws-ctxsel-file${checked ? ' pm-ws-ctxsel-file-selected' : ''}${attached ? ' pm-ws-ctxsel-file-attached' : ''}`}
        type="button"
        role={single ? 'button' : 'checkbox'}
        aria-checked={single ? undefined : checked}
        disabled={attached}
        onClick={pick}
      >
        {single ? null : (
        <span className="pm-ws-ctxsel-check" aria-hidden="true">
          <Icon name="check" size={10} />
        </span>
        )}
        <span className="pm-ws-ctxsel-path">{entry.path}</span>
        {showGroupTag ? (
          <span className="pm-ws-ctxsel-tag">{GROUP_LABELS[entry.group]}</span>
        ) : null}
        <span className="pm-ws-ctxsel-size">{attached ? 'attached' : formatSize(entry.sizeBytes)}</span>
      </button>
    );
  };

  const browseGroups = CONTEXT_PATH_GROUPS.map((group) => ({
    group,
    entries: (catalog ?? []).filter((entry) => entry.group === group)
  })).filter(({ entries }) => entries.length > 0);

  const footer = props.selection === 'single' ? (
    <div className="pm-ws-ctxsel-foot">
      <span className="pm-ws-ctxsel-total">{props.pickHint}</span>
      <span className="pm-ws-ctxsel-spacer" />
      <button className="pm-ws-action-btn" type="button" onClick={onClose}>
        Cancel
      </button>
    </div>
  ) : props.renderFooter({
    selected: selectedEntries,
    confirm: () => {
      props.onConfirm(selectedEntries.map((entry) => ({ group: entry.group, path: entry.path })));
      onClose();
    },
    close: onClose
  });

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-ctxsel-title"
      closeLabel={closeLabel}
      className="pm-ws-ctxsel-modal"
      onClose={onClose}
    >
      <div className="pm-ws-tools-modal-head">
        <div>
          <div className="pm-ws-eyebrow">
            {copy.eyebrow}
          </div>
          <h2 id="pm-ws-ctxsel-title">Choose from project</h2>
          <p>
            {copy.description}
          </p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <div className="pm-ws-ctxsel-search">
        <Icon name="search" size={14} />
        <input
          type="text"
          value={query}
          placeholder="Search configured resources…"
          aria-label="Search configured resources"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="pm-ws-ctxsel-modes" role="group" aria-label="Search mode">
          <button
            type="button"
            className={`pm-ws-ctxsel-mode${searchMode === 'names' ? ' pm-ws-ctxsel-mode-active' : ''}`}
            aria-pressed={searchMode === 'names'}
            onClick={() => setSearchMode('names')}
          >
            Names
          </button>
          <button
            type="button"
            className={`pm-ws-ctxsel-mode${searchMode === 'names+content' ? ' pm-ws-ctxsel-mode-active' : ''}`}
            aria-pressed={searchMode === 'names+content'}
            onClick={() => setSearchMode('names+content')}
          >
            Names + content
          </button>
        </div>
      </div>

      <div className="pm-ws-ctxsel-body">
        {catalog === null ? (
          <p className="pm-ws-ctxsel-empty">Reading your configured resource folders…</p>
        ) : searching ? (
          <>
            <div className="pm-ws-ctxsel-pills" role="group" aria-label="Filter results by category">
              <button
                type="button"
                className={`pm-ws-ctxsel-pill${groupFilter === 'all' ? ' pm-ws-ctxsel-pill-active' : ''}`}
                aria-pressed={groupFilter === 'all'}
                onClick={() => setGroupFilter('all')}
              >
                All · {searchRows.length}
              </button>
              {searchGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  className={`pm-ws-ctxsel-pill${groupFilter === group ? ' pm-ws-ctxsel-pill-active' : ''}`}
                  aria-pressed={groupFilter === group}
                  onClick={() => setGroupFilter(group)}
                >
                  {GROUP_LABELS[group]} · {searchRows.filter((row) => row.group === group).length}
                </button>
              ))}
            </div>
            {searchMode === 'names+content' && searchResults?.bounded ? (
              <p className="pm-ws-ctxsel-note" role="status">
                Content search stopped at its safety bounds — narrow the query for full coverage.
              </p>
            ) : null}
            {visibleSearchRows.length === 0 ? (
              <p className="pm-ws-ctxsel-empty">
                {searchMode === 'names+content'
                  ? 'No matching names or content in the configured folders.'
                  : 'No matching file names — try Names + content.'}
              </p>
            ) : (
              visibleSearchRows.map((entry) => fileRow(entry, true))
            )}
          </>
        ) : activeGroup ? (
          <>
            <div className="pm-ws-ctxsel-nav">
              <button className="pm-ws-action-btn" type="button" onClick={() => setActiveGroup(null)}>
                ← Back
              </button>
              <span className="pm-ws-ctxsel-crumb">{GROUP_LABELS[activeGroup]}</span>
            </div>
            {(catalog ?? [])
              .filter((entry) => entry.group === activeGroup)
              .map((entry) => fileRow(entry, false))}
          </>
        ) : browseGroups.length === 0 ? (
          catalogUnreadable ? (
            <p className="pm-ws-ctxsel-empty">
              Could not read your configured resource folders. Use Explore below.
            </p>
          ) : (
            <p className="pm-ws-ctxsel-empty">
              No configured resource folders found. Set them under Prose Minion&apos;s context paths,
              or use Explore below.
            </p>
          )
        ) : (
          <div className="pm-ws-ctxsel-cats">
            {browseGroups.map(({ group, entries }) => {
              const selectedCount = entries.filter((entry) => selected.has(projectResourceKey(entry))).length;
              return (
                <button
                  key={group}
                  className="pm-ws-ctxsel-cat"
                  type="button"
                  onClick={() => setActiveGroup(group)}
                >
                  <span className="pm-ws-ctxsel-cat-name">{GROUP_LABELS[group]}</span>
                  <span className="pm-ws-ctxsel-cat-meta">
                    {entries.length} file{entries.length === 1 ? '' : 's'} ·{' '}
                    {formatSize(entries.reduce((total, entry) => total + entry.sizeBytes, 0))}
                  </span>
                  {selectedCount > 0 ? (
                    <span className="pm-ws-ctxsel-cat-selected">{selectedCount} selected</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        <button className="pm-ws-ctxsel-explore" type="button" onClick={() => { onExplore(); onClose(); }}>
          <Icon name="doc" size={14} />
          <span>
            Explore project folders… <small>{copy.exploreNote}</small>
          </span>
        </button>
      </div>

      {footer}
    </WorkshopModalShell>
  );
};
