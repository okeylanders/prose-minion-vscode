/**
 * What one reading group's call sends (ADR 2026-10-19 D6, D9). Pure apart
 * from the prompt files it names.
 *
 * - **System message:** the shared rules, then one file per lens that is on
 *   (in rail order), then the group's worked example. A lens the writer
 *   turned off is not in the prompt at all.
 * - **User message:** the chapter first, every paragraph led by its host
 *   marker `⟦¶n⟧`; then the context files, in a labeled section that says
 *   they are never evidence; then the task (the lenses, the frame, the
 *   ribbon columns the tension arc scores, and the counted words the palette
 *   groups). The chapter section is identical
 *   for every group of a board, so it is the stable leading content of each
 *   call (open question 1). The system messages differ per group, so a
 *   caching change would also move the lens files behind the chapter.
 *
 * The writer's text is sent as it stands, except that the marker brackets
 * `⟦` and `⟧` are replaced with plain ones, so nothing in the text can pose
 * as a host marker.
 */

import type { LightboxLensId, LightboxReadingGroupId, LightboxRibbonColumn } from '@messages';
import { countWords } from '@/utils/textUtils';
import { LIGHTBOX_LENS_KEYS, lightboxGroupSentinels } from '@/infrastructure/lightbox/LightboxReadingWire';

export const LIGHTBOX_PROMPT_FILES = {
  shared: 'lightbox/00-lightbox-shared.md',
  lenses: {
    headline: 'lightbox/10-headline.md',
    motif: 'lightbox/11-motifs.md',
    tension: 'lightbox/12-tension.md',
    gravity: 'lightbox/13-lexical-gravity.md',
    palette: 'lightbox/14-palette.md',
    characters: 'lightbox/20-characters.md',
    voice: 'lightbox/21-voice.md',
    subtext: 'lightbox/22-subtext.md',
    genre: 'lightbox/30-genre.md',
    lineage: 'lightbox/31-lineage.md',
    spark: 'lightbox/32-spark.md'
  } satisfies Record<LightboxLensId, string>,
  /* eslint-disable @typescript-eslint/naming-convention -- keyed by the protocol's group ids. */
  examples: {
    A: 'lightbox/40-example-group-a.md',
    B: 'lightbox/41-example-group-b.md',
    C: 'lightbox/42-example-group-c.md'
  } satisfies Record<LightboxReadingGroupId, string>
  /* eslint-enable @typescript-eslint/naming-convention */
} as const;

/** How the task names each lens. */
const LENS_TASK_NAMES: Readonly<Record<LightboxLensId, string>> = {
  headline: 'headline',
  motif: 'motifs',
  tension: 'tension arc',
  palette: 'palette',
  gravity: 'lexical gravity',
  characters: 'characters',
  voice: 'voice',
  subtext: 'subtext',
  genre: 'genre neighborhood',
  lineage: 'lineage',
  spark: 'spark'
};

/** A context file as the prompt carries it. */
export interface LightboxContextMaterial {
  displayPath: string;
  text: string;
}

/** Everything a group's user message is built from. */
export interface LightboxReadingMaterial {
  /** Trimmed paragraph texts; index 0 is ¶1. */
  paragraphs: readonly string[];
  /** The board's ribbon columns (what the tension arc scores). */
  columns: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[];
  context: readonly LightboxContextMaterial[];
  /**
   * The board's most frequent content words, most frequent first, as the
   * host counted them: what the palette groups into clusters. Words only;
   * the counts stay on the board.
   */
  countedWords?: readonly string[];
}

export interface LightboxGroupRequest {
  group: LightboxReadingGroupId;
  /** On, in rail order; never empty. */
  lenses: readonly LightboxLensId[];
}

export interface LightboxBuiltUserMessage {
  message: string;
  /** The chapter section alone (the shared leading content), for the fit estimate. */
  chapterSection: string;
}

/** The prompt files for a group's system message, in order. */
export function lightboxSystemPromptFiles(request: LightboxGroupRequest): string[] {
  return [
    LIGHTBOX_PROMPT_FILES.shared,
    ...request.lenses.map((lens) => LIGHTBOX_PROMPT_FILES.lenses[lens]),
    LIGHTBOX_PROMPT_FILES.examples[request.group]
  ];
}

export function buildLightboxUserMessage(
  material: LightboxReadingMaterial,
  request: LightboxGroupRequest
): LightboxBuiltUserMessage {
  const chapterSection = buildLightboxChapterSection(material.paragraphs);
  const sections = [chapterSection];
  if (material.context.length > 0) {
    sections.push(buildLightboxContextSection(material.context));
  }
  sections.push(buildLightboxTaskSection(request, material.columns, material.countedWords));
  return { message: sections.join('\n\n'), chapterSection };
}

export function buildLightboxChapterSection(paragraphs: readonly string[]): string {
  const words = paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0);
  return [
    '# The chapter',
    '',
    `${paragraphs.length.toLocaleString('en-US')} ${paragraphs.length === 1 ? 'paragraph' : 'paragraphs'}, ` +
      `${words.toLocaleString('en-US')} words. Each paragraph begins with its host marker ⟦¶n⟧.`,
    '',
    paragraphs.map((paragraph, index) => `⟦¶${index + 1}⟧ ${neutralizeMarkers(paragraph)}`).join('\n\n')
  ].join('\n');
}

export function buildLightboxContextSection(context: readonly LightboxContextMaterial[]): string {
  return [
    '# Context',
    '',
    'The writer attached these files. They inform the readings. They are never evidence, and they are never quoted.',
    ...context.flatMap((file, index) => [
      '',
      `## Context file ${index + 1}: ${neutralizeMarkers(file.displayPath)}`,
      '',
      neutralizeMarkers(file.text.trim())
    ])
  ].join('\n');
}

export function buildLightboxTaskSection(
  request: LightboxGroupRequest,
  columns: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[],
  countedWords: readonly string[] = []
): string {
  const { start, end } = lightboxGroupSentinels(request.group);
  const keys = request.lenses.map((lens) => `"${LIGHTBOX_LENS_KEYS[lens]}"`).join(', ');
  const lines = [
    '# Task',
    '',
    `Read group ${request.group} with these lenses, and only these: ` +
      `${request.lenses.map((lens) => LENS_TASK_NAMES[lens]).join(', ')}.`,
    `Return one frame between ${start} and ${end}. Its JSON has "version": 1 and exactly these lens keys: ${keys}.`
  ];
  if (request.lenses.includes('tension')) {
    lines.push(...tensionColumnLines(columns));
  }
  if (request.lenses.includes('palette') && countedWords.length > 0) {
    lines.push(
      'The board counted these as the chapter\'s most frequent content words, most frequent first; ' +
        `build the palette's clusters from them where you can: ${countedWords.map(neutralizeMarkers).join(', ')}.`
    );
  }
  return lines.join('\n');
}

function tensionColumnLines(columns: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[]): string[] {
  const count = columns.length.toLocaleString('en-US');
  if (columns.every((column) => column.from === column.to)) {
    return [`The tension arc scores ${count} ribbon columns, one per paragraph: column n is ¶n.`];
  }
  return [
    `The tension arc scores ${count} ribbon columns, each covering a run of paragraphs:`,
    ...columns.map((column, index) => `column ${index + 1}: ¶${column.from}–¶${column.to}`)
  ];
}

/** Nothing in the writer's text may pose as a host marker. */
function neutralizeMarkers(text: string): string {
  return text.replace(/⟦/g, '[').replace(/⟧/g, ']');
}
