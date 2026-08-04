/** Executable witnesses for the Sprint 03 Workshop stylesheet split. */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const WEBVIEW_ROOT = path.resolve(__dirname, '..', '..', 'presentation', 'webview');
const WORKSHOP_APP = path.join(WEBVIEW_ROOT, 'WorkshopApp.tsx');

const WORKSHOP_STYLE_IMPORTS = [
  './styles/workshop/tokens.css',
  './styles/workshop/shell.css',
  './styles/workshop/context.css',
  './styles/workshop/session.css',
  './components/workshop/widgets/gesturePlayground/gesturePlayground.css',
  './components/workshop/widgets/lexicalGravity/lexicalGravity.css',
  './components/workshop/standingDirectiveRail.css'
] as const;

// The monolith kept one blank separator after these responsibility blocks.
// The split files use clean single-newline EOFs; the witness restores those
// separators only while reconstructing the pre-split byte stream.
const PRE_SPLIT_SEPARATOR_AFTER = new Set<string>([
  './styles/workshop/shell.css',
  './styles/workshop/context.css',
  './styles/workshop/session.css',
  './components/workshop/widgets/gesturePlayground/gesturePlayground.css',
  './components/workshop/widgets/lexicalGravity/lexicalGravity.css'
]);

const PRE_SPLIT_SHA256 = '64783db8fdfc6a0295fb94b5c7e345d79063890b334fb9f73ea88f597092db2d';

describe('Workshop stylesheet assembly', () => {
  it('preserves every pre-split byte in the declared cascade order', () => {
    const assembled = WORKSHOP_STYLE_IMPORTS.map((importPath) =>
      fs.readFileSync(path.resolve(WEBVIEW_ROOT, importPath), 'utf8')
      + (PRE_SPLIT_SEPARATOR_AFTER.has(importPath) ? '\n' : '')
    ).join('');

    expect(createHash('sha256').update(assembled).digest('hex')).toBe(PRE_SPLIT_SHA256);
  });

  it('keeps the whole Workshop cascade at its single composition point', () => {
    const source = fs.readFileSync(WORKSHOP_APP, 'utf8');
    const actualOrder = [...source.matchAll(/import ['"](.*\.css)['"];?/g)]
      .map((match) => match[1]);

    expect(actualOrder).toEqual([
      ...WORKSHOP_STYLE_IMPORTS,
      './components/workshop/schematic/schematic.css'
    ]);

    const selfImportOffenders = collectTypeScriptFiles(WEBVIEW_ROOT)
      .filter((file) => file !== WORKSHOP_APP && path.basename(file) !== 'index.tsx')
      .filter((file) => /import ['"].*\.css['"]/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(WEBVIEW_ROOT, file));
    expect(selfImportOffenders).toEqual([]);
  });
});

function collectTypeScriptFiles(directory: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTypeScriptFiles(fullPath, files);
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}
