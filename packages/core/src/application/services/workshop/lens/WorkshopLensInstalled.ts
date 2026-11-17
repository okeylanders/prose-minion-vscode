/**
 * Which lens the room has installed, by slug alone (ADR 2026-11-17 D17).
 * The room's Lexical Gravity standing directive names a widget config, and
 * the config names its lens. Only the slug leaves here: never the
 * directive's frame, the draft or the resolved lens.
 */

import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopLensInstalledPort } from '@/application/services/workshop/lens/WorkshopLensCapability';

/** The session's part; satisfied by WorkshopSessionService. */
export type WorkshopLensInstalledSessionPort = Pick<WorkshopSessionService, 'getStandingDirective' | 'getWidgetConfig'>;

export function workshopInstalledLensOf(session: WorkshopLensInstalledSessionPort): WorkshopLensInstalledPort {
  return {
    installedLensSlug: () => {
      const directive = session.getStandingDirective('lexical-gravity');
      const config = directive ? session.getWidgetConfig(directive.widgetConfigId) : undefined;
      return config?.widgetId === 'lexical-gravity' ? config.draft.lensSlug : undefined;
    }
  };
}
