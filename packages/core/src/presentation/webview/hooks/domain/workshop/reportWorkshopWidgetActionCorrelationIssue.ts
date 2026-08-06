/** Visible diagnostic trail for rejected Workshop widget acknowledgements. */

import { WorkshopWidgetActionResultMessage } from '@messages';

export function reportWorkshopWidgetActionCorrelationIssue(
  owner: string,
  message: WorkshopWidgetActionResultMessage,
  reason: string
): void {
  console.warn(
    `[${owner}] Ignored ${message.payload.action} acknowledgement: ${reason}`,
    {
      requestToken: message.payload.requestToken,
      widgetId: message.payload.widgetId
    }
  );
}
