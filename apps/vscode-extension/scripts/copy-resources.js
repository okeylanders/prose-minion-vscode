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

if (!fs.existsSync(SRC)) {
  console.error(`[copy-resources] source not found: ${SRC}`);
  process.exit(1);
}

// Clean the staged copy first so files removed from core don't linger in the VSIX.
fs.rmSync(DEST, { recursive: true, force: true });

// fs.cpSync (Node 16.7+) copies the whole tree including symlinked entries —
// which the prior hand-rolled isDirectory()/isFile() walk silently dropped
// (PR #60 review #4). `dereference: true` materializes any symlinked resource as
// a real file so it actually lands in the VSIX (the runtime reads bytes off disk).
fs.cpSync(SRC, DEST, { recursive: true, dereference: true });
console.log(`[copy-resources] staged ${SRC} -> ${DEST}`);
