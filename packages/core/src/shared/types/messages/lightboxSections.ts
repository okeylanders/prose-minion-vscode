/**
 * The Lightbox's Sections lane (ADR 2026-10-19 D4, D5; Slice 4C): the
 * chapter's own structure, detected by code from the paragraph model, never
 * read by a model. It is measured, so it is built with every board and is
 * never stale. The detector and its limits are `detectChapterSections`
 * (`utils/chapterSections.ts`), shared with Draft Edit since Slice 3c part 4;
 * these are its types under the Lightbox's names.
 */

import type { ChapterSection, ChapterSectionSignal, ChapterSectionsMeasure } from '@shared/types/chapterSections';

/** Which signal divides the chapter: headings, scene-break lines, or plain chapter lines. */
export type LightboxSectionSignal = ChapterSectionSignal;

/** One section: a run of paragraphs. Sections tile the chapter. */
export type LightboxSection = ChapterSection;

/** The sections, or none, and where each signal fired. With `signal` `none`, the ribbon stays in paragraphs. */
export type LightboxSectionsMeasure = ChapterSectionsMeasure;
