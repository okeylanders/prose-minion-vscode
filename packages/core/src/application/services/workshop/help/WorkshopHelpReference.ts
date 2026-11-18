/** The bundled reference is immutable for this extension installation. Index it once, on first use. */
import * as path from 'path';
import type { FileSystem, LogSink } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  normalizeWorkshopText,
  parseWorkshopQuery,
  WorkshopQueryMatcher,
  workshopSearchSnippet
} from '@/application/services/workshop/WorkshopTextSearch';

export const WORKSHOP_HELP_AREAS = [
  'overview', 'sidebar-tools', 'workshop', 'workshop-memory', 'lightbox', 'draft-edit', 'settings', 'commands'
] as const;

export interface WorkshopHelpSection {
  readonly id: string;
  readonly heading: string;
  readonly body: string;
  readonly searchText: string;
}

export type WorkshopHelpIndex = ReadonlyMap<string, WorkshopHelpSection>;
export type WorkshopHelpReferencePort = Pick<WorkshopHelpReference, 'load' | 'version'>;

export class WorkshopHelpReference {
  private loaded?: Promise<WorkshopHelpIndex | undefined>;

  constructor(
    private readonly files: Pick<FileSystem, 'readFile'>,
    private readonly directory: string,
    readonly version: string,
    private readonly log: LogSink
  ) {}

  load(): Promise<WorkshopHelpIndex | undefined> {
    this.loaded ??= this.build().catch(() => {
      this.log.appendLine('[WorkshopHelpReference] reference unavailable');
      return undefined;
    });
    return this.loaded;
  }

  private async build(): Promise<WorkshopHelpIndex> {
    const areas = await Promise.all(WORKSHOP_HELP_AREAS.map(async area => {
      const bytes = await this.files.readFile(path.join(this.directory, area + '.md'));
      const document = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n');
      if (area === 'overview' && /^Reference version: (\S+)$/m.exec(document)?.[1] !== this.version) {
        throw new Error('Reference version mismatch');
      }
      return parseSections(area, document);
    }));
    const sections = areas.flat();
    const index = new Map(sections.map(section => [section.id, section]));
    if (index.size !== sections.length) {
      throw new Error('Duplicate help section');
    }
    this.log.appendLine(`[WorkshopHelpReference] areas=${areas.length} sections=${index.size}`);
    return index;
  }
}

function parseSections(area: string, document: string): WorkshopHelpSection[] {
  const headings = [...document.matchAll(/^##[ \t]+(.+)$/gm)];
  if (!headings.length) {
    throw new Error('Empty help area');
  }
  return headings.map((match, i) => {
    const heading = match[1].trim();
    const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = area + '#' + slug;
    const body = document.slice(match.index + match[0].length, headings[i + 1]?.index).trim();
    const { sectionIdCharacters, sectionCharacters } = PROMPT_BUDGETS.workshopHelp;
    if (!slug || id.length > sectionIdCharacters || (`## ${heading}\n${body}`).length > sectionCharacters) {
      throw new Error('Invalid help section');
    }
    return { id, heading, body, searchText: normalizeWorkshopText(heading + '\n' + body) };
  });
}

export function searchWorkshopHelp(index: WorkshopHelpIndex, text: string) {
  const { searchHits, snippetCharacters } = PROMPT_BUDGETS.workshopHelp;
  const query = parseWorkshopQuery(text);
  const matcher = new WorkshopQueryMatcher(query);
  const heading = text.trim().toLowerCase();
  const ranked = [...index.values()].map(section => ({
    section,
    exact: section.heading.toLowerCase() === heading,
    rank: matcher.rank(section.searchText)
  }));
  const allTerms = ranked.some(({ rank }) => rank.matchedTerms === query.terms.length);
  const matches = ranked.filter(({ rank, exact }) =>
    exact || (rank.matchedTerms > 0 && (!allTerms || rank.matchedTerms === query.terms.length))
  ).sort((left, right) =>
    Number(right.exact) - Number(left.exact) ||
    right.rank.matchedTerms - left.rank.matchedTerms ||
    Number(right.rank.phrase) - Number(left.rank.phrase) ||
    right.rank.wholeWords - left.rank.wholeWords
  );
  const hits = matches.slice(0, searchHits).map(({ section }) => ({
    id: section.id, heading: section.heading,
    snippet: workshopSearchSnippet(section.body, matcher, snippetCharacters)
  }));
  return { hits, matched: matches.length };
}
