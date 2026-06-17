/**
 * VSCode Webview API Type Definitions
 *
 * Provides type-safe access to the VSCode webview API.
 */

import { MessageEnvelope } from '@messages';
import { AppMessagePort } from '../ports/AppMessagePort';

/**
 * VSCode Webview API interface
 *
 * The VS Code webview's ergonomically-typed view of the platform-neutral
 * {@link AppMessagePort} (the renderer↔host seam). It `extends AppMessagePort`
 * so a `VSCodeAPI` is always a valid `AppMessagePort`, while keeping the
 * generic `postMessage<T>` + `any` get/setState that consumer code relies on.
 * The desktop renderer will provide its own `AppMessagePort` implementation;
 * core code should depend on the port, this typed view is VS-Code-specific.
 */
export interface VSCodeAPI extends AppMessagePort {
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
