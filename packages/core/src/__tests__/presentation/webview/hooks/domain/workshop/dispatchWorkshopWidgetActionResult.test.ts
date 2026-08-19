import { dispatchWorkshopWidgetActionResult } from '@hooks/domain/workshop/dispatchWorkshopWidgetActionResult';
import { MessageType, WorkshopWidgetActionResultMessage } from '@messages';

describe('dispatchWorkshopWidgetActionResult', () => {
  const dispatch = (payload: WorkshopWidgetActionResultMessage['payload']) => {
    const message: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload
    };
    const handleGestureActionResult = jest.fn();
    const handleCreativeVariationsActionResult = jest.fn();
    const handleLexicalActionResult = jest.fn();
    const handleStandingDirectiveActionResult = jest.fn();

    dispatchWorkshopWidgetActionResult(message, {
      handleGestureActionResult,
      handleCreativeVariationsActionResult,
      handleLexicalActionResult,
      handleStandingDirectiveActionResult
    });

    return {
      message,
      handleGestureActionResult,
      handleCreativeVariationsActionResult,
      handleLexicalActionResult,
      handleStandingDirectiveActionResult
    };
  };

  it('fans shared results out to both features and the generic standing owner', () => {
    const result = dispatch({
      action: 'commit',
      requestToken: 'commit-1',
      widgetId: 'gesture-playground',
      ok: true
    });

    expect(result.handleGestureActionResult).toHaveBeenCalledWith(result.message);
    expect(result.handleCreativeVariationsActionResult).toHaveBeenCalledWith(result.message);
    expect(result.handleLexicalActionResult).toHaveBeenCalledWith(result.message);
    expect(result.handleStandingDirectiveActionResult).toHaveBeenCalledWith(result.message);
  });
});
