/**
 * Where a Workshop transcript export lands and what it is called. Shared so
 * the export sheet previews exactly the path the host writes.
 */

import type { WorkshopTranscriptExportFormat } from '@messages';

/** Workspace-relative export directory, beside sessions/ and reports/. */
export const WORKSHOP_TRANSCRIPT_EXPORT_DIRECTORY = 'prose-minion/exports';

export const WORKSHOP_TRANSCRIPT_EXPORT_EXTENSIONS: Readonly<
  Record<WorkshopTranscriptExportFormat, string>
> = {
  markdown: 'md',
  json: 'json',
  html: 'html'
};

const FALLBACK_STEM = 'workshop-transcript';
const MAX_STEM_LENGTH = 64;

/**
 * A portable file stem for an export title: accents folded, everything but
 * ASCII letters and digits collapsed to single hyphens. Never contains a path
 * separator, so a title cannot steer the write outside the export directory.
 */
export function workshopTranscriptExportStem(title: string): string {
  const stem = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_STEM_LENGTH)
    .replace(/^-+|-+$/g, '');
  return stem || FALLBACK_STEM;
}

/** The first-choice file name; the host appends -2, -3… rather than overwrite. */
export function workshopTranscriptExportFileName(
  title: string,
  format: WorkshopTranscriptExportFormat
): string {
  return `${workshopTranscriptExportStem(title)}.${WORKSHOP_TRANSCRIPT_EXPORT_EXTENSIONS[format]}`;
}
