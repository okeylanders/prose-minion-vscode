import { fork } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { WorkshopRoomPresence, WorkshopRoomPresenceBusyError } from '@app/application/WorkshopRoomPresence';

describe('Workshop room presence across extension hosts', () => {
  let temporary: string;
  let root: string;
  let presence: WorkshopRoomPresence;

  beforeEach(() => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-minion-room-presence-test-'));
    root = path.join(temporary, 'Book');
    fs.mkdirSync(root);
    presence = new WorkshopRoomPresence(temporary);
  });
  afterEach(() => { fs.rmSync(temporary, { recursive: true, force: true }); });

  it('protects each open attachment, including separate handles from one host', () => {
    const first = presence.enter(root, 'a');
    const second = presence.enter(root, 'a');
    first.dispose();
    first.dispose();
    expect(presence.isOpen(root, 'a')).toBe(true);
    expect(() => presence.beginDelete(root, 'a')).toThrow(WorkshopRoomPresenceBusyError);
    expect(presence.isOpen(root, 'b')).toBe(false);
    second.dispose();
    const removing = presence.beginDelete(root, 'a');
    expect(() => presence.enter(root, 'a')).toThrow(WorkshopRoomPresenceBusyError);
    expect(() => presence.beginDelete(root, 'a')).toThrow(WorkshopRoomPresenceBusyError);
    removing.dispose();
    expect(presence.isOpen(root, 'a')).toBe(false);
  });

  it('canonicalizes an existing workspace and accepts a provider-only root', () => {
    const alias = path.join(temporary, 'Alias');
    fs.symlinkSync(root, alias, 'junction');
    const lease = presence.enter(root, 'a');
    expect(() => presence.beginDelete(alias, 'a')).toThrow(WorkshopRoomPresenceBusyError);
    lease.dispose();
    const remote = path.join(temporary, 'Only on the provider');
    const far = presence.enter(remote, 'a');
    expect(presence.isOpen(remote, 'a')).toBe(true);
    far.dispose();
    expect(fs.existsSync(remote)).toBe(false);
  });

  it.each(['enter', 'beginDelete'] as const)('respects a real child host’s %s claim and reclaims it after a crash', async method => {
    const source = fs.readFileSync(require.resolve('@app/application/WorkshopRoomPresence'), 'utf8');
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    const moduleFile = path.join(temporary, 'presence.cjs');
    const childFile = path.join(temporary, 'extension-host.cjs');
    fs.writeFileSync(moduleFile, compiled);
    fs.writeFileSync(childFile, `
      const { WorkshopRoomPresence } = require(process.argv[2]);
      const service = new WorkshopRoomPresence(process.argv[3]);
      service[process.argv[4]](process.argv[5], 'a');
      process.send('ready');
      process.on('message', () => {});
    `);
    const child = fork(childFile, [moduleFile, temporary, method, root], { execArgv: [], silent: true });
    const exited = once(child, 'exit');
    try {
      await Promise.race([once(child, 'message'), exited.then(() => { throw new Error('Extension host exited before publishing its claim'); })]);
      expect(presence.isOpen(root, 'a')).toBe(true);
      expect(() => presence.beginDelete(root, 'a')).toThrow(WorkshopRoomPresenceBusyError);
      if (method === 'beginDelete') {
        expect(() => presence.enter(root, 'a')).toThrow(WorkshopRoomPresenceBusyError);
      } else {
        presence.enter(root, 'a').dispose();
      }
      presence.beginDelete(root, 'b').dispose();
    } finally {
      child.kill();
      await exited;
    }
    expect(presence.isOpen(root, 'a')).toBe(false);
    presence.beginDelete(root, 'a').dispose();
  });
});
