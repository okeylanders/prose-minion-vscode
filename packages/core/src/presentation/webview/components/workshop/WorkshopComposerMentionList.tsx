/**
 * The `@` file list above the Workshop composer (Everyday Conveniences round
 * two, item G). A listbox the composer's textarea controls: the textarea
 * keeps focus and names the active option (`aria-activedescendant`), so this
 * component never takes focus and handles no key.
 *
 * Sectioned (decision A2): Files now, so People can join later. Each file
 * row says its name, the token a pick writes, its group and its size. The
 * last option, Browse project…, opens the project picker for this message.
 *
 * The status line is always mounted, so a screen reader hears the count
 * ("6 files") when the list opens and as typing narrows it.
 *
 * Presentation only: state comes from `useWorkshopComposerMentions`, and a
 * pick is a callback.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { PROJECT_RESOURCE_GROUP_LABELS } from '@components/fulltab/ProjectResourcePickerModal';
import type { WorkshopComposerMentionsState } from '@hooks/domain/workshop/controllers/useWorkshopComposerMentions';
import { workshopMentionKey, workshopMentionSize } from '@utils/workshop/workshopComposerMentions';

/** The DOM id of one option, which the textarea's `aria-activedescendant` names. */
export const workshopMentionOptionId = (listId: string, index: number): string => `${listId}-option-${index}`;

interface WorkshopComposerMentionListProps {
  /** The listbox's id, which the textarea's `aria-controls` names. */
  listId: string;
  mentions: WorkshopComposerMentionsState;
  onPick: (index: number) => void;
  onActivate: (index: number) => void;
}

/** A press on the list must not take focus from the textarea. */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

export const WorkshopComposerMentionList: React.FC<WorkshopComposerMentionListProps> = ({
  listId,
  mentions,
  onPick,
  onActivate
}) => {
  const { open, loading, query, sections, browseIndex, activeIndex } = mentions;
  const listRef = React.useRef<HTMLDivElement>(null);

  const revealActiveOption = React.useCallback(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    const option = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    option?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);
  React.useEffect(revealActiveOption, [revealActiveOption]);

  const option = (index: number) => ({
    id: workshopMentionOptionId(listId, index),
    role: 'option' as const,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- an ARIA attribute name.
    'aria-selected': index === activeIndex,
    onMouseDown: keepFocus,
    onMouseEnter: () => onActivate(index),
    onClick: () => onPick(index)
  });

  return (
    <>
      <span className="pm-ws-visually-hidden" role="status">{mentions.status}</span>
      {open && (
        <div
          ref={listRef}
          id={listId}
          className="pm-ws-mention"
          role="listbox"
          aria-label="Attach a project file to this message"
        >
          {sections.map((section) => {
            const headingId = `${listId}-${section.id}`;
            return (
              <div key={section.id} className="pm-ws-mention-section" role="group" aria-labelledby={headingId}>
                <div id={headingId} className="pm-ws-mention-heading">{section.label}</div>
                {section.rows.map((row, index) => (
                  <div
                    key={workshopMentionKey(row.entry)}
                    className="pm-ws-mention-option"
                    title={row.entry.path}
                    {...option(index)}
                  >
                    <Icon name="doc" size={12} />
                    <span className="pm-ws-mention-name">{row.entry.label}</span>
                    <span className="pm-ws-mention-token">@{row.token}</span>
                    <span className="pm-ws-mention-group">{PROJECT_RESOURCE_GROUP_LABELS[row.entry.group]}</span>
                    <span className="pm-ws-mention-size">
                      {row.staged ? 'attached' : workshopMentionSize(row.entry.sizeBytes)}
                    </span>
                  </div>
                ))}
                {loading && <div className="pm-ws-mention-note">Loading project files…</div>}
                {!loading && section.rows.length === 0 && (
                  <div className="pm-ws-mention-note">
                    {query.length > 0 ? 'No configured file matches.' : 'No project files are configured yet.'}
                  </div>
                )}
                {section.more > 0 && (
                  <div className="pm-ws-mention-note">
                    {section.more.toLocaleString('en-US')} more. Keep typing to narrow the list.
                  </div>
                )}
              </div>
            );
          })}
          <div className="pm-ws-mention-option pm-ws-mention-browse" {...option(browseIndex)}>
            <Icon name="plus" size={12} />
            <span className="pm-ws-mention-name">Browse project…</span>
          </div>
        </div>
      )}
    </>
  );
};
