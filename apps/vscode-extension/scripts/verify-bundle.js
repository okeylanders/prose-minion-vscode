#!/usr/bin/env node
'use strict';

// Post-build witness for Tailwind delivery (PR #60 follow-up).
//
// If tailwind's config isn't resolved during the webpack build (cwd/config-path
// drift — the webview build runs from the app dir, but the config + content live
// elsewhere), tailwind falls back to its default empty-content config and PURGES
// every utility. webpack still reports "compiled successfully", the VSIX still
// packages, and the layout silently breaks (textareas lose `w-full`, etc.). No
// typecheck/test/webpack step catches that — this does. Runs at the tail of the
// production `build`, so a purged bundle fails the build (and CI) loudly.
const fs = require('fs');
const path = require('path');

const bundle = path.resolve(__dirname, '..', 'dist', 'webview.js');
if (!fs.existsSync(bundle)) {
  console.error(`[verify-bundle] missing ${bundle} — run the build first`);
  process.exit(1);
}

const js = fs.readFileSync(bundle, 'utf8');
// Sentinel utilities the webview actually depends on (AnalysisTab textareas/headers).
const required = ['.w-full', '.resize-none', '.h-32'];
const missing = required.filter((sel) => !js.includes(sel));

if (missing.length) {
  console.error(`[verify-bundle] FAIL — Tailwind utilities missing from webview.js: ${missing.join(', ')}`);
  console.error('[verify-bundle] Tailwind almost certainly purged everything (config not resolved');
  console.error('[verify-bundle] during the build). Check tailwind.config.js content + the webpack');
  console.error('[verify-bundle] postcss-loader tailwind config path.');
  process.exit(1);
}

console.log(`[verify-bundle] OK — ${required.length} sentinel Tailwind utilities present in webview.js`);
