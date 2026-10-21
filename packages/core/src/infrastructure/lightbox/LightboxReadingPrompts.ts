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
 *   ribbon columns the tension arc scores and the paragraph endings read,
 *   the counted words the palette groups, the measured figures that
 *   stand out, which the numbers lens reads, and group E's paragraph span
 *   for the movements and whether engagement is asked). The chapter section is identical
 *   for every group of a board, so it is the stable leading content of each
 *   call (open question 1). The system messages differ per group, so a
 *   caching change would also move the lens files behind the chapter.
 *
 * Group F, the Opinion (Slice 4D), is the exception: it reads the board's
 * verified digest, never the chapter (`LightboxOpinionDigest` builds its
 * user message), and its system message is its own lens file and worked
 * example only. The shared rules describe reading a chapter and forbid
 * grading; the Opinion reads the board and is the fenced exception to that
 * rule (ADR D7 addendum), so its file states its whole protocol.
 *
 * The writer's text is sent as it stands, except that the marker brackets
 * `⟦` and `⟧` are replaced with plain ones, so nothing in the text can pose
 * as a host marker.
 */

import type { LightboxLensId, LightboxNumberRow, LightboxReadingGroupId, LightboxRibbonColumn } from '@messages';
import { countWords } from '@/utils/textUtils';
import { LIGHTBOX_LENS_KEYS, lightboxGroupSentinels } from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxNumberTaskLines } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { lightboxGroupReadsBoard } from '@shared/constants/lightbox';

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
    spark: 'lightbox/32-spark.md',
    stock: 'lightbox/50-stock-signature.md',
    rhythm: 'lightbox/51-rhythm-handoffs.md',
    numbers: 'lightbox/52-numbers.md',
    template: 'lightbox/53-template.md',
    pressure: 'lightbox/54-pressure.md',
    artifacts: 'lightbox/55-artifacts.md',
    summary: 'lightbox/56-summary-movements.md',
    opinion: 'lightbox/57-opinion.md'
  } satisfies Record<LightboxLensId, string>,
  /* eslint-disable @typescript-eslint/naming-convention -- keyed by the protocol's group ids. */
  examples: {
    A: 'lightbox/40-example-group-a.md',
    B: 'lightbox/41-example-group-b.md',
    C: 'lightbox/42-example-group-c.md',
    D: 'lightbox/43-example-group-d.md',
    E: 'lightbox/44-example-group-e.md',
    F: 'lightbox/45-example-group-f.md'
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
  spark: 'spark',
  stock: 'stock and signature',
  rhythm: 'rhythm and handoffs',
  numbers: 'the numbers',
  template: 'template and freshness',
  pressure: 'pressure',
  artifacts: 'artifacts',
  summary: 'summary and movements',
  opinion: 'the Opinion'
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
  /** The board's measured figures; those that stand out are what the numbers lens reads (Slice 4B). */
  numbers?: readonly LightboxNumberRow[];
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

/** The prompt files for a group's system message, in order. Group F's are its own: its lens file, then its example. */
export function lightboxSystemPromptFiles(request: LightboxGroupRequest): string[] {
  if (lightboxGroupReadsBoard(request.group)) {
    return [...request.lenses.map((lens) => LIGHTBOX_PROMPT_FILES.lenses[lens]), LIGHTBOX_PROMPT_FILES.examples[request.group]];
  }
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
  sections.push(buildLightboxTaskSection(request, material.columns, material.countedWords, material.numbers));
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
  countedWords: readonly string[] = [],
  numbers: readonly LightboxNumberRow[] = []
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
    lines.push(...columnLines('The tension arc scores', columns));
  }
  if (request.lenses.includes('rhythm')) {
    lines.push(...columnLines('The rhythm block gives one ending for each of', columns));
  }
  if (request.lenses.includes('palette') && countedWords.length > 0) {
    lines.push(
      'The board counted these as the chapter\'s most frequent content words, most frequent first; ' +
        `build the palette's clusters from them where you can: ${countedWords.map(neutralizeMarkers).join(', ')}.`
    );
  }
  if (request.lenses.includes('numbers')) {
    lines.push(...lightboxNumberTaskLines(numbers));
  }
  lines.push(...lightboxPlotTaskLines(request.lenses, columns));
  return lines.join('\n');
}

/**
 * Group E's task lines (Slice 4C): the paragraphs the movements tile, and
 * whether engagement is asked, which it is only when the movements are read
 * in the same call.
 */
function lightboxPlotTaskLines(
  lenses: readonly LightboxLensId[],
  columns: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[]
): string[] {
  const last = columns[columns.length - 1]?.to ?? 0;
  const lines: string[] = [];
  if (lenses.includes('summary')) {
    lines.push(`The movements cover all ${last.toLocaleString('en-US')} paragraphs: the first starts at ¶1 and the last ends at ¶${last}.`);
  }
  if (lenses.includes('template')) {
    lines.push(lenses.includes('summary')
      ? 'The template block\'s engagement gives exactly one level for each movement the summary block draws, naming it by that movement\'s id.'
      : 'The movements are not read in this call: give the template block\'s engagement as an empty list.');
  }
  return lines;
}

/** The ribbon columns a per-column reading covers (the tension arc, the paragraph endings). */
function columnLines(lead: string, columns: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[]): string[] {
  const count = columns.length.toLocaleString('en-US');
  if (columns.every((column) => column.from === column.to)) {
    return [`${lead} ${count} ribbon columns, one per paragraph: column n is ¶n.`];
  }
  return [
    `${lead} ${count} ribbon columns, each covering a run of paragraphs:`,
    ...columns.map((column, index) => `column ${index + 1}: ¶${column.from}–¶${column.to}`)
  ];
}

/** Nothing in the writer's text may pose as a host marker. */
function neutralizeMarkers(text: string): string {
  return text.replace(/⟦/g, '[').replace(/⟧/g, ']');
}
