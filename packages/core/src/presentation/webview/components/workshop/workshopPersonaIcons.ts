/** Presentation-only persona focus badges. Shared catalog stays React-free. */

import type { WorkshopPersonaId } from '@messages';
import type { IconName } from '@components/shared/Icon';

export const WORKSHOP_PERSONA_FOCUS_ICONS: Record<WorkshopPersonaId, IconName> = {
  jill: 'sparkle',
  agnes: 'sparkle',
  cliff: 'repeat',
  dev: 'dialogue',
  edna: 'target',
  felix: 'wave',
  harper: 'sprout',
  margot: 'eye',
  penny: 'book',
  quinn: 'search',
  theo: 'bolt',
  wren: 'pen'
};
