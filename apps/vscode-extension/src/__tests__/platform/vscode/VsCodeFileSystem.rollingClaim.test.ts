import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { VsCodeFileSystem } from '../../../platform/vscode/VsCodeFileSystem';

let mockRemote: string | undefined;
let mockRoot: { fsPath: string; scheme: string; authority?: string };
jest.mock('vscode', () => ({
  env: { get remoteName() { return mockRemote; } },
  workspace: {
    get workspaceFolders() { return [{ uri: mockRoot }]; },
    get fs() { throw new Error('The renderer filesystem channel is closed'); }
  }
}), { virtual: true });

describe('release of the publishing local Workshop token during window reload', () => {
  let root: string;
  let file: string;
  let lock: string;
  const adapter = new VsCodeFileSystem();
  const claim = (token: string) => {
    fs.mkdirSync(path.join(lock, token), { recursive: true });
    fs.writeFileSync(path.join(lock, `owner-${token}.json`), JSON.stringify({ token }));
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'workshop-rolling-'));
    file = path.join(root, 'prose-minion', 'sessions', 'current.json');
    lock = path.join(path.dirname(file), '.current.json.lock');
    mockRoot = { fsPath: root, scheme: 'file' };
    mockRemote = undefined;
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('removes its own token after RPC teardown, without touching the published file', () => {
    const token = randomUUID();
    claim(token);
    fs.writeFileSync(file, 'published manuscript');
    const release = adapter.prepareRollingClaimRelease(file, token);
    expect(release?.()).toBe(true);
    expect(fs.existsSync(lock)).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('published manuscript');
  });

  it('leaves a successor and all its files untouched', () => {
    const first = randomUUID();
    const next = randomUUID();
    claim(first);
    const release = adapter.prepareRollingClaimRelease(file, first);
    fs.renameSync(lock, `${lock}.retired`);
    claim(next);
    fs.writeFileSync(path.join(lock, next, 'staged'), 'successor bytes');
    expect(release?.()).toBe(true);
    expect(fs.readFileSync(path.join(lock, next, 'staged'), 'utf8')).toBe('successor bytes');
    expect(fs.existsSync(path.join(lock, `owner-${next}.json`))).toBe(true);
  });

  it('keeps virtual and remote providers on their normal cleanup path', () => {
    const token = randomUUID();
    claim(token);
    mockRoot.scheme = 'virtual';
    expect(adapter.prepareRollingClaimRelease(file, token)).toBeUndefined();
    mockRoot.scheme = 'file';
    mockRemote = 'ssh-remote';
    expect(adapter.prepareRollingClaimRelease(file, token)).toBeUndefined();
    expect(fs.existsSync(path.join(lock, token))).toBe(true);
  });
});
