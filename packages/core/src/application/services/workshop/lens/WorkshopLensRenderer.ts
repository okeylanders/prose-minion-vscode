/**
 * What a `lens.*` result says (ADR 2026-11-17 D17, D18). Pure: the
 * capability asks the library and measures; this module writes the text.
 *
 * - **A catalog page** lists `catalogItems` lenses, the project's first, by
 *   name, then the built-in starters. The continuation is written exactly
 *   when a later page exists and is that page's complete call; a page past
 *   the end answers in words, with the last page and no call.
 * - **A read** shows whole sections, in the order asked. A read that shows
 *   fewer than it was asked for ends with the complete call for the rest, on
 *   one line. A section is never cut.
 * - **Every call written here decodes as written** through the codec, and
 *   names a later page or strictly fewer sections than its request.
 * - Every lens string passes `workshopLensText`.
 */

import type { WorkshopLexicalGravityLens } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopLensSection } from '@shared/types/workshopCapabilities';
import { workshopCapabilityPageOf } from '@/application/services/workshop/WorkshopCapabilityPaging';
import {
  workshopLensBody,
  workshopLensProjectLibraryLine,
  workshopLensText,
  type WorkshopLensProjectLibraryState
} from '@/application/services/workshop/lens/WorkshopLensCopy';

const number = (value: number): string => value.toLocaleString('en-US');
const count = (value: number, singular: string, plural = `${singular}s`): string =>
  `${number(value)} ${value === 1 ? singular : plural}`;
const text = workshopLensText;

/** The library as a catalog lists it: in order, with what could not be listed. */
export interface WorkshopLensListing {
  /** The project's lenses by name (ties by slug), then the built-ins. */
  readonly lenses: readonly WorkshopLexicalGravityLens[];
  readonly projectLibrary: WorkshopLensProjectLibraryState;
  /** Project files that did not read as a lens: counted, never named. */
  readonly unreadableFiles: number;
  /** The slug of the lens the room's Lexical Gravity directive holds, if any. */
  readonly installedSlug?: string;
}

export interface WorkshopLensRenderedCatalog {
  readonly content: string;
  readonly shown: number;
  readonly notShown: number;
  readonly page: number;
  readonly pages: number;
  /** The continuation written, as written. */
  readonly hint?: string;
}

/** A catalog page's complete call, on one line: what a continuation names. */
export function workshopLensCatalogCall(page: number): string {
  return `<prose-minion-tool-call name="lens.catalog"><page>${page}</page></prose-minion-tool-call>`;
}

/** A read's complete call, on one line, for the sections named. A slug holds only letters, digits and hyphens. */
export function workshopLensReadCall(slug: string, sections: readonly WorkshopLensSection[]): string {
  return `<prose-minion-tool-call name="lens.read"><lens>${slug}</lens>` +
    `${sections.map((section) => `<section>${section}</section>`).join('')}</prose-minion-tool-call>`;
}

export function renderWorkshopLensCatalog(listing: WorkshopLensListing, page = 1): WorkshopLensRenderedCatalog {
  const total = listing.lenses.length;
  const paged = workshopCapabilityPageOf(total, PROMPT_BUDGETS.workshopLens.catalogItems, page);
  const shown = listing.lenses.slice(paged.start, paged.end);
  const notShown = total - paged.end;
  const unavailable = workshopLensProjectLibraryLine(listing.projectLibrary);
  const hint = paged.next !== undefined ? workshopLensCatalogCall(paged.next) : undefined;
  const lines = [
    ...(unavailable ? [unavailable] : []),
    ...(paged.pastEnd
      ? [total === 0
        ? `Page ${number(page)} is past the end: no lens is listed.`
        : `Page ${number(page)} is past the end: ${count(total, 'lens', 'lenses')}, ${count(paged.pages, 'page')}.`]
      : [
        `${catalogRange(paged.start, paged.end, total, paged.pages)}: the project's lenses first, by name, then the built-in starters. ` +
          'Read one with lens.read, by its slug.',
        ...shown.map((lens) => catalogRow(lens, lens.slug === listing.installedSlug))
      ]),
    ...(listing.unreadableFiles > 0
      ? [`${count(listing.unreadableFiles, 'lens file')} couldn't be read.`]
      : []),
    ...(hint ? [`${count(notShown, 'more lens', 'more lenses')}. The next page: ${hint}`] : [])
  ];
  return { content: workshopLensBody(lines), shown: shown.length, notShown, page, pages: paged.pages, ...(hint ? { hint } : {}) };
}

function catalogRange(start: number, end: number, total: number, pages: number): string {
  if (pages <= 1) {
    return total === 0 ? 'No lens is listed' : count(total, 'lens', 'lenses');
  }
  return `Lenses ${number(start + 1)}–${number(end)} of ${number(total)}`;
}

