/**
 * WorkshopWidgetsModal — the Conversation Widgets browser as a Sprint 14
 * PREVIEW: the full registry is browsable on the shared sheet, but nothing
 * opens. The primary action always reads "Coming soon" and stays disabled —
 * the Widgets epic that follows the Workshop release makes these cards live.
 */

import * as React from 'react';
import { WorkshopModalShell } from './WorkshopModalShell';
import { WorkshopSheetBrowser } from './WorkshopSheetBrowser';
import { WORKSHOP_WIDGET_GROUPS } from './workshopWidgets';

interface WorkshopWidgetsModalProps {
  open: boolean;
  onClose: () => void;
}

export const WorkshopWidgetsModal: React.FC<WorkshopWidgetsModalProps> = ({ open, onClose }) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  /* Fresh browse each open — preview selection is ephemeral by design. */
  React.useEffect(() => {
    if (open) {
      setSelectedId(null);
    }
  }, [open]);

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-widgets-title"
      closeLabel="Close widgets"
      className="pm-ws-browser-modal"
      onClose={onClose}
    >
      <WorkshopSheetBrowser
        titleId="pm-ws-widgets-title"
        kicker="Workshop · Composer"
        title="Widgets"
        sub={
          <>
            <b>A preview of what&rsquo;s coming soon.</b> Playgrounds and Explorers ride one turn;
            Influences stand until unpinned; Resources outlive the session.
          </>
        }
        emptyNote="Select a widget — the tag on each card states what opening it will cost."
        groups={WORKSHOP_WIDGET_GROUPS}
        selectedId={selectedId}
        onSelect={setSelectedId}
        launchLabel="Coming soon"
        launchDisabled
        launchHint="Widgets ship in the next release — browsable now so you can see what's ahead."
        onLaunch={() => undefined}
        onCancel={onClose}
        closeButton={<WorkshopModalShell.CloseButton />}
      />
    </WorkshopModalShell>
  );
};
