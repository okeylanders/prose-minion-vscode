import { WorkshopWidgetActionResultMessage } from '@messages';
import { WorkshopToastState } from '@components/workshop/WorkshopToast';

export interface WorkshopWidgetActionResultConsumers {
  handleGestureActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  handleLexicalActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  showToast: (toast: WorkshopToastState) => void;
}

/**
 * Preserves the Workshop action-result fan-out at one testable composition seam.
 * Each feature hook filters the shared envelope for its own actions; the shell
 * additionally owns the writer-facing acknowledgement for standing removal.
 */
export function dispatchWorkshopWidgetActionResult(
  message: WorkshopWidgetActionResultMessage,
  consumers: WorkshopWidgetActionResultConsumers
): void {
  consumers.handleGestureActionResult(message);
  consumers.handleLexicalActionResult(message);
  if (message.payload.action !== 'remove-standing') {
    return;
  }

  consumers.showToast(message.payload.ok
    ? {
        message: message.payload.removed
          ? 'Lexical Gravity removed.'
          : 'Lexical Gravity was already removed.',
        icon: message.payload.removed ? 'check' : 'info'
      }
    : {
        message: message.payload.message ?? 'Lexical Gravity could not be removed.',
        icon: 'x',
        tone: 'error'
      });
}
