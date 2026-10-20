/**
 * LightboxProjectPicker — the shared project picker in the Lightbox's words
 * (2026-10-20). Props-only: the picker is the Workshop's "Choose from
 * project" (`ProjectResourcePickerModal`), and this gives it the Lightbox's
 * copy and callbacks. As a source it picks one file, which the host boards;
 * its "Explore project folders…" is the source panel's system picker.
 */
import * as React from 'react';
import type {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  ProjectResourcePickerCopy,
  ProjectResourcePickerModal
} from '@components/fulltab/ProjectResourcePickerModal';
import type { LightboxProjectPicker as LightboxProjectPickerPurpose } from '@hooks/domain/useLightboxProjectFiles';

const SOURCE_COPY: ProjectResourcePickerCopy = {
  eyebrow: 'Board a source',
  description: `Pick one Markdown or plain-text file, up to ${PROMPT_BUDGETS.lightbox.sourceWords.toLocaleString('en-US')} words. ` +
    'It is counted at once and costs nothing: no model is asked.',
  exploreNote: 'opens the system picker; the same limits apply'
};

export interface LightboxProjectPickerProps {
  /** The picker on screen, if any. */
  picker: LightboxProjectPickerPurpose | null;
  catalog: ConfiguredResourceEntry[] | null;
  catalogUnreadable: boolean;
  searchResults: ConfiguredResourceSearchResults | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  /** Board the picked file. */
  onChooseSource: (item: ConfiguredResourceRef) => void;
  /** The source panel's system picker. */
  onExploreSource: () => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxProjectPicker: React.FC<LightboxProjectPickerProps> = ({
  picker,
  catalog,
  catalogUnreadable,
  searchResults,
  onSearch,
  onClearSearch,
  onChooseSource,
  onExploreSource,
  onClose
}) => (
  <ProjectResourcePickerModal
    open={picker === 'source'}
    selection="single"
    copy={SOURCE_COPY}
    closeLabel="Close project picker"
    pickHint="Click a file to board it"
    catalog={catalog}
    catalogUnreadable={catalogUnreadable}
    searchResults={searchResults}
    onSearch={onSearch}
    onClearSearch={onClearSearch}
    onPick={onChooseSource}
    onExplore={onExploreSource}
    onClose={onClose}
  />
);
