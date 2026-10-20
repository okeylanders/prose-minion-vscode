/**
 * The writer's own average (Slice 4B; ADR 2026-10-19 D5): read from the
 * configured chapters (else manuscript) files, leaving out the board's own,
 * bounded by files, bytes and words, cached by size and time, and absent
 * with a host note when there is nothing to read. Deterministic: no model.
 * The chapters are synthetic sentences written for these tests.
 */
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { ContextPathGroup } from '@/shared/types/context';
import { FileType, type FileStat } from '@/platform';
import {
  LIGHTBOX_BASELINE_FILES,
  LIGHTBOX_BASELINE_FILE_BYTES,
  LIGHTBOX_BASELINE_WORDS,
  LightboxWriterBaseline
} from '@/infrastructure/lightbox/LightboxWriterBaseline';
import { LIGHTBOX_BASELINE_NOTES } from '@/infrastructure/lightbox/LightboxNumbers';

/** 10 words, one sentence, one -ly word. */
const CHAPTER = 'The cart went slowly down the lane to the mill.';

interface FakeFile {
  group: ContextPathGroup;
  path: string;
  text: string;
  mtime?: number;
  /** A size to report instead of the text's own. */
  size?: number;
}

function createBaseline(files: FakeFile[], options: { catalogFails?: boolean; unreadable?: string[] } = {}) {
  const byPath = new Map(files.map((file) => [`/w/${file.path}`, file]));
  const readFile = jest.fn(async (absolutePath: string) => {
    const file = byPath.get(absolutePath);
    if (!file || options.unreadable?.includes(file.path)) {
      throw new Error(`ENOENT ${absolutePath}`);
    }
    return new TextEncoder().encode(file.text);
  });
  const stat = jest.fn(async (absolutePath: string): Promise<FileStat> => {
    const file = byPath.get(absolutePath);
    if (!file) {
      throw new Error(`ENOENT ${absolutePath}`);
    }
    return { type: FileType.File, ctime: 0, mtime: file.mtime ?? 1, size: file.size ?? new TextEncoder().encode(file.text).length };
  });
  const entries = (): ContextResourceSummary[] => files.map((file) => ({
    group: file.group,
    path: file.path,
    label: file.path,
    sizeBytes: 0,
    absolutePath: `/w/${file.path}`,
    workspaceFolder: 'w'
  }));
  const openCatalog = jest.fn(async () => {
    if (options.catalogFails) {
      throw new Error('PRIVATE: the catalog could not be read');
    }
    return { entries };
  });
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const baseline = new LightboxWriterBaseline({ catalog: { openCatalog } as never, fileSystem: { stat, readFile }, outputChannel: log });
  return { baseline, readFile, stat, files: byPath, logged: () => log.appendLine.mock.calls.map(([line]) => String(line)).join('\n') };
}

const chapter = (path: string, sentences = 1, group: ContextPathGroup = 'chapters'): FakeFile =>
  ({ group, path, text: Array.from({ length: sentences }, () => CHAPTER).join(' ') });

