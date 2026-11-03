/**
 * The Read in reader's two routes (ADR 2026-11-03 D4), served for
 * `WorkshopContextHandler`, which registers them beside the context
 * attachment's content and open-file routes.
 *
 * Both are reads: they resolve the webview's `{ group, path }` only through
 * the configured catalog (`readWorkshopReadInResource`), refuse anything
 * else, and never log file content or the writer's text.
 */

import {
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';
import {
  WORKSHOP_READ_IN_REFUSALS,
  WorkshopReadInResolution,
  readWorkshopReadInResource,
  resolveWorkshopReadInResource
} from '@/application/services/workshop/WorkshopReadInResource';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { LogSink, ShellService } from '@/platform';
import {
  MessageType,
  WorkshopOpenReadInResourceMessage,
  WorkshopReadInResourceContentPayload,
  WorkshopRequestReadInResourceMessage
} from '@messages';

const LOG = '[WorkshopReadInRoutes]';

/** The pair as the webview sent it, echoed only when it is two strings. */
const echoedRef = (payload: unknown): { group: string; path: string } => {
  const candidate = (payload ?? {}) as { group?: unknown; path?: unknown };
  return {
    group: typeof candidate.group === 'string' ? candidate.group : '',
    path: typeof candidate.path === 'string' ? candidate.path : ''
  };
};

export class WorkshopReadInRoutes {
  constructor(
    private readonly contextIntakeService: WorkshopContextIntakeService,
    private readonly shell: ShellService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly reportError: (message: string, details?: string) => void
  ) {}

  async serveContent(message: WorkshopRequestReadInResourceMessage): Promise<void> {
    const ref = echoedRef(message.payload);
    let payload: WorkshopReadInResourceContentPayload;
    try {
      const catalog = await this.contextIntakeService.openCatalog();
      const read = await readWorkshopReadInResource(catalog, message.payload?.group, message.payload?.path);
      if (read.kind === 'refused') {
        this.outputChannel.appendLine(`${LOG} Read-in content refused (${read.reason})`);
        payload = { ...ref, error: WORKSHOP_READ_IN_REFUSALS[read.reason], canOpenInEditor: false };
      } else {
        this.outputChannel.appendLine(
          `${LOG} Read-in content served (group=${read.resource.group}, ${read.bytes} of ` +
          `${read.totalBytes} bytes${read.truncated ? ', truncated' : ''})`
        );
        payload = {
          ...ref,
          content: read.content,
          ...(read.truncated ? { truncated: true } : {}),
          canOpenInEditor: true
        };
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`${LOG} Read-in catalog unavailable: ${details}`);
      payload = {
        ...ref,
        error: 'Could not read the configured resource catalog.',
        canOpenInEditor: false
      };
    }
    void this.postMessage({
      type: MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    });
  }

  async openBeside(message: WorkshopOpenReadInResourceMessage): Promise<void> {
    let resolution: WorkshopReadInResolution;
    try {
      const catalog = await this.contextIntakeService.openCatalog();
      resolution = resolveWorkshopReadInResource(
        catalog.entries(),
        message.payload?.group,
        message.payload?.path
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.reportError('Could not read the configured resource catalog.', details);
      return;
    }
    if (resolution.kind === 'refused') {
      this.outputChannel.appendLine(`${LOG} Read-in open refused (${resolution.reason})`);
      this.reportError(WORKSHOP_READ_IN_REFUSALS[resolution.reason]);
      return;
    }
    const { resource } = resolution;
    try {
      await this.shell.openFileInEditor(resource.absolutePath, { beside: true });
      this.outputChannel.appendLine(`${LOG} Read-in file opened beside (${resource.label})`);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`${LOG} Could not open ${resource.label} beside: ${details}`);
      this.reportError(`Could not open ${resource.label} in an editor tab.`, details);
    }
  }
}
