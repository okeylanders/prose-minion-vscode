/**
 * VSCode Webview API Type Definitions
 *
 * Provides type-safe access to the VSCode webview API.
 */

import { MessageEnvelope } from '@messages';

/**
 * VSCode Webview API interface
 *
 * This interface provides type safety for the VSCode webview API,
 * ensuring that messages are properly typed and state management is explicit.
 */
export interface VSCodeAPI {
  /**
   * Post a message to the extension host
   * @param message - Typed message envelope
   */
  postMessage<T = any>(message: MessageEnvelope<T>): void;

  /**
   * Get the current persisted state
   * @returns The persisted state object
   */
  getState(): any;

  /**
   * Set the persisted state
   * @param state - State object to persist
   */
  setState(state: any): void;
}
