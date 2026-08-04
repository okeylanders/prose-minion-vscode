import { dispatchWorkshopWidgetActionResult } from '@hooks/domain/workshop/dispatchWorkshopWidgetActionResult';
import { MessageType, WorkshopWidgetActionResultMessage } from '@messages';

describe('dispatchWorkshopWidgetActionResult', () => {
  it('fans one standing-removal result out to both feature hooks and the shell toast', () => {
    const message: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload: {
        action: 'remove-standing',
        widgetId: 'lexical-gravity',
        ok: true,
        removed: true
      }
    };
    const handleGestureActionResult = jest.fn();
    const handleLexicalActionResult = jest.fn();
    const showToast = jest.fn();

    dispatchWorkshopWidgetActionResult(message, {
      handleGestureActionResult,
      handleLexicalActionResult,
      showToast
    });

    expect(handleGestureActionResult).toHaveBeenCalledWith(message);
    expect(handleLexicalActionResult).toHaveBeenCalledWith(message);
    expect(showToast).toHaveBeenCalledWith({
      message: 'Lexical Gravity removed.',
      icon: 'check'
    });
  });
});
