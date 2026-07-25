import { WorkshopToolId, WorkshopTurn } from '@messages';
import { workshopToolLabel } from '@shared/constants/workshopTools';

/**
 * Editable writer copy for the composer-only open-room tool door. A "last
 * suggestion" claim is made only when the actual semantic tail is a persona
 * reply; tool evidence or writer prose at the tail produces neutral copy.
 */
export function buildWorkshopToolAskPrefill(
  toolId: WorkshopToolId,
  hostLabel: string,
  turns: readonly WorkshopTurn[]
): string {
  const toolLabel = workshopToolLabel(toolId);
  const tail = [...turns].reverse().find((turn) => turn.participant !== 'session');
  return tail?.role === 'assistant' && tail.personaId
    ? `Hey ${hostLabel}! Run ${toolLabel} on your last suggestion and let's see what it finds.`
    : `Hey ${hostLabel}! Run ${toolLabel} and tell me what it finds.`;
}
