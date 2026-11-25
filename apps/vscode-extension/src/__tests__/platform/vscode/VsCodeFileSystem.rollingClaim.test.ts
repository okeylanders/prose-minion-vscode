import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
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
    const release = adapter.prepareRollingClaim(file, token);
    expect(release?.release()).toBe(true);
    expect(fs.existsSync(lock)).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('published manuscript');
  });

  it('publishes complete local versions without a missing-file interval for a concurrent reader', async () => {
    const token = randomUUID();
    claim(token);
    fs.writeFileSync(file, 'first manuscript');
    const publication = adapter.prepareRollingClaim(file, token)!;
    const running = new SharedArrayBuffer(4);
    const worker = new Worker(`
      const { workerData: { file, running }, parentPort } = require('node:worker_threads');
      const fs = require('node:fs');
      const flag = new Int32Array(running);
      let reads = 0;
      while (Atomics.load(flag, 0) === 0) {
        const text = fs.readFileSync(file, 'utf8');
        if (text !== 'first manuscript' && text !== 'next manuscript') throw new Error('Torn checkpoint');
        if (++reads === 1) parentPort.postMessage('reading');
      }
      parentPort.postMessage(reads);
    `, { eval: true, workerData: { file, running } });
    try {
      const started = new Promise<void>((resolve, reject) => { worker.once('message', () => resolve()); worker.once('error', reject); });
      const finished = new Promise<number>((resolve, reject) => {
        worker.on('message', count => { if (typeof count === 'number') { resolve(count); } });
        worker.once('error', reject);
      });
      // Attach rejection handling immediately, including if the reader detects an early missing file.
      await Promise.all([finished, (async () => {
        await started;
        for (let n = 0; n < 60; n++) {
          const staged = `${file}.tmp-${randomUUID()}`;
          await fs.promises.writeFile(staged, n % 2 ? 'first manuscript' : 'next manuscript');
          await publication.replace(staged);
        }
        Atomics.store(new Int32Array(running), 0, 1);
      })()]);
      expect(await finished).toBeGreaterThan(0);
    } finally {
      await worker.terminate();
      publication.release();
    }
  });

  it('leaves a successor and all its files untouched', async () => {
    const first = randomUUID();
    const next = randomUUID();
    claim(first);
    const release = adapter.prepareRollingClaim(file, first);
    fs.renameSync(lock, `${lock}.retired`);
    claim(next);
    fs.writeFileSync(path.join(lock, next, 'staged'), 'successor bytes');
    await expect(release?.replace(`${file}.tmp-${randomUUID()}`)).rejects.toThrow(/no longer owns/);
    expect(release?.release()).toBe(true);
    expect(fs.readFileSync(path.join(lock, next, 'staged'), 'utf8')).toBe('successor bytes');
    expect(fs.existsSync(path.join(lock, `owner-${next}.json`))).toBe(true);
  });

  it('keeps virtual and remote providers on their normal cleanup path', () => {
    const token = randomUUID();
    claim(token);
    mockRoot.scheme = 'virtual';
    expect(adapter.prepareRollingClaim(file, token)).toBeUndefined();
    mockRoot.scheme = 'file';
    mockRemote = 'ssh-remote';
    expect(adapter.prepareRollingClaim(file, token)).toBeUndefined();
    expect(fs.existsSync(path.join(lock, token))).toBe(true);
  });
});
