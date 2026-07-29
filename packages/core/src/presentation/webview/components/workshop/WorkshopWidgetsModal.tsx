/**
 * WorkshopWidgetsModal — the Conversation Widgets browser, live as of
 * Sprint 01 (ADR 2026-07-22): the registry renders with honest availability —
 * only `live` widgets launch; committed sprints and concept springs stay
 * visible but disabled, so the menu is a roadmap, not a lie (design Spread 00).
 */

import * as React from 'react';
import { WorkshopWidgetId } from '@messages';
import { isLiveWorkshopWidgetId, workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import { WorkshopModalShell } from './WorkshopModalShell';
import { WorkshopSheetBrowser } from './WorkshopSheetBrowser';
import { WORKSHOP_WIDGET_GROUPS } from './workshopWidgets';

interface WorkshopWidgetsModalProps {
  open: boolean;
  onClose: () => void;
  /** Open the selected live widget's pre-commit surface. */
  onLaunchWidget: (widgetId: WorkshopWidgetId) => void;
}

export const WorkshopWidgetsModal: React.FC<WorkshopWidgetsModalProps> = ({
  open,
  onClose,
  onLaunchWidget
}) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  /* Fresh browse each open — browser selection is ephemeral by design. */
  React.useEffect(() => {
    if (open) {
      setSelectedId(null);
    }
  }, [open]);

  const selectedIsLive = isLiveWorkshopWidgetId(selectedId ?? undefined);

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-widgets-title"
      closeLabel="Close widgets"
      variant="sheet"
      className="pm-ws-browser-modal"
      onClose={onClose}
    >
      <WorkshopSheetBrowser
        titleId="pm-ws-widgets-title"
        eyebrow="Workshop · Composer"
        title="Widgets"
        sub={
          <>
            Interactive surfaces you <b>play with before anything commits</b>. Playgrounds and
            Explorers ride one turn; Influences stand until unpinned; Resources outlive the session.
          </>
        }
        emptyNote="Select a widget — the tag on each card states what opening it can cost."
        groups={WORKSHOP_WIDGET_GROUPS}
        selectedId={selectedId}
        onSelect={setSelectedId}
        launchLabel={
          selectedId === null
            ? 'Open a widget'
            : selectedIsLive
              ? `Open ${workshopWidgetLabel(selectedId as WorkshopWidgetId)}`
              : 'Not yet available'
        }
        launchDisabled={!selectedIsLive}
        launchHint={
          selectedId !== null && !selectedIsLive
            ? 'This widget ships in a later sprint — listed so the registry is honest.'
            : undefined
        }
        onLaunch={() => {
          if (selectedIsLive && selectedId !== null) {
            onLaunchWidget(selectedId as WorkshopWidgetId);
          }
        }}
        onCancel={onClose}
        closeButton={<WorkshopModalShell.CloseButton />}
      />
    </WorkshopModalShell>
  );
};
