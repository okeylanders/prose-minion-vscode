/**
 * The names-only folder scan (ADR 2026-11-19 D20): hidden folders,
 * `node_modules`, build output, `prose-minion/` and links skipped; each
 * bound reached and said; names only, never contents; counts-only logs.
 * *Alice*.
 */
import { ProjectFolderScan } from '@/application/services/contextPaths/ProjectFolderScan';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { aliceProject, ALICE_NAMES } from './aliceProject';

const ROOT = '/alice';

function scanOf(files: readonly string[], options: { links?: string[]; bounds?: Partial<typeof PROMPT_BUDGETS.contextPaths> } = {}) {
  const project = aliceProject({ roots: { [ROOT]: files }, links: options.links });
  const readFile = jest.spyOn(project.fileSystem, 'readFile');
  const scan = new ProjectFolderScan(project.fileSystem, project.workspace, project.log, { ...PROMPT_BUDGETS.contextPaths, ...options.bounds });
  return { project, scan, readFile };
}

describe('ProjectFolderScan', () => {
  it('keeps folders holding Markdown or text files, breadth first, with counts and a few names', async () => {
    const { scan, readFile } = scanOf([
      'synopsis.md',
      'Cast/Alice.md',
      'Cast/Cheshire Cat.md',
      'Cast/Mad Hatter.md',
      'Cast/Queen of Hearts.md',
      'Cast/portrait.png',
      'Book 1/Chapters/01 Down the Rabbit-Hole.md',
      'Notes/lore.md',
      'Notes/timeline.txt',
      'Empty/picture.png'
    ]);
    const result = await scan.scan();
    expect(result?.stopped).toEqual([]);
    expect(result?.folders).toEqual([
      { path: '.', markdownFiles: 1, textFiles: 0, sampleNames: ['synopsis.md'] },
      { path: 'Book 1', markdownFiles: 0, textFiles: 0, sampleNames: [] },
      { path: 'Cast', markdownFiles: 4, textFiles: 0, sampleNames: ['Alice.md', 'Cheshire Cat.md', 'Mad Hatter.md'] },
      { path: 'Notes', markdownFiles: 1, textFiles: 1, sampleNames: ['lore.md', 'timeline.txt'] },
      { path: 'Book 1/Chapters', markdownFiles: 1, textFiles: 0, sampleNames: ['01 Down the Rabbit-Hole.md'] }
    ]);
    // Names only: no file was ever opened.
    expect(readFile).not.toHaveBeenCalled();
  });

  it('skips hidden folders, node_modules, build output, prose-minion and symbolic links', async () => {
    const { scan } = scanOf([
      '.obsidian/Alice.md',
      'node_modules/pkg/readme.md',
      'dist/Alice.md',
      'out/Alice.md',
      'build/Alice.md',
      'prose-minion/memory/Alice.md',
      'Mirror/Alice.md',
      'Cast/Alice.md',
      '.secret.md'
    ], { links: ['Mirror'] });
    const result = await scan.scan();
    expect(result?.folders.map((folder) => folder.path)).toEqual(['.', 'Cast']);
    expect(result?.folders[0]).toEqual({ path: '.', markdownFiles: 0, textFiles: 0, sampleNames: [] });
  });

  it('stops at its depth and says so', async () => {
    const { scan } = scanOf(['Cast/Royals/Hearts/Queen.md', 'Cast/Alice.md'], { bounds: { scanDepth: 2 } });
    const result = await scan.scan();
    expect(result?.folders.map((folder) => folder.path)).toEqual(['.', 'Cast']);
    expect(result?.stopped).toEqual(['depth']);
  });

  it('stops at its entries read and says so', async () => {
    const { scan } = scanOf(['Cast/Alice.md', 'Cast/Hatter.md', 'Wonderland/Rabbit Hole.md'], { bounds: { scanEntries: 3 } });
    const result = await scan.scan();
    expect(result?.entriesRead).toBe(3);
    expect(result?.stopped).toEqual(['entries']);
  });

  it('keeps at most its folders, leaving the deepest out, and says so', async () => {
    const { scan } = scanOf(['A/x.md', 'B/x.md', 'C/x.md', 'A/D/x.md'], { bounds: { scanFolders: 3 } });
    const result = await scan.scan();
    expect(result?.folders.map((folder) => folder.path)).toEqual(['.', 'A', 'B']);
    expect(result?.stopped).toEqual(['folders']);
  });

  it('cuts a sample name to its characters', async () => {
    const { scan } = scanOf(['Cast/Alice in a very long name.md'], { bounds: { sampleNameCharacters: 5 } });
    const result = await scan.scan();
    expect(result?.folders[1].sampleNames).toEqual(['Alice']);
  });

  it('starts each path with its root\'s name when several roots are open', async () => {
    const project = aliceProject({ roots: { '/one': ['Cast/Alice.md'], '/two': ['Wonderland/Rabbit Hole.md'] } });
    const result = await new ProjectFolderScan(project.fileSystem, project.workspace, project.log).scan();
    expect(result?.folders.map((folder) => folder.path)).toEqual(['one', 'two', 'one/Cast', 'two/Wonderland']);
  });

  it('answers nothing with no folder open', async () => {
    const project = aliceProject({ roots: {} });
    expect(await new ProjectFolderScan(project.fileSystem, project.workspace, project.log).scan()).toBeUndefined();
  });

  it('logs counts only', async () => {
    const { project, scan } = scanOf(['Cast/Alice.md', 'Wonderland/Rabbit Hole.md', 'Notes/Queen.txt'], { bounds: { scanFolders: 2 } });
    await scan.scan();
    expect(project.lines).toHaveLength(1);
    for (const name of [...ALICE_NAMES, ROOT, '.md', '.txt']) {
      expect(project.lines[0]).not.toContain(name);
    }
  });
});
