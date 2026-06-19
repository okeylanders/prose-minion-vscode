/**
 * Prompt/Guide loader containment tests.
 *
 * `promptPath`/`guidePath` can originate from tool-orchestration / AI-named
 * files, so a `../` traversal must not escape the bundled resources root — the
 * same `isPathWithinRoot` guard UIHandler applies to its guide/docs/resource
 * opens. A legitimate in-root path still loads.
 */

import * as path from 'path';
import { PromptLoader } from '@/tools/shared/prompts';
import { GuideLoader } from '@/tools/shared/guides';
import { createFakeFileSystem } from '../../mocks/platform';

const EXT = '/ext';

describe('PromptLoader containment', () => {
  it('loads an in-root prompt', async () => {
    const file = path.join(EXT, 'resources', 'system-prompts', 'dialogue.md');
    const fs = createFakeFileSystem(undefined, { [file]: 'PROMPT BODY' });
    const loader = new PromptLoader(EXT, fs);

    await expect(loader.loadPrompt('dialogue.md')).resolves.toBe('PROMPT BODY');
  });

  it('rejects a `../` traversal out of the system-prompts root (never reads the file)', async () => {
    const readFile = jest.fn();
    const fs = createFakeFileSystem({ readFile });
    const loader = new PromptLoader(EXT, fs);

    await expect(loader.loadPrompt('../../secrets/key.env')).rejects.toThrow(/Failed to load prompt/);
    expect(readFile).not.toHaveBeenCalled(); // blocked before any FS access
  });
});

describe('GuideLoader containment', () => {
  it('loads an in-root guide (simple name → .md)', async () => {
    const file = path.join(EXT, 'resources', 'craft-guides', 'dialogue-tags.md');
    const fs = createFakeFileSystem(undefined, { [file]: 'GUIDE BODY' });
    const loader = new GuideLoader(EXT, fs);

    await expect(loader.loadGuide('dialogue-tags')).resolves.toBe('GUIDE BODY');
  });

  it('rejects a `../` traversal out of the craft-guides root (never reads the file)', async () => {
    const readFile = jest.fn();
    const fs = createFakeFileSystem({ readFile });
    const loader = new GuideLoader(EXT, fs);

    await expect(loader.loadGuide('../../../etc/hostname.md')).rejects.toThrow(/Failed to load guide/);
    expect(readFile).not.toHaveBeenCalled();
  });
});
