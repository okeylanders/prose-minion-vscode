/**
 * Stage packages/core/resources -> apps/vscode-extension/resources for the VSIX (D22).
 *
 * Core owns the resource source of truth (prompts/craft-guides/repository/
 * standalone-prompts) so both the extension and the future desktop app share one
 * canonical copy. `vsce package --no-dependencies` runs in this app dir and does
 * NOT traverse the @prose-minion/core workspace dep, so the resources must be
 * physically present under the app at package time. Resources are read from disk
 * at runtime via the FileSystem port (extensionPath/resources/...), never bundled
 * into JS — so a copy, not a webpack step, keeps the runtime path behavior-identical.
 *
 * The staged ./resources dir is gitignored (build artifact); the source of truth
 * is packages/core/resources. Runs in `build`/`watch`/`package` (via prepublish).
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', '..', 'packages', 'core', 'resources');
const DEST = path.resolve(__dirname, '..', 'resources');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`[copy-resources] source not found: ${SRC}`);
  process.exit(1);
}

// Clean the staged copy first so files removed from core don't linger in the VSIX.
fs.rmSync(DEST, { recursive: true, force: true });
copyDir(SRC, DEST);
console.log(`[copy-resources] staged ${SRC} -> ${DEST}`);
