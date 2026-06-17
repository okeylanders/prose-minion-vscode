#!/usr/bin/env node
'use strict';

// Reset dist/ before each production build so stale artifacts (e.g. source maps
// from a prior devtool config) don't linger — PM had no clean step pre-monorepo,
// which let old *.map files accumulate (surfaced during the PR #60 fixups).
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
console.log(`[clean-dist] reset ${dist}`);
