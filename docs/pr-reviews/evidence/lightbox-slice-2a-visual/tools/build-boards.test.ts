/**
 * Builds the real Lightbox boards the visual harness renders (../boards/),
 * from the public-domain Alice text, through the production LightboxService
 * and measurement services with the Middle Grade standards preset.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-boards.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR (default /tmp/lightbox-2a) holding
 * fixtures/alice-chapter-<1..12>.md (from alice_chapter.py) and
 * download/alice/alice.txt. Delete the copy after. Writes boards/ there.
 */
import * as fs from 'fs';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import { StandardsService } from '@services/resources/StandardsService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { FileType } from '@/platform';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '@/__tests__/mocks/platform';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-2a';
const OUT = `${DIR}/boards`;
const EXTENSION_PATH = `${__dirname}/../..`;

it('dumps boards', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const nodeFs = createFakeFileSystem({
    readFile: async (p: string) => new Uint8Array(fs.readFileSync(p)),
    stat: async (p: string) => ({ type: FileType.File, size: fs.statSync(p).size, ctime: 0, mtime: 0 })
  } as never);
  const settings = createFakeSettings({ 'publishingStandards.preset': 'genre:mg', 'publishingStandards.pageSizeKey': '' });
  const standards = new StandardsService(EXTENSION_PATH, nodeFs, settings);
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    standards,
    { now: () => Date.UTC(2026, 9, 19, 15, 42) }
  );

  const chapterText = (number: number) => fs.readFileSync(`${DIR}/fixtures/alice-chapter-${number}.md`, 'utf8');
  const chapter = chapterText(1);
  const board = await service.buildBoard({
    kind: 'file',
    text: chapter,
    displayPath: 'Drafts/alice-chapter-1.md',
    sourceUri: 'file:///workspace/Drafts/alice-chapter-1.md',
    rereadPath: '/workspace/Drafts/alice-chapter-1.md'
  });
  fs.writeFileSync(`${OUT}/board.json`, JSON.stringify(board));

  // The whole book as one board (all twelve chapters, under the ceiling): a
  // word such as "alice" lives in far more than one inspector page of
  // paragraphs (PR #148 F-04).
  const book = await service.buildBoard({
    kind: 'file',
    text: Array.from({ length: 12 }, (_, offset) => chapterText(offset + 1)).join('\n\n'),
    displayPath: 'Drafts/alice-whole-book.md',
    sourceUri: 'file:///workspace/Drafts/alice-whole-book.md',
    rereadPath: '/workspace/Drafts/alice-whole-book.md'
  });
  fs.writeFileSync(`${OUT}/book.json`, JSON.stringify(book));

  const whole = fs.readFileSync(`${DIR}/download/alice/alice.txt`, 'utf8');
  const body = whole.slice(whole.indexOf('CHAPTER I.'), whole.indexOf('THE END'));
  const refused = await service.buildBoard({
    kind: 'file',
    text: `${body}\n\n${body}`,
    displayPath: 'Drafts/alice-twice-over.md',
    rereadPath: '/workspace/Drafts/alice-twice-over.md'
  });
  fs.writeFileSync(`${OUT}/refused.json`, JSON.stringify(refused));
  expect(board.kind).toBe('board');
  expect(book.kind).toBe('board');
  expect(refused.kind).toBe('refused');
});
