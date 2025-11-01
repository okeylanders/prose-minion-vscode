import { MessageType, WebviewToExtensionMessage } from '../../shared/types/messages';

/**
 * MessageRouter implements the Strategy pattern for message routing.
 * Domain handlers register their message types and handlers, eliminating
 * the need for a central switch statement in MessageHandler.
 *
 * Benefits:
 * - Handlers own their message types (domain ownership)
 * - No central switch statement to maintain
 * - Easy to add new handlers - they register themselves
 * - Clear coupling: handler declares dependencies
 * - Open/Closed Principle: extend by adding handlers
 */
export class MessageRouter {
	private handlers = new Map<MessageType, (msg: WebviewToExtensionMessage) => Promise<void>>();

	/**
	 * Register a handler for a specific message type.
	 *
	 * @param messageType - The message type to handle
	 * @param handler - The handler function for this message type
	 * @throws Error if a handler is already registered for this message type
	 *
	 * @example
	 * router.register(MessageType.ANALYZE_DIALOGUE, this.handleAnalyzeDialogue.bind(this));
	 */
	register(messageType: MessageType, handler: (msg: any) => Promise<void>): void {
		if (this.handlers.has(messageType)) {
			throw new Error(`Duplicate handler registration for message type: ${messageType}`);
		}
		this.handlers.set(messageType, handler);
	}

	/**
	 * Route a message to its registered handler.
	 *
	 * @param message - The message to route
	 * @throws Error if no handler is registered for this message type
	 *
	 * @example
	 * await router.route(message);
	 */
	async route(message: WebviewToExtensionMessage): Promise<void> {
		const handler = this.handlers.get(message.type);

		if (!handler) {
			throw new Error(
				`No handler registered for message type: ${message.type}. ` +
				`Registered types: ${Array.from(this.handlers.keys()).join(', ')}`
			);
		}

		await handler(message);
	}

	/**
	 * Get the number of registered handlers (for testing/debugging).
	 */
	get handlerCount(): number {
		return this.handlers.size;
	}

	/**
	 * Check if a handler is registered for a message type (for testing/debugging).
	 */
	hasHandler(messageType: MessageType): boolean {
		return this.handlers.has(messageType);
	}

	/**
	 * Get all registered message types (for testing/debugging).
	 */
	getRegisteredTypes(): MessageType[] {
		return Array.from(this.handlers.keys());
	}
}
