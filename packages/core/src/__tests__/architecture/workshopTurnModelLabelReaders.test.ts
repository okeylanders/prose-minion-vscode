/**
 * The header's model text (ADR 2026-11-03 D8 and D10, amended 2026-11-04) is
 * a rendering. Only the thread's bubble and the Markdown and HTML export
 * renderers compute it, so it can never reach a projected entry, recall, the
 * turn preview, a room frame or provider history. A new reader joins these
 * lists deliberately.
 */

import * as fs from 'fs';
import * as path from 'path';

const CORE_SRC = path.resolve(__dirname, '..', '..');

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const importers = (module: string) =>
  sourceFiles(CORE_SRC)
    .filter((file) => new RegExp(`from '[^']*/${module}'`).test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(CORE_SRC, file).split(path.sep).join('/'))
    .sort();

describe('who names a reply’s model in a header', () => {
  it('is the bubble and the export’s header helper alone', () => {
    expect(importers('workshopTurnModelLabel')).toEqual([
      'application/services/workshop/export/WorkshopTranscriptModelHeader.ts',
      'presentation/webview/components/workshop/WorkshopTurnBubble.tsx'
    ]);
  });

  it('reaches the export only through its Markdown and HTML renderers and the service', () => {
    expect(importers('WorkshopTranscriptModelHeader')).toEqual([
      'application/services/workshop/export/WorkshopTranscriptExportService.ts',
      'application/services/workshop/export/WorkshopTranscriptHtml.ts',
      'application/services/workshop/export/WorkshopTranscriptMarkdown.ts'
    ]);
  });
});
