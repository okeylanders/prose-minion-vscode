/**
 * WorkshopToolsModal — the full 14-tool palette, rebuilt on the shared
 * WorkshopSheetBrowser (2026-07-26 design drop): select a tool, then launch
 * from the locked footer. Renders from the shared catalog so the modal cannot
 * invent tools or drift from handler routing.
 *
 * Launch semantics are unchanged from the click-to-run era: `onSelect` still
 * receives the tool id exactly once, when the writer commits — WorkshopApp's
 * `selectTool` keeps deciding whether that runs directly (excerpt present) or
 * prefills an editable persona ask.
 */

import * as React from 'react';
import { WorkshopModalShell } from './WorkshopModalShell';
import {
  WorkshopSheetBrowser,
  WorkshopSheetGroup
} from './WorkshopSheetBrowser';
import { WorkshopToolId } from '@messages';
import {
  WORKSHOP_TOOL_CATALOG,
  WorkshopToolGroup,
  isWorkshopToolId,
  workshopToolLabel
} from '@shared/constants/workshopTools';
import { WORKSHOP_TOOL_ICONS } from './workshopToolIcons';

const TOOL_GROUPS: readonly WorkshopToolGroup[] = ['Primary', 'Craft & Voice', 'Technical'];

/* Group taglines from the design comp (docs/design/pm-workshop.js TOOL_GDESC).
   The comp's Primary line claims "the six the rail keeps at hand", but its own
   Primary group — and ours — holds three; the copy here stays honest instead. */
const TOOL_GROUP_DESCRIPTIONS: Record<WorkshopToolGroup, string> = {
  Primary: 'The daily passes — the ones the rail keeps at hand.',
  'Craft & Voice': 'How it sounds and how it’s built.',
  Technical: 'Mechanics, continuity, and fresh eyes.'
};

interface WorkshopToolsModalProps {
  open: boolean;
  activeToolId: WorkshopToolId | null;
  disabled?: boolean;
  requestViaPersona?: boolean;
  personaLabel?: string;
  unavailableMessage?: string;
  onClose: () => void;
  onSelect: (toolId: WorkshopToolId) => void;
}

const buildGroups = (requestViaPersona: boolean): readonly WorkshopSheetGroup[] =>
  TOOL_GROUPS.map((group) => ({
    name: group,
    desc: TOOL_GROUP_DESCRIPTIONS[group],
    items: WORKSHOP_TOOL_CATALOG.filter((tool) => tool.group === group).map((tool) => ({
      id: tool.id,
      icon: WORKSHOP_TOOL_ICONS[tool.id],
      name: tool.label,
      blurb: tool.description,
      costNote: requestViaPersona
        ? 'prefills an editable ask · nothing sends until you do'
        : 'one run on the excerpt · lands in the thread'
    }))
  }));

export const WorkshopToolsModal: React.FC<WorkshopToolsModalProps> = ({
  open,
  activeToolId,
  disabled = false,
  requestViaPersona = false,
  personaLabel = 'your host',
  unavailableMessage,
  onClose,
  onSelect
}) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(activeToolId);

  /* Re-seed the local selection from the session's active tool each time the
     sheet opens — browsing without launching must not leak state across opens. */
  React.useEffect(() => {
    if (open) {
      setSelectedId(activeToolId);
    }
  }, [open, activeToolId]);

  const verb = requestViaPersona ? 'Ask about' : 'Run';
  const selectedLabel =
    selectedId !== null && isWorkshopToolId(selectedId) ? workshopToolLabel(selectedId) : null;

  const launch = React.useCallback(() => {
    if (selectedId !== null && isWorkshopToolId(selectedId)) {
      onSelect(selectedId);
    }
  }, [onSelect, selectedId]);

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-tools-title"
      closeLabel="Close tools"
      className="pm-ws-browser-modal"
      onClose={onClose}
    >
      <WorkshopSheetBrowser
        titleId="pm-ws-tools-title"
        kicker={requestViaPersona ? `Ask ${personaLabel}` : 'Prose Excerpt Assistant'}
        title="Writing tools"
        sub={
          <>
            {requestViaPersona ? (
              <>Pick an analysis to prefill an editable ask for {personaLabel}. Nothing sends until you do.</>
            ) : (
              <>
                Each runs <b>once</b> on your excerpt with the context attachments included — the
                result lands in the thread as a visible event, in {personaLabel}&rsquo;s voice.
              </>
            )}
            {unavailableMessage && (
              <span className="pm-ws-tools-modal-notice" role="status">
                {' '}
                {unavailableMessage}
              </span>
            )}
          </>
        }
        emptyNote={
          requestViaPersona
            ? 'Select an analysis — it prefills an editable ask; nothing sends until you do.'
            : 'Select a tool — one run on the excerpt, one visible result.'
        }
        groups={buildGroups(requestViaPersona)}
        selectedId={selectedId}
        onSelect={setSelectedId}
        cardsDisabled={disabled}
        launchLabel={selectedLabel ? `${verb} ${selectedLabel}` : `${verb} a tool`}
        launchDisabled={disabled || selectedLabel === null}
        onLaunch={launch}
        onCancel={onClose}
        closeButton={<WorkshopModalShell.CloseButton />}
      />
    </WorkshopModalShell>
  );
};
