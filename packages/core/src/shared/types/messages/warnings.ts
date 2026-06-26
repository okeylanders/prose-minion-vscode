/**
 * Cross-domain warning sentinels.
 */

/**
 * Sentinel heading for the "no API key" onboarding warning that AI services
 * return in place of a real result when no OpenRouter key is configured.
 *
 * This is shared, not duplicated: backend services prefix their warning copy
 * with it, and the webview uses it to recognize config guidance so it never
 * persists/redisplays that transient text as if it were saved tool output.
 */
export const API_KEY_NOT_CONFIGURED_HEADING = '⚠️ OpenRouter API key not configured';

export const isApiKeyNotConfiguredWarning = (text: string | undefined): boolean =>
  !!text && text.startsWith(API_KEY_NOT_CONFIGURED_HEADING);
