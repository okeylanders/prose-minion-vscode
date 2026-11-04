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
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { renderWorkshopTranscriptHtml } from './WorkshopTranscriptHtml';
import { renderWorkshopTranscriptJson } from './WorkshopTranscriptJson';
import { renderWorkshopTranscriptMarkdown } from './WorkshopTranscriptMarkdown';
import type { WorkshopTranscriptRenderOptions } from './WorkshopTranscriptModelHeader';

/** The aggregate reads export needs: a defensive copy of every turn, and which the writer bookmarked. */
export interface WorkshopTranscriptLedgerPort {
  readRoomLedger(): WorkshopTurn[];
  readBookmarkedTurnIds(): ReadonlySet<string>;
}

/**
 * A model's display name for the export's model slices (ADR 2026-11-03 D8)
 * and its reply headers (D10, amended 2026-11-04), or undefined for the raw
 * id. The host's names come from its model catalog; the thread's from
 * `MODEL_DATA`, so the two can name an id differently, but never place a
 * slice differently or apply the header rule differently.
 */
export type WorkshopTranscriptModelLabelPort = (modelId: string) => string | undefined;

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
  Record<
    WorkshopTranscriptExportFormat,
    (transcript: WorkshopTranscript, options: WorkshopTranscriptRenderOptions) => string
  >
> = {
  markdown: renderWorkshopTranscriptMarkdown,
  json: renderWorkshopTranscriptJson,
  html: renderWorkshopTranscriptHtml
};

export class WorkshopTranscriptExportService {
  constructor(
    private readonly ledger: WorkshopTranscriptLedgerPort,
    private readonly files: WorkshopTranscriptFilePort,
    private readonly now: () => number = Date.now,
    private readonly modelLabel: WorkshopTranscriptModelLabelPort = () => undefined
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
      exportedAt: this.now(),
      bookmarkedTurnIds: this.ledger.readBookmarkedTurnIds(),
      modelLabel: this.modelLabel
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
      RENDERERS[request.format](transcript, { modelLabel: this.modelLabel })
    );
    return { format: request.format, title, ...file, messageCount };
  }
}