describe('LightboxWriterBaseline', () => {
  it('averages the chapters group\'s text files, leaving out the board\'s own file and anything not text', async () => {
    const { baseline, readFile } = createBaseline([
      chapter('Chapters/01.md', 30),
      chapter('Chapters/02.txt', 20),
      chapter('Chapters/03.md', 50),
      { group: 'chapters', path: 'Chapters/cover.png', text: 'binary' },
      chapter('Manuscript/book.md', 400, 'manuscript')
    ]);
    const averages = await baseline.measure({ absolutePath: '/w/Chapters/03.md' });
    expect(averages.summary).toEqual({ kind: 'measured', group: 'chapters', files: 2, words: 500, capped: false });
    expect(averages.counts).toMatchObject({ words: 500, sentences: 50, dialogueWords: 0, patterns: { adverbs: 50 } });
    expect(readFile.mock.calls.map(([file]) => file).sort()).toEqual(['/w/Chapters/01.md', '/w/Chapters/02.txt']);
  });

  it('leaves out the board\'s own file named by its file URI, and falls back to the manuscript when no chapter is configured', async () => {
    const { baseline } = createBaseline([chapter('Book/one.md', 10, 'manuscript'), chapter('Book/two.md', 5, 'manuscript')]);
    const averages = await baseline.measure({ sourceUri: 'file:///w/Book/one.md' });
    expect(averages.summary).toEqual({ kind: 'measured', group: 'manuscript', files: 1, words: 50, capped: false });
  });

  it('reads at most its file bound, in path order, and says it was capped', async () => {
    const many = Array.from({ length: LIGHTBOX_BASELINE_FILES + 5 }, (_, index) => chapter(`Chapters/${String(index).padStart(3, '0')}.md`));
    const { baseline, readFile } = createBaseline(many);
    const averages = await baseline.measure();
    expect(averages.summary).toEqual({ kind: 'measured', group: 'chapters', files: LIGHTBOX_BASELINE_FILES, words: 10 * LIGHTBOX_BASELINE_FILES, capped: true });
    expect(readFile).toHaveBeenCalledTimes(LIGHTBOX_BASELINE_FILES);
    expect(readFile).not.toHaveBeenCalledWith('/w/Chapters/040.md');
  });

  it('stops once its word bound is reached, and skips a file over its byte bound without reading it', async () => {
    const big = { ...chapter('Chapters/00-big.md'), size: LIGHTBOX_BASELINE_FILE_BYTES + 1 };
    const sentencesPerFile = LIGHTBOX_BASELINE_WORDS / 10 / 2;
    const { baseline, readFile } = createBaseline([big, chapter('Chapters/01.md', sentencesPerFile), chapter('Chapters/02.md', sentencesPerFile), chapter('Chapters/03.md', 1)]);
    const averages = await baseline.measure();
    expect(averages.summary).toEqual({ kind: 'measured', group: 'chapters', files: 2, words: LIGHTBOX_BASELINE_WORDS, capped: true });
    expect(readFile.mock.calls.map(([file]) => file)).toEqual(['/w/Chapters/01.md', '/w/Chapters/02.md']);
  });

  it('says it was capped when whole files carried the words past the bound, with no file left unread (PR #155)', async () => {
    // Three files of 120,000 words: read whole, they reach 360,000 words.
    const sentences = 12_000;
    const { baseline } = createBaseline([chapter('Chapters/01.md', sentences), chapter('Chapters/02.md', sentences), chapter('Chapters/03.md', sentences)]);
    expect((await baseline.measure()).summary)
      .toEqual({ kind: 'measured', group: 'chapters', files: 3, words: 360_000, capped: true });
    // Control: exactly at the bound, with nothing left unread, is not capped.
    const half = LIGHTBOX_BASELINE_WORDS / 10 / 2;
    const { baseline: exact } = createBaseline([chapter('Chapters/01.md', half), chapter('Chapters/02.md', half)]);
    expect((await exact.measure()).summary).toMatchObject({ words: LIGHTBOX_BASELINE_WORDS, capped: false });
  });

  it('reads a file again only when its size or time changed', async () => {
    const { baseline, readFile, files } = createBaseline([chapter('Chapters/01.md', 3), chapter('Chapters/02.md', 3)]);
    await baseline.measure();
    await baseline.measure();
    expect(readFile).toHaveBeenCalledTimes(2);
    const changed = files.get('/w/Chapters/02.md') as FakeFile;
    changed.text = `${changed.text} ${CHAPTER}`;
    changed.mtime = 2;
    const averages = await baseline.measure();
    expect(readFile).toHaveBeenCalledTimes(3);
    expect(readFile).toHaveBeenLastCalledWith('/w/Chapters/02.md');
    expect(averages.summary).toMatchObject({ words: 70 });
  });

  it('is absent, with the host\'s note, when nothing is configured, nothing can be read, or the catalog fails', async () => {
    expect((await createBaseline([]).baseline.measure()).summary)
      .toEqual({ kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.noFiles });
    expect((await createBaseline([chapter('Chapters/only.md')]).baseline.measure({ absolutePath: '/w/Chapters/only.md' })).summary)
      .toEqual({ kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.noFiles });
    expect((await createBaseline([chapter('Chapters/01.md')], { unreadable: ['Chapters/01.md'] }).baseline.measure()).summary)
      .toEqual({ kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.nothingRead });
    const failing = createBaseline([chapter('Chapters/01.md')], { catalogFails: true });
    expect((await failing.baseline.measure()).summary).toEqual({ kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.unreadable });
    expect(failing.logged()).not.toContain('PRIVATE');
  });

  it('logs counts and outcomes, never a file\'s text', async () => {
    const { baseline, logged } = createBaseline([chapter('Chapters/01.md', 4), chapter('Chapters/02.md', 2)], { unreadable: ['Chapters/02.md'] });
    await baseline.measure();
    expect(logged()).toBe('[LightboxWriterBaseline] chapters: 1 file(s), 40 words, 1 skipped');
    expect(logged()).not.toContain('cart');
  });
});
