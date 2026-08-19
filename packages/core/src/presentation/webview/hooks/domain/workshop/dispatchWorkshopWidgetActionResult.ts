import { WorkshopWidgetActionResultMessage } from '@messages';

export interface WorkshopWidgetActionResultConsumers {
  handleGestureActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  handleCreativeVariationsActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  handleLexicalActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  handleStandingDirectiveActionResult: (message: WorkshopWidgetActionResultMessage) => void;
}

/**
 * Preserves the Workshop action-result fan-out at one testable composition seam.
 * Each owner filters the shared envelope for its exact action, widget, and
 * request token. The dispatcher owns fan-out only; it contains no feature copy.
 */
export function dispatchWorkshopWidgetActionResult(
  message: WorkshopWidgetActionResultMessage,
  consumers: WorkshopWidgetActionResultConsumers
): void {
  consumers.handleGestureActionResult(message);
  consumers.handleCreativeVariationsActionResult(message);
  consumers.handleLexicalActionResult(message);
  consumers.handleStandingDirectiveActionResult(message);
}
