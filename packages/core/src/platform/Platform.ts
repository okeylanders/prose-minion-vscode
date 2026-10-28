/**
 * Platform - the aggregate of platform ports, assembled ONCE at the composition
 * root and threaded through the shell (extension.ts → provider → MessageHandler).
 *
 * Leaf consumers depend on the SPECIFIC ports they need (drawn from this bundle at
 * their construction site), not on the whole `Platform` — the bundle exists only
 * to keep the shell's wiring from sprouting a dozen parallel parameters.
 */
import { DocumentEditor } from './DocumentEditor';
import { EditorContext } from './EditorContext';
import { FileSystem } from './FileSystem';
import { GlobalStateStore } from './GlobalStateStore';
import { IssueAnnotator } from './IssueAnnotator';
import { LogSink } from './LogSink';
import { SecretStore } from './SecretStore';
import { SettingsStore } from './SettingsStore';
import { ShellService } from './ShellService';
import { Workspace } from './Workspace';

export interface Platform {
  readonly log: LogSink;
  readonly secrets: SecretStore;
  readonly settings: SettingsStore;
  readonly globalState: GlobalStateStore;
  readonly fileSystem: FileSystem;
  readonly workspace: Workspace;
  readonly shell: ShellService;
  readonly editor: EditorContext;
  /** Documents by URI, live buffer included (Draft Edit, ADR 2026-10-21 D3). */
  readonly documents: DocumentEditor;
  /** Draft Edit's flags on a document, without changing it (ADR 2026-10-21 D7): Proofread's. */
  readonly annotations: IssueAnnotator;
  /** Craft Flags' own flags (ADR 2026-10-21, Slice 3c), shown apart from Proofread's: neither pass's run replaces the other's. */
  readonly craftAnnotations: IssueAnnotator;
}
