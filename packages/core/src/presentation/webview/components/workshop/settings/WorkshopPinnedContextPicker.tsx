/**
 * Add from project… in pin mode (Pinned Context Slice 3; Slice 0d's Picker
 * and PickerRefused boards). The shared `ProjectResourcePickerModal`, over
 * the settings dialog, with Pinned context's copy, its rows already pinned
 * disabled and marked "Pinned", and a pin footer:
 *
 * - the shared footer's ~word estimate (`estimateProjectResourceWords`)
 *   against the words pinned context has left;
 * - "Pin N files", which asks the host and keeps the picker open until it
 *   answers. A pin that lands closes the picker; a refusal shows above the
 *   footer, where the writer acted.
 *
 * Rows are named by catalog key. "Explore project folders…" asks the host
 * to open its own picker; the host introduces the path and pins it only
 * inside this project, so the webview never sends one (ADR 2026-11-04 D8).
 * It posts nothing; every host effect is a callback.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  ProjectResourcePickerModal,
  type ProjectResourcePickerCopy,
  type ProjectResourcePickerFooterState
} from '@components/fulltab/ProjectResourcePickerModal';
import { estimateProjectResourceWords } from '@components/fulltab/ProjectResourceAttachFooter';
import { workshopPinnedContextPathKey } from '@shared/types/workshopPinnedContext';
import type {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults,
  WorkshopPinnedContextPayload
} from '@messages';

const COPY: ProjectResourcePickerCopy = {
  eyebrow: 'Pin context',
  description: 'Files you pin are attached to every new conversation in this project, after the ones already pinned.',
  exploreNote: 'opens the system picker; files in this project only'
};

export interface WorkshopPinnedContextPickerProps {
  open: boolean;
  catalog: ConfiguredResourceEntry[] | null;
  searchResults: ConfiguredResourceSearchResults | null;
  /** The pinned paths: those rows are disabled and say "Pinned". */
  pinnedPaths: readonly string[];
  /** Words pinned context has left under the context limit. */
  remainingWords: number;
  /** The host's last answer (its platform names "Pinned" rows), and the changes still waiting, to tell this picker's pin. */
  answer?: WorkshopPinnedContextPayload;
  pendingRequestIds?: readonly string[];
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  /** Ask the host to pin; the id of the request, or undefined when there is no list to change. */
  onPin: (items: ConfiguredResourceRef[]) => string | undefined;
  /** Explore project folders…: the host's own picker, which pins a file inside this project. */
  onExplore: () => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopPinnedContextPicker: React.FC<WorkshopPinnedContextPickerProps> = ({
  open,
  catalog,
  searchResults,
  pinnedPaths,
  remainingWords,
  answer,
  pendingRequestIds = [],
  onSearch,
  onClearSearch,
  onPin,
  onExplore,
  onClose
}) => {
  // The host's canonical key, on the host's platform, as the shared match rule compares paths (PR #210 N01).
  const platform = answer?.platform ?? 'posix';
  const pinned = React.useMemo(
    () => new Set(pinnedPaths.map((entryPath) => workshopPinnedContextPathKey(entryPath, platform))),
    [pinnedPaths, platform]
  );
  return (
    <ProjectResourcePickerModal
      open={open}
      copy={COPY}
      closeLabel="Close the pin picker"
      catalog={catalog}
      searchResults={searchResults}
      onSearch={onSearch}
      onClearSearch={onClearSearch}
      onExplore={onExplore}
      onClose={onClose}
      selection="multiple"
      isAttached={(entry) => pinned.has(workshopPinnedContextPathKey(platform === 'windows' ? entry.path.replace(/\\/g, '/') : entry.path, platform))}
      attachedLabel="Pinned"
      onConfirm={() => undefined}
      renderFooter={(state) => (
        <PinFooter
          {...state}
          remainingWords={remainingWords}
          {...(answer ? { answer } : {})}
          pendingRequestIds={pendingRequestIds}
          onPin={onPin}
        />
      )}
    />
  );
};

interface PinFooterProps extends ProjectResourcePickerFooterState {
  remainingWords: number;
  answer?: WorkshopPinnedContextPayload;
  pendingRequestIds: readonly string[];
  onPin: (items: ConfiguredResourceRef[]) => string | undefined;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const PinFooter: React.FC<PinFooterProps> = ({ selected, close, remainingWords, answer, pendingRequestIds, onPin }) => {
  const [asked, setAsked] = React.useState<string | undefined>(undefined);
  const settled = asked !== undefined && answer?.requestId === asked;
  const waiting = asked !== undefined && pendingRequestIds.includes(asked);
  React.useEffect(() => {
    if (settled && answer?.ok) {
      close();
    }
  }, [answer, close, settled]);
  const refusal = settled && !answer?.ok
    ? answer?.notice?.kind === 'refused'
      ? answer.notice.text
      : 'Pinned context changed in another window. This is the current list; choose again.'
    : undefined;
  const estimatedWords = estimateProjectResourceWords(selected);
  const over = estimatedWords > remainingWords;
  const count = selected.length;
  return (
    <>
      {refusal ? (
        <div className="pm-ws-pin-refusal" role="alert">
          <Icon name="alert" size={13} />
          <span>{refusal}</span>
        </div>
      ) : null}
      <div className="pm-ws-ctxsel-foot">
        <span className={`pm-ws-ctxsel-total${over ? ' pm-ws-ctxsel-total-over' : ''}`}>
          {count === 0 ? 'Nothing selected' : `${count} file${count === 1 ? '' : 's'} · ~${estimatedWords.toLocaleString('en-US')} words est.`}
        </span>
        <span className="pm-ws-ctxsel-spacer" />
        {over ? (
          <span className="pm-ws-ctxsel-overmsg">
            Likely over the {remainingWords.toLocaleString('en-US')} words pinned context has left
          </span>
        ) : null}
        <button className="pm-ws-action-btn" type="button" onClick={close}>Cancel</button>
        <button
          className="pm-ws-primary-btn"
          type="button"
          disabled={count === 0 || waiting}
          aria-busy={waiting || undefined}
          onClick={() => setAsked(onPin(selected.map(({ group, path }) => ({ group, path }))))}
        >
          <Icon name="check" size={13} /> {waiting ? 'Pinning…' : `Pin ${count} file${count === 1 ? '' : 's'}`}
        </button>
      </div>
    </>
  );
};
