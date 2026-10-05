/**
 * Transcript-export IPC slice for Workshop.
 *
 * Read-only with respect to the room: it projects the live ledger into a
 * file and never touches session state, so it registers directly rather than
 * behind the mutation gate. It still waits out a session replacement (New,
 * Open, Rewind, Branch) so an export never captures a room mid-swap.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { LogSink, ShellService } from '@/platform';
import {
  MessageType,
  WorkshopExportSessionMessage,
  WorkshopSessionActionResultMessage,
  WorkshopTranscriptExportFormat,
  isWorkshopTranscriptExportFormat
} from '@messages';
import type {
  WorkshopTranscriptExportResult
} from '@/application/services/workshop/export/WorkshopTranscriptExportService';
import type {
  WorkshopTranscriptExportPort
} from '@handlers/domain/workshop/WorkshopRouteContracts';

/** The one persistence fact export needs: is a room replacement in flight? */
export interface WorkshopSessionOperationGate {
  isSessionOperationPending(): boolean;
}

const FORMAT_LABELS: Readonly<Record<WorkshopTranscriptExportFormat, string>> = {
  markdown: 'Markdown',
  json: 'JSON',
  html: 'styled HTML'
};

export class WorkshopSessionExportHandler {
  constructor(
    private readonly transcriptExport: WorkshopTranscriptExportPort,
    private readonly sessionOperations: WorkshopSessionOperationGate,
    private readonly shell: ShellService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_EXPORT_SESSION, this.handleExportSession.bind(this));
  }

  async handleExportSession(message: WorkshopExportSessionMessage): Promise<void> {
    if (this.sessionOperations.isSessionOperationPending()) {
      this.postResult(false, 'Wait for the current session change to finish before exporting.');
      return;
    }
    const format = message.payload?.format;
    if (!isWorkshopTranscriptExportFormat(format)) {
      this.postResult(false, 'Choose Markdown, JSON, or styled HTML for the export.');
      return;
    }
    const title = typeof message.payload?.title === 'string' ? message.payload.title : '';
    try {
      const exported = await this.transcriptExport.export({ format, title });
      this.outputChannel.appendLine(
        `[WorkshopSessionExportHandler] Exported ${exported.messageCount} messages as ${format} ` +
        `to ${exported.relativePath}`
      );
      await this.openExport(exported);
      this.postResult(
        true,
        `Exported “${exported.title}” as ${FORMAT_LABELS[format]} to ${exported.relativePath}.`
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[WorkshopSessionExportHandler] Export failed: ${details}`);
      this.postResult(false, details);
    }
  }

  /**
   * Best effort, like Save to notes: the file is written either way. Markdown
   * and JSON open beside the writer's work; HTML opens where it renders.
   */
  private async openExport(exported: WorkshopTranscriptExportResult): Promise<void> {
    try {
      if (exported.format === 'html') {
        await this.shell.openFileInDefaultApp(exported.absolutePath);
      } else {
        await this.shell.openFileInEditor(exported.absolutePath);
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopSessionExportHandler] Exported but could not open ${exported.absolutePath}: ${details}`
      );
    }
  }

  private postResult(ok: boolean, message: string): void {
    const result: WorkshopSessionActionResultMessage = {
      type: MessageType.WORKSHOP_SESSION_ACTION_RESULT,
      source: 'extension.workshop',
      payload: { action: 'export', ok, message },
      timestamp: Date.now()
    };
    void this.postMessage(result);
  }
}
