/**
 * Guard: the notice screenshot carrying a redaction must stay redacted.
 *
 * `vscode-open-folder.png` was captured against a live project, so its VS Code
 * title bar held an unpublished manuscript's working title (PR #94 review,
 * Patricia). That band is now destructively obscured — mosaic then blur — in
 * BOTH committed copies: the one shipped in the `.vsix` and the design-snapshot
 * copy under `docs/design/uploads/`.
 *
 * This is a fence, not decoration. `docs/design/README.md` invites a re-pull of
 * the design project the moment its copy catches up, and the REMOTE project
 * still holds the unredacted original — so the single most likely future edit to
 * this file is one that silently restores the title. A prose warning does not
 * survive that; a red test does.
 *
 * If you legitimately re-shoot or re-redact this screenshot: re-apply the
 * redaction, confirm the title is unreadable at full resolution, then update the
 * digest below in the same commit. Both copies must always agree.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

const SHIPPED = path.join(
  REPO_ROOT,
  'apps/vscode-extension/assets/workshop-notices/vscode-open-folder.png'
);
const DESIGN_SNAPSHOT = path.join(
  REPO_ROOT,
  'docs/design/uploads/Screenshot 2026-07-27 at 12.06.02 PM.png'
);

/** SHA-256 of the redacted screenshot. Update deliberately, never casually. */
const REDACTED_DIGEST = '1cecf8be357cf588278296355ed5e6cbffe86f1731b50f8908ebb48fde3be8f5';

const sha256 = (file: string): string =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('notice screenshot redaction', () => {
  it('ships the redacted screenshot, not the original capture', () => {
    expect(sha256(SHIPPED)).toBe(REDACTED_DIGEST);
  });

  it('keeps the design snapshot copy redacted too — a re-pull must not undo it', () => {
    /* The comp renders this file from docs/design/uploads/, and that folder is
       just as public as the .vsix. Redacting only the shipped copy would leave
       the title one directory away. */
    expect(sha256(DESIGN_SNAPSHOT)).toBe(REDACTED_DIGEST);
  });
});
