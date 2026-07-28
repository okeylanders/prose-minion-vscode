/**
 * coerceWebviewErrorText — the ONE parser for webview_error wire traffic
 * (PR #66 review: Patricia's validate/bound, Oliver's shape unification).
 *
 * The input crosses the webview IPC boundary, so every branch here is a
 * security posture, not a convenience: shape validation gates what gets
 * logged, flattening blocks newline forgery into the output channel, and the
 * length cap bounds what a compromised webview could spray into a log sink.
 */

import {
  MessageType,
  WEBVIEW_ERROR_TEXT_MAX,
  coerceWebviewErrorText,
} from '@shared/types';

describe('coerceWebviewErrorText', () => {
  it('accepts the flat bootstrap shape', () => {
    expect(
      coerceWebviewErrorText({ type: MessageType.WEBVIEW_ERROR, message: 'bundle 404' })
    ).toBe('bundle 404');
  });

  it('accepts the envelope shape, preferring payload.message', () => {
    expect(
      coerceWebviewErrorText({
        type: MessageType.WEBVIEW_ERROR,
        source: 'webview.error_boundary',
        payload: { message: 'render blew up' },
        timestamp: 0,
      })
    ).toBe('render blew up');
  });

  it('rejects non-objects, wrong types, and shapes with no usable text', () => {
    expect(coerceWebviewErrorText(undefined)).toBeUndefined();
    expect(coerceWebviewErrorText('webview_error')).toBeUndefined();
    expect(coerceWebviewErrorText({ type: 'other_message', message: 'x' })).toBeUndefined();
    expect(coerceWebviewErrorText({ type: MessageType.WEBVIEW_ERROR })).toBeUndefined();
    expect(
      coerceWebviewErrorText({ type: MessageType.WEBVIEW_ERROR, message: 42 })
    ).toBeUndefined();
    expect(
      coerceWebviewErrorText({ type: MessageType.WEBVIEW_ERROR, message: '   ' })
    ).toBeUndefined();
  });

  it('flattens whitespace so log lines cannot be forged with embedded newlines', () => {
    expect(
      coerceWebviewErrorText({
        type: MessageType.WEBVIEW_ERROR,
        message: 'real error\n[Workshop] forged: all good\r\n\ttrailing',
      })
    ).toBe('real error [Workshop] forged: all good trailing');
  });

  it('caps unbounded text at WEBVIEW_ERROR_TEXT_MAX with a truncation marker', () => {
    const spray = 'x'.repeat(WEBVIEW_ERROR_TEXT_MAX * 3);
    const result = coerceWebviewErrorText({ type: MessageType.WEBVIEW_ERROR, message: spray });

    expect(result).toHaveLength(WEBVIEW_ERROR_TEXT_MAX + 1); // +1 for the ellipsis
    expect(result?.endsWith('…')).toBe(true);
  });
});
