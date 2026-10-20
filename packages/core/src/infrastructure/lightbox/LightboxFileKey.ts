/**
 * The Lightbox's opaque file identity (PR #154 F-02): what lets the webview
 * tell that a project-picker row is the very file on the context shelf
 * without the host posting where either file lives.
 *
 * A display path is not an identity. It omits the workspace folder, so two
 * roots that each hold `Notes/cast.md` show the same text. The shelf
 * dedupes by the absolute path it read (`LightboxContextShelf.sourceKey`),
 * and this key is that same string, keyed with a secret drawn once for the
 * extension session: equal for the same file whichever door added it,
 * unequal for different files, stable while the session lasts, and of no
 * use for recovering the path or for guessing whether a path is on the
 * shelf. The catalog's rows and the shelf's files carry it; the webview only
 * compares keys, and a choice still names a catalog key, never this.
 */

import { createHmac, randomBytes } from 'node:crypto';

/** Drawn once per extension session; never posted or logged. */
const SESSION_SECRET = randomBytes(32);

/** 128 bits of the digest: ample to keep distinct files apart. */
const KEY_HEX_LENGTH = 32;

/** The key for the file the shelf would know by `absolutePath`. */
export function lightboxFileKey(absolutePath: string): string {
  return createHmac('sha256', SESSION_SECRET).update(absolutePath, 'utf8').digest('hex').slice(0, KEY_HEX_LENGTH);
}
