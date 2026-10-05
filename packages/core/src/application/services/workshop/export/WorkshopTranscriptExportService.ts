/**
 * Export the live Workshop room's transcript to a file.
 *
 * Reads the FULL turn ledger — not the webview's bounded snapshot window — so
 * a marathon session exports every turn. Projection and rendering are pure;
 * this service owns only sequencing: validate, read, project, render, write.
 */

import type {
  WorkshopTranscriptExportFormat,
  WorkshopTurn
} from '@messages';
import { WORKSHOP_TRANSCRIPT_EXPORT_TITLE_MAX_LENGTH } from '@messages';
import {
  WORKSHOP_TRANSCRIPT_EXPORT_EXTENSIONS,
  workshopTranscriptExportStem
} from '@shared/constants/workshopTranscriptExport';
import {
  WorkshopTranscript,
  countWorkshopTranscriptMessages,
  projectWorkshopTranscript
} from './WorkshopTranscript';
import { renderWorkshopTranscriptHtml } from './WorkshopTranscriptHtml';
import { renderWorkshopTranscriptJson } from './WorkshopTranscriptJson';
import { renderWorkshopTranscriptMarkdown } from './WorkshopTranscriptMarkdown';

/** The one aggregate read export needs: a defensive copy of every turn. */
export interface WorkshopTranscriptLedgerPort {
  readRoomLedger(): WorkshopTurn[];
}

export interface WorkshopTranscriptFilePort {
  writeNew(
    stem: string,
    extension: string,
    content: string
  ): Promise<{ absolutePath: string; relativePath: string }>;
}

export interface WorkshopTranscriptExportRequest {
  format: WorkshopTranscriptExportFormat;
  title: string;
}

export interface WorkshopTranscriptExportResult {
  format: WorkshopTranscriptExportFormat;
  title: string;
  absolutePath: string;
  relativePath: string;
  messageCount: number;
}

/** A refusal the writer can act on; its message is display copy. */
export class WorkshopTranscriptExportRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkshopTranscriptExportRefusedError';
  }
}

const RENDERERS: Readonly<
  Record<WorkshopTranscriptExportFormat, (transcript: WorkshopTranscript) => string>
> = {
  markdown: renderWorkshopTranscriptMarkdown,
  json: renderWorkshopTranscriptJson,
  html: renderWorkshopTranscriptHtml
};

export class WorkshopTranscriptExportService {
  constructor(
    private readonly ledger: WorkshopTranscriptLedgerPort,
    private readonly files: WorkshopTranscriptFilePort,
    private readonly now: () => number = Date.now
  ) {}

  async export(request: WorkshopTranscriptExportRequest): Promise<WorkshopTranscriptExportResult> {
    const title = request.title.trim();
    if (!title) {
      throw new WorkshopTranscriptExportRefusedError('Name the export before saving it.');
    }
    if (title.length > WORKSHOP_TRANSCRIPT_EXPORT_TITLE_MAX_LENGTH) {
      throw new WorkshopTranscriptExportRefusedError(
        `Keep the export name under ${WORKSHOP_TRANSCRIPT_EXPORT_TITLE_MAX_LENGTH} characters.`
      );
    }
    const transcript = projectWorkshopTranscript(this.ledger.readRoomLedger(), {
      title,
      exportedAt: this.now()
    });
    const messageCount = countWorkshopTranscriptMessages(transcript);
    if (messageCount === 0) {
      throw new WorkshopTranscriptExportRefusedError(
        'There are no messages in this session to export yet.'
      );
    }
    const file = await this.files.writeNew(
      workshopTranscriptExportStem(title),
      WORKSHOP_TRANSCRIPT_EXPORT_EXTENSIONS[request.format],
      RENDERERS[request.format](transcript)
    );
    return { format: request.format, title, ...file, messageCount };
  }
}
