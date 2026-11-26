import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type ClaimKind = 'open' | 'delete';
type Lease = { dispose(): void };

export class WorkshopRoomPresenceBusyError extends Error {
  constructor() {
    super('This Workshop room is in use or being deleted in another window. Refresh Unsaved Sessions after that operation finishes.');
    this.name = 'WorkshopRoomPresenceBusyError';
  }
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code;

function canonicalRoot(root: string): string {
  const absolute = path.resolve(root);
  try {
    return fs.realpathSync.native(absolute);
  } catch (error) {
    // A remote provider or a synthetic workspace need not exist on the host's local filesystem.
    if (codeOf(error) === 'ENOENT') { return absolute; }
    throw error;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (codeOf(error) === 'ESRCH') { return false; }
    if (codeOf(error) === 'EPERM') { return true; }
    throw error;
  }
}

function removeMarker(file: string): void {
  try {
    fs.unlinkSync(file);
  } catch (error) {
    if (codeOf(error) !== 'ENOENT') { throw error; }
  }
}

/** Window-local handles backed by a private, machine-local directory shared by this user's extension hosts. */
export class WorkshopRoomPresence {
  private readonly directory: string;

  constructor(tempDirectory = os.tmpdir()) {
    const user = process.getuid?.().toString() ?? os.homedir();
    this.directory = path.join(tempDirectory, 'prose-minion-workshop-rooms-' + hash(user).slice(0, 16));
  }

  enter(root: string, roomId: string): Lease {
    return this.acquire(root, roomId, 'open');
  }

  beginDelete(root: string, roomId: string): Lease {
    return this.acquire(root, roomId, 'delete');
  }

  /** A listing hint. Destructive operations must still call beginDelete at commit time. */
  isOpen(root: string, roomId: string): boolean {
    try {
      this.verifyDirectory();
      return this.occupied(this.key(root, roomId), 'delete');
    } catch {
      return true;
    }
  }

  private key(root: string, roomId: string): string {
    return hash(JSON.stringify([canonicalRoot(root), roomId]));
  }

  private acquire(root: string, roomId: string, kind: ClaimKind): Lease {
    let marker: string | undefined;
    try {
      this.verifyDirectory();
      const key = this.key(root, roomId);
      const name = [key, kind, process.pid, randomUUID()].join('.');
      const file = path.join(this.directory, name);
      // Publish before checking contenders. A simultaneous open and delete cannot both pass.
      fs.writeFileSync(file, '', { flag: 'wx', mode: 0o600 });
      marker = file;
      if (this.occupied(key, kind, name)) { throw new WorkshopRoomPresenceBusyError(); }
      return { dispose: () => removeMarker(file) };
    } catch (error) {
      if (marker) { removeMarker(marker); }
      if (error instanceof WorkshopRoomPresenceBusyError) { throw error; }
      throw new Error('Could not verify Workshop room ownership. Check access to the local temporary folder and try again.');
    }
  }

  private verifyDirectory(): void {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(this.directory);
    const uid = process.getuid?.();
    if (!stat.isDirectory() || (uid !== undefined && (stat.uid !== uid || (stat.mode & 0o077) !== 0))) {
      throw new Error('The Workshop ownership directory is not private to this user.');
    }
  }

  private occupied(key: string, kind: ClaimKind, own?: string): boolean {
    for (const name of fs.readdirSync(this.directory)) {
      if (name === own || !name.startsWith(key + '.')) { continue; }
      const [, otherKind, rawPid, nonce, extra] = name.split('.');
      const pid = Number(rawPid);
      if ((otherKind !== 'open' && otherKind !== 'delete') || !Number.isSafeInteger(pid) || pid < 1 || !nonce || extra !== undefined) {
        return true;
      }
      if (!processIsAlive(pid)) {
        // The nonce makes this path unique to the dead publisher, even after PID reuse.
        removeMarker(path.join(this.directory, name));
      } else if (kind === 'delete' || otherKind === 'delete') {
        return true;
      }
    }
    return false;
  }
}