function catalogRow(lens: WorkshopLexicalGravityLens, installed: boolean): string {
  return [
    `- ${lens.slug}`,
    `“${text(lens.name)}”${lens.variant ? ` — ${text(lens.variant)}` : ''}`,
    lens.source === 'project' ? 'project lens' : 'built-in starter',
    ...(lens.originQuery ? [`subject: “${text(lens.originQuery)}”`] : []),
    ...(installed ? ['installed in this room'] : []),
    ...(lens.description ? [text(lens.description)] : [])
  ].join(' · ');
}

/** What limited a read, for its first lines. */
export interface WorkshopLensReadLimit {
  /** Half the room left in the context window, in tokens. */
  readonly halfWindowTokens: number;
}

export interface WorkshopLensRenderedRead {
  readonly content: string;
  readonly read: readonly WorkshopLensSection[];
  readonly notRead: readonly WorkshopLensSection[];
  /** The continuation written, as written. */
  readonly hint?: string;
}

/**
 * The first `take` of `sections` of one lens, whole. With fewer taken than
 * asked, the read says so at its top and ends with the call for the rest.
 */
export function renderWorkshopLensRead(
  lens: WorkshopLexicalGravityLens,
  sections: readonly WorkshopLensSection[],
  take: number,
  options: { readonly installed: boolean; readonly limit?: WorkshopLensReadLimit }
): WorkshopLensRenderedRead {
  const read = sections.slice(0, take);
  const notRead = sections.slice(take);
  const hint = notRead.length > 0 ? workshopLensReadCall(lens.slug, notRead) : undefined;
  const lines = [
    `Lens ${lens.slug}: “${text(lens.name)}”${lens.variant ? ` — ${text(lens.variant)}` : ''}. ` +
      (lens.source === 'project'
        ? `A lens the writer saved in this project${lens.originQuery ? `, from the subject “${text(lens.originQuery)}”` : ''}.`
        : 'A built-in starter.') +
      (options.installed ? ' It is the lens installed in this room.' : ''),
    ...(lens.description ? [text(lens.description)] : []),
    ...(notRead.length > 0
      ? [`This read was limited to ${number(read.length)} of ${count(sections.length, 'section')}` +
        (options.limit ? `: half the room left in your context window is ${count(options.limit.halfWindowTokens, 'token')}.` : '.')]
      : []),
    ...read.flatMap((section) => [`## ${section}`, ...sectionLines(lens, section)]),
    ...(hint ? [`Not read: ${notRead.join(', ')}. The exact call for ${notRead.length === 1 ? 'it' : 'them'}: ${hint}`] : [])
  ];
  return { content: workshopLensBody(lines), read, notRead, ...(hint ? { hint } : {}) };
}

const list = (values: readonly string[]): string => values.map(text).join('; ');
const SUBSTITUTION_KEYS = ['plan', 'conflict', 'agreement', 'turning', 'ending'] as const;

function sectionLines(lens: WorkshopLexicalGravityLens, section: WorkshopLensSection): string[] {
  switch (section) {
    case 'logic': {
      const { logic } = lens;
      return [
        `Premise: ${text(logic.premise)}`,
        `Foregrounds: ${list(logic.attention.foregrounds)}`,
        `Backgrounds: ${list(logic.attention.backgrounds)}`,
        ...logic.axes.map((axis) => `Axis ${text(axis.id)} (${text(axis.name)}): ${text(axis.poles[0])} ↔ ${text(axis.poles[1])}`),
        ...logic.roles.map((role) => `Role ${text(role.id)} (${text(role.name)}): ${text(role.description)}`),
        ...logic.dynamics.map((dynamic) =>
          `Dynamic ${text(dynamic.id)} (${text(dynamic.operation)}): ${text(dynamic.movement)} ` +
          `Entails: ${text(dynamic.entailment)} Affords: ${text(dynamic.narrativeAffordance)}`),
        `Guardrails: ${list(logic.guardrails)}`
      ];
    }
    case 'degrees':
      return ([1, 2, 3] as const).map((degree) => {
        const bucket = lens.degrees[degree];
        return `Degree ${degree}: nouns [${list(bucket.nouns)}]; verbs [${list(bucket.verbs)}]; modifiers [${list(bucket.modifiers)}]`;
      });
    case 'gradient':
      return [lens.gradient.map(text).join(' → ')];
    case 'cliches':
      return lens.cliches.map(({ worn, fresh }) => `${text(worn)} → ${text(fresh)}`);
    case 'substitutions':
      return SUBSTITUTION_KEYS.map((ordinary) => `${ordinary} → ${text(lens.substitutions[ordinary])}`);
    case 'metaphor':
      return [text(lens.metaphor)];
    case 'sample':
      return [text(lens.sample)];
    default:
      return assertNever(section);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled lens section: ${String(value)}`);
}
