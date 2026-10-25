/**
 * A fingerprint of an API key, so an owner can tell which key resources were
 * built with without keeping the key (PR #171 F-01). No key and an empty key
 * are the same: neither builds a provider.
 */

import { createHash } from 'node:crypto';

export function apiKeyFingerprint(apiKey: string | undefined): string {
  return createHash('sha256').update(apiKey?.trim() ?? '').digest('hex');
}
