/**
 * WorkshopPersonaSchematicModal — State B of the persona browser: a roomier
 * modal presenting the read-only persona configuration schematic. Opened by a
 * card's "More info" affordance; Escape / backdrop / the in-view "Back to
 * personas" button all return to the browser (State A). See
 * docs/design/Prose Minion - Persona Schematic.html.
 */

import * as React from 'react';
import type { WorkshopPersonaId } from '@messages';
import { WorkshopModalShell } from '../WorkshopModalShell';
import { PersonaSchematicView } from './PersonaSchematicView';

const TITLE_ID = 'pm-ws-schematic-title';

interface WorkshopPersonaSchematicModalProps {
  /** The persona to show, or null when closed. */
  personaId: WorkshopPersonaId | null;
  /** Return to the persona browser (State A). */
  onBack: () => void;
}

export const WorkshopPersonaSchematicModal: React.FC<WorkshopPersonaSchematicModalProps> = ({
  personaId,
  onBack
}) => (
  <WorkshopModalShell
    open={personaId !== null}
    titleId={TITLE_ID}
    closeLabel="Back to personas"
    className="pm-ws-schematic-modal"
    onClose={onBack}
  >
    {personaId !== null && (
      <PersonaSchematicView personaId={personaId} titleId={TITLE_ID} onBack={onBack} />
    )}
  </WorkshopModalShell>
);
