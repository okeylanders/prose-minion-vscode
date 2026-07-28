/**
 * Icon assignments for the Workshop tool catalog — presentation-only, kept
 * out of the shared catalog (`@shared/constants/workshopTools`) so the host
 * never depends on webview icon names. Consumed by the rail palette and the
 * thread's turn bubbles.
 */

import { IconName } from '@components/shared/Icon';
import { WorkshopToolId } from '@messages';

export const WORKSHOP_TOOL_ICONS: Record<WorkshopToolId, IconName> = {
  dialogue: 'dialogue',
  prose: 'pen',
  gestures: 'hand',
  cliche: 'stamp',
  repetition: 'repeat',
  'decision-points': 'branch',
  'show-and-tell': 'eye',
  choreography: 'move',
  'stock-and-signature': 'target',
  placeholders: 'search',
  style: 'palette',
  editor: 'list',
  continuity: 'link',
  fresh: 'sprout',
};

/** Icon for a tool id, with a safe fallback for forward compat. */
export const workshopToolIcon = (id: WorkshopToolId): IconName =>
  WORKSHOP_TOOL_ICONS[id] ?? 'bolt';
