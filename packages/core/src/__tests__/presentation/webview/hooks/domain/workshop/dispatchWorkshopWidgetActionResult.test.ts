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
    const handleLexicalActionResult = jest.fn();
    const showToast = jest.fn();

    dispatchWorkshopWidgetActionResult(message, {
      handleGestureActionResult,
      handleLexicalActionResult,
      showToast
    });

    return { message, handleGestureActionResult, handleLexicalActionResult, showToast };
  };

  it('fans non-removal results out to both feature hooks without a shell toast', () => {
    const result = dispatch({
      action: 'commit',
      widgetId: 'gesture-playground',
      ok: true
    });

    expect(result.handleGestureActionResult).toHaveBeenCalledWith(result.message);
    expect(result.handleLexicalActionResult).toHaveBeenCalledWith(result.message);
    expect(result.showToast).not.toHaveBeenCalled();
  });

  it('acknowledges a standing directive that was removed', () => {
    const {
      message,
      handleGestureActionResult,
      handleLexicalActionResult,
      showToast
    } = dispatch({
      action: 'remove-standing',
      widgetId: 'lexical-gravity',
      ok: true,
      removed: true
    });

    expect(handleGestureActionResult).toHaveBeenCalledWith(message);
    expect(handleLexicalActionResult).toHaveBeenCalledWith(message);
    expect(showToast).toHaveBeenCalledWith({
      message: 'Lexical Gravity removed.',
      icon: 'check'
    });
  });

  it('reports that an already-absent standing directive needed no removal', () => {
    const { showToast } = dispatch({
      action: 'remove-standing',
      widgetId: 'lexical-gravity',
      ok: true,
      removed: false
    });

    expect(showToast).toHaveBeenCalledWith({
      message: 'Lexical Gravity was already removed.',
      icon: 'info'
    });
  });

  it('shows the host error when standing removal fails', () => {
    const { showToast } = dispatch({
      action: 'remove-standing',
      widgetId: 'lexical-gravity',
      ok: false,
      message: 'The session is unavailable.'
    });

    expect(showToast).toHaveBeenCalledWith({
      message: 'The session is unavailable.',
      icon: 'x',
      tone: 'error'
    });
  });

  it('uses a stable fallback when a removal failure has no host message', () => {
    const { showToast } = dispatch({
      action: 'remove-standing',
      widgetId: 'lexical-gravity',
      ok: false
    });

    expect(showToast).toHaveBeenCalledWith({
      message: 'Lexical Gravity could not be removed.',
      icon: 'x',
      tone: 'error'
    });
  });
});
