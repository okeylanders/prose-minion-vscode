/**
 * LightboxProjectPicker — the shared project picker in the Lightbox's words
 * (2026-10-20). Props-only: the picker is the Workshop's "Choose from
 * project" (`ProjectResourcePickerModal`), and this gives it the Lightbox's
 * copy and callbacks for its two uses.
 *
 * - **Source** (the source panel, the board's welcome): one file, which the
 *   host boards. "Explore project folders…" is the source's system picker.
 * - **Context** (the context list): several files, as the Workshop attaches
 *   context, with the files already on the shelf shown attached and the
 *   Workshop's running ~estimate against the words the shelf has left. A row
 *   is attached when its host-keyed `fileKey` is a shelf file's, never by
 *   its display path, which two workspace folders can share (PR #154 F-02).
 *   "Explore project folders…" is the context list's system picker. The host
 *   applies the shelf's real limits and names anything it refuses.
 */
import * as React from 'react';
import type {
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults,
  LightboxContextFile,
  LightboxProjectCatalogEntry
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  ProjectResourcePickerCopy,
  ProjectResourcePickerFooterState,
  ProjectResourcePickerModal,
  projectResourceKey
} from '@components/fulltab/ProjectResourcePickerModal';
import { ProjectResourceAttachFooter } from '@components/fulltab/ProjectResourceAttachFooter';
import type { LightboxProjectPicker as LightboxProjectPickerPurpose } from '@hooks/domain/useLightboxProjectFiles';

const SOURCE_COPY: ProjectResourcePickerCopy = {
  eyebrow: 'Board a source',
  description: `Pick one Markdown or plain-text file, up to ${PROMPT_BUDGETS.lightbox.sourceWords.toLocaleString('en-US')} words. ` +
    'It is counted at once and costs nothing: no model is asked.',
  exploreNote: 'opens the system picker; the same limits apply'
};

const CONTEXT_COPY: ProjectResourcePickerCopy = {
  eyebrow: 'Add context',
  description: 'Files that inform the readings, such as who someone is. They are never evidence: only the chapter is quoted.',
  exploreNote: 'opens the system picker; budget checked on add'
};

export interface LightboxProjectPickerProps {
  /** The picker on screen, if any. */
  picker: LightboxProjectPickerPurpose | null;
  catalog: LightboxProjectCatalogEntry[] | null;
  catalogUnreadable: boolean;
  searchResults: ConfiguredResourceSearchResults | null;
  /** The context shelf as the host last sent it. */
  context: { files: LightboxContextFile[]; totalWords: number; ceilingWords: number };
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  /** Board the picked file. */
  onChooseSource: (item: ConfiguredResourceRef) => void;
  /** The source panel's system picker. */
  onExploreSource: () => void;
  /** Add the picked files to the context. */
  onAddContext: (items: ConfiguredResourceRef[]) => void;
  /** The context list's system picker. */
  onExploreContext: () => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxProjectPicker: React.FC<LightboxProjectPickerProps> = ({
  picker,
  catalog,
  catalogUnreadable,
  searchResults,
  context,
  onSearch,
  onClearSearch,
  onChooseSource,
  onExploreSource,
  onAddContext,
  onExploreContext,
  onClose
}) => {
  const shared = {
    open: picker !== null,
    closeLabel: 'Close project picker',
    catalog,
    catalogUnreadable,
    searchResults,
    onSearch,
    onClearSearch,
    onClose
  };
  if (picker === 'context') {
    // The same file on disk carries the same host key in the catalog and on the shelf.
    const onShelf = new Set(context.files.map((file) => file.fileKey));
    const fileKeyOf = new Map((catalog ?? []).map((entry) => [projectResourceKey(entry), entry.fileKey]));
    const isAttached = (entry: ConfiguredResourceRef) => {
      const fileKey = fileKeyOf.get(projectResourceKey(entry));
      return fileKey !== undefined && onShelf.has(fileKey);
    };
    const ceiling = context.ceilingWords > 0 ? context.ceilingWords : PROMPT_BUDGETS.contextFiles.words;
    const remainingWords = Math.max(0, ceiling - context.totalWords);
    return (
      <ProjectResourcePickerModal
        {...shared}
        selection="multiple"
        copy={CONTEXT_COPY}
        isAttached={isAttached}
        onConfirm={onAddContext}
        onExplore={onExploreContext}
        renderFooter={(state: ProjectResourcePickerFooterState) => (
          <ProjectResourceAttachFooter {...state} remainingWords={remainingWords} />
        )}
      />
    );
  }
  return (
    <ProjectResourcePickerModal
      {...shared}
      selection="single"
      copy={SOURCE_COPY}
      pickHint="Click a file to board it"
      onPick={onChooseSource}
      onExplore={onExploreSource}
    />
  );
};
