/**
 * Platform - the aggregate of platform ports, assembled ONCE at the composition
 * root and threaded through the shell (extension.ts → provider → MessageHandler).
 *
 * Leaf consumers depend on the SPECIFIC ports they need (drawn from this bundle at
 * their construction site), not on the whole `Platform` — the bundle exists only
 * to keep the shell's wiring from sprouting a dozen parallel parameters.
 */
import { EditorContext } from './EditorContext';
import { FileSystem } from './FileSystem';
import { LogSink } from './LogSink';
import { SecretStore } from './SecretStore';
import { SettingsStore } from './SettingsStore';
import { ShellService } from './ShellService';
import { Workspace } from './Workspace';

export interface Platform {
  readonly log: LogSink;
  readonly secrets: SecretStore;
  readonly settings: SettingsStore;
  readonly fileSystem: FileSystem;
  readonly workspace: Workspace;
  readonly shell: ShellService;
  readonly editor: EditorContext;
}
