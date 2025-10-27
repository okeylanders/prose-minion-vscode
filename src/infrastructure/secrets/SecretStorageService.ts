import * as vscode from 'vscode';

/**
 * Service for managing sensitive data using VSCode's SecretStorage API.
 * Provides encrypted storage for API keys using OS-level keychains
 * (macOS Keychain, Windows Credential Manager, Linux libsecret).
 */
export class SecretStorageService {
	private static readonly API_KEY_SECRET = 'openRouterApiKey';

	constructor(private secrets: vscode.SecretStorage) {}

	/**
	 * Retrieve the OpenRouter API key from secure storage.
	 * @returns The API key if it exists, undefined otherwise
	 */
	async getApiKey(): Promise<string | undefined> {
		try {
			const key = await this.secrets.get(SecretStorageService.API_KEY_SECRET);
			return key;
		} catch (error) {
			console.error('Error retrieving API key from SecretStorage:', error);
			return undefined;
		}
	}

	/**
	 * Store the OpenRouter API key in secure storage.
	 * @param key The API key to store
	 */
	async setApiKey(key: string): Promise<void> {
		try {
			await this.secrets.store(SecretStorageService.API_KEY_SECRET, key);
		} catch (error) {
			console.error('Error storing API key in SecretStorage:', error);
			throw new Error('Failed to save API key to secure storage');
		}
	}

	/**
	 * Remove the OpenRouter API key from secure storage.
	 */
	async deleteApiKey(): Promise<void> {
		try {
			await this.secrets.delete(SecretStorageService.API_KEY_SECRET);
		} catch (error) {
			console.error('Error deleting API key from SecretStorage:', error);
			throw new Error('Failed to delete API key from secure storage');
		}
	}

	/**
	 * Register a listener for changes to secrets.
	 * @param listener Callback function to invoke when secrets change
	 * @returns Disposable to unregister the listener
	 */
	onDidChange(listener: () => void): vscode.Disposable {
		return this.secrets.onDidChange(() => {
			listener();
		});
	}
}
