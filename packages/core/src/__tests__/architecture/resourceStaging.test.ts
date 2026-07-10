/**
 * D22 resource-staging witness (PR #60 review #3).
 *
 * The one path the monorepo move could actually change behavior: core owns
 * `packages/core/resources/`, `scripts/copy-resources.js` stages it into the app
 * for the VSIX, and at runtime the loaders join `<extensionPath>/resources/...`.
 * Every OTHER test mocks the loaders, so without this nothing proves staged files
 * land where the runtime reads them — "correct by inspection" that decays the
 * moment the copy script or the loader path math is edited.
 *
 * This stages the REAL resources into a temp dir (the same `fs.cpSync` the copy
 * script uses) and reads one back through the REAL `PromptLoader` over a Node-fs
 * `FileSystem`, so a copy regression OR a loader path change goes red here.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PromptLoader } from '@/tools/shared/prompts';
import { FileSystem, FileType, FileStat } from '@/platform';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';

// Minimal Node-fs implementation of the FileSystem port. The loader only needs
// readFile; the rest are implemented for interface honesty and double as a
// reference for the future desktop Node-fs adapter.
const nodeFileSystem: FileSystem = {
  async readFile(p: string): Promise<Uint8Array> {
    return fs.promises.readFile(p);
  },
  async writeFile(p: string, data: Uint8Array): Promise<void> {
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    await fs.promises.writeFile(p, data);
  },
  async readDirectory(p: string): Promise<Array<[string, FileType]>> {
    const entries = await fs.promises.readdir(p, { withFileTypes: true });
    return entries.map((e) => [
      e.name,
      e.isDirectory() ? FileType.Directory : e.isSymbolicLink() ? FileType.SymbolicLink : FileType.File,
    ] as [string, FileType]);
  },
  async stat(p: string): Promise<FileStat> {
    const s = await fs.promises.stat(p);
    return {
      type: s.isDirectory() ? FileType.Directory : FileType.File,
      ctime: s.ctimeMs,
      mtime: s.mtimeMs,
      size: s.size,
    };
  },
  async createDirectory(p: string): Promise<void> {
    await fs.promises.mkdir(p, { recursive: true });
  },
};

// __dirname = packages/core/src/__tests__/architecture -> packages/core/resources
const CORE_RESOURCES = path.resolve(__dirname, '..', '..', '..', 'resources');

function countFiles(dir: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n += 1;
  }
  return n;
}

describe('D22 — staged resources resolve through the runtime loader', () => {
  let stageRoot: string;

  beforeAll(() => {
    stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-d22-'));
    // Mirror copy-resources.js: stage packages/core/resources -> <stage>/resources.
    fs.cpSync(CORE_RESOURCES, path.join(stageRoot, 'resources'), { recursive: true, dereference: true });
  });

  afterAll(() => {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  });

  it('PromptLoader reads a real system-prompt from <extensionPath>/resources after staging', async () => {
    const loader = new PromptLoader(stageRoot, nodeFileSystem);
    const content = await loader.loadPrompt('dictionary-utility/00-dictionary-utility.md');
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it('stages and loads the shared Workshop base plus every persona prompt through PromptLoader', async () => {
    const loader = new PromptLoader(stageRoot, nodeFileSystem);
    const paths = ['workshop-personas/base.md', ...WORKSHOP_PERSONA_CATALOG.map((persona) => persona.promptPath)];

    await expect(loader.loadPrompts(paths)).resolves.toContain('Workshop host contract');
  });

  it('the staged tree mirrors the core source (the copy drops no files)', () => {
    const srcCount = countFiles(CORE_RESOURCES);
    const stagedCount = countFiles(path.join(stageRoot, 'resources'));
    expect(srcCount).toBeGreaterThan(0);
    expect(stagedCount).toBe(srcCount);
  });
});
