/**
 * useMessageRouter - Strategy pattern for message routing
 *
 * Provides a declarative way to route extension messages to appropriate handlers.
 * Uses the Strategy pattern to map MessageType → Handler function.
 */

import * as React from 'react';
import { MessageType, ExtensionToWebviewMessage } from '@shared/types';

/**
 * Message handler function type
 * Accepts a message and performs some action
 */
// Loosen parameter typing to accept domain-specific handlers without friction
type MessageHandler = (message: any) => void;

/**
 * Map of MessageType to handler functions
 * Allows partial implementation (not all message types required)
 */
type MessageHandlerMap = Partial<Record<MessageType, MessageHandler>>;

/**
 * Hook that sets up message routing from extension to webview
 *
 * Uses the Strategy pattern to route messages based on their type.
 * Maintains stable event listeners to avoid unnecessary re-registrations.
 *
 * @param handlers - Map of MessageType to handler functions
 *
 * @example
 * ```tsx
 * useMessageRouter({
 *   [MessageType.ANALYSIS_RESULT]: analysis.handleResult,
 *   [MessageType.METRICS_RESULT]: metrics.handleResult,
 *   [MessageType.ERROR]: (msg) => setError(msg.message),
 * });
 * ```
 */
export const useMessageRouter = (handlers: MessageHandlerMap): void => {
  // Store handlers in ref to avoid re-creating event listener on every render
  const handlersRef = React.useRef(handlers);

  // Update ref when handlers change
  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Set up message event listener (only once)
  React.useEffect(() => {
    const messageHandler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      const handler = handlersRef.current[message.type];

      if (handler) {
        handler(message);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []); // Empty deps - listener is stable, handlers via ref
};
