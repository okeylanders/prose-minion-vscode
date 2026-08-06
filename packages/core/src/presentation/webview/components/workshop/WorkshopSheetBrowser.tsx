/**
 * WorkshopSheetBrowser — the shared select-then-launch sheet from the
 * 2026-07-26 design drop (`cwSheetBrowser` in docs/design/pm-widgets.js):
 * a locked header, a scrolling categorized card grid with a circular check
 * per card, and a locked footer that summarizes the selection beside Cancel
 * and one primary action.
 *
 * Selection is CONTROLLED by the consumer — the Tools browser seeds it from
 * the active tool and launches a run; the Widgets browser exposes only actions
 * supported by each selected card. The component renders
 * inside the shared `WorkshopModalShell` sheet variant; `pm-ws-browser-modal`
 * narrows that shared geometry to the design's 940×780 dimensions.
 */

import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';

/** Rail kinds color the lifecycle tag exactly as the design comp does. */
export type WorkshopSheetTagKind = 'oneshot' | 'standing' | 'resource';

export interface WorkshopSheetTag {
  label: string;
  kind: WorkshopSheetTagKind;
}

export interface WorkshopSheetItem {
  id: string;
  icon: IconName;
  name: string;
  blurb: string;
  tag?: WorkshopSheetTag;
  /** Sprint/concept roadmap tag shown beside the rail tag. */
  metaTag?: string;
  /** Selectable roadmap card whose launch actions remain unavailable. */
  unavailable?: boolean;
  unavailableLabel?: string;
  /** Footer note shown while this item is selected (e.g. its room lifetime). */
  /** Contextual footer copy for the selected item. */
  selectionNote?: string;
}

export interface WorkshopSheetGroup {
  name: string;
  desc?: string;
  items: readonly WorkshopSheetItem[];
}

interface WorkshopSheetBrowserProps {
  titleId: string;
  eyebrow: string;
  title: string;
  sub: React.ReactNode;
  /** Footer copy while nothing is selected. */
  emptyNote: string;
  groups: readonly WorkshopSheetGroup[];
  selectedId: string | null;
  /** Clicking a selected card deselects it (null), matching the comp. */
  onSelect: (id: string | null) => void;
  /** Hard-disable every card (the Tools browser's gated state). */
  cardsDisabled?: boolean;
  launchLabel: string;
  launchDisabled: boolean;
  launchHint?: string;
  onLaunch: () => void;
  secondaryLabel?: string;
  secondaryDisabled?: boolean;
  secondaryHint?: string;
  onSecondary?: () => void;
  onCancel: () => void;
  /** Slot for the shell's CloseButton so it sits inside the sheet chrome. */
  closeButton?: React.ReactNode;
}

const findItem = (
  groups: readonly WorkshopSheetGroup[],
  id: string | null
): WorkshopSheetItem | undefined =>
  id === null ? undefined : groups.flatMap((group) => group.items).find((item) => item.id === id);

const TagPill: React.FC<{ tag: WorkshopSheetTag }> = ({ tag }) => (
  <span className={`pm-ws-sb-railtag pm-ws-sb-railtag-${tag.kind}`}>{tag.label}</span>
);

export const WorkshopSheetBrowser: React.FC<WorkshopSheetBrowserProps> = ({
  titleId,
  eyebrow,
  title,
  sub,
  emptyNote,
  groups,
  selectedId,
  onSelect,
  cardsDisabled = false,
  launchLabel,
  launchDisabled,
  launchHint,
  onLaunch,
  secondaryLabel,
  secondaryDisabled = false,
  secondaryHint,
  onSecondary,
  onCancel,
  closeButton
}) => {
  const selected = findItem(groups, selectedId);

  return (
    <div className="pm-ws-sb">
      {closeButton}
      <header className="pm-ws-sb-head">
        <div className="pm-ws-eyebrow pm-ws-sb-eyebrow">{eyebrow}</div>
        <h2 id={titleId}>{title}</h2>
        <p>{sub}</p>
      </header>
      <div className="pm-ws-sb-body">
        {groups.map((group) => (
          <React.Fragment key={group.name}>
            <div className="pm-ws-sb-gh">
              <span className="pm-ws-sb-gh-title">{group.name}</span>
              {group.desc && <span className="pm-ws-sb-gh-desc">{group.desc}</span>}
              <hr />
            </div>
            <div className="pm-ws-sb-grid">
              {group.items.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pm-ws-sb-card${isSelected ? ' pm-ws-sb-card-selected' : ''}${item.unavailable ? ' pm-ws-sb-card-unavailable' : ''}`}
                    aria-pressed={isSelected}
                    disabled={cardsDisabled}
                    onClick={() => onSelect(isSelected ? null : item.id)}
                  >
                    {item.unavailable ? (
                      <span className="pm-ws-sb-soon">{item.unavailableLabel ?? 'Coming soon'}</span>
                    ) : (
                      <span className="pm-ws-sb-chk" aria-hidden="true">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                    <span className="pm-ws-sb-ic">
                      <Icon name={item.icon} size={16} />
                    </span>
                    <span className="pm-ws-sb-nm">{item.name}</span>
                    {item.tag && (
                      <span className="pm-ws-sb-tags">
                        <TagPill tag={item.tag} />
                        {item.metaTag && <span className="pm-ws-sb-meta-tag">{item.metaTag}</span>}
                      </span>
                    )}
                    <span className="pm-ws-sb-bl">{item.blurb}</span>
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
      <footer className="pm-ws-sb-foot">
        <div className="pm-ws-sb-sum">
          {selected ? (
            <>
              <span className="pm-ws-sb-sum-ic">
                <Icon name={selected.icon} size={15} />
              </span>
              <b>{selected.name}</b>
              {selected.tag && <TagPill tag={selected.tag} />}
              {selected.selectionNote && (
                <span className="pm-ws-sb-sum-note">{selected.selectionNote}</span>
              )}
            </>
          ) : (
            <span className="pm-ws-sb-sum-none">{emptyNote}</span>
          )}
        </div>
        <button type="button" className="pm-ws-sb-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="pm-ws-sb-launch"
          disabled={launchDisabled}
          title={launchHint}
          onClick={onLaunch}
        >
          {launchLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            className="pm-ws-sb-secondary"
            disabled={secondaryDisabled}
            title={secondaryHint}
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        )}
      </footer>
    </div>
  );
};
