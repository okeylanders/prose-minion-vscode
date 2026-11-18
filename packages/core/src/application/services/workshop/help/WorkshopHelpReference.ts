/** The bundled reference is immutable for this extension installation. Index it once it reads, on first use. */
import * as path from 'path';
import type { FileSystem, LogSink } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  normalizeWorkshopText,
  parseWorkshopQuery,
  WorkshopQueryMatcher,
  type WorkshopQuery,
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

/** The indexed reference, and the version its overview says it describes. */
export interface WorkshopHelpLoaded {
  readonly referenceVersion: string;
  readonly sections: WorkshopHelpIndex;
}

export type WorkshopHelpReferencePort = Pick<WorkshopHelpReference, 'load' | 'version' | 'referenceVersion'>;

/** A release version, so the line the log repeats is never free text. */
const REFERENCE_VERSION = /^Reference version: (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/m;

export class WorkshopHelpReference {
  /** The load in flight, or the one that succeeded. A failure is never kept: the next call reads again. */
  private loading?: Promise<WorkshopHelpLoaded | undefined>;
  /** Whether the last load failed, so a run of failures logs once and a success ends the run. */
  private failing = false;
  /** The version the reference describes, once a load has read it; never the installed version. */
  private loadedVersion?: string;

  constructor(
    private readonly files: Pick<FileSystem, 'readFile'>,
    private readonly directory: string,
    /** The installed extension's version; the reference names its own. */
    readonly version: string,
    private readonly log: LogSink
  ) {}

  /** The reference's own version when a load has read it; undefined before then. Never reads. */
  referenceVersion(): string | undefined {
    return this.loadedVersion;
  }

  load(): Promise<WorkshopHelpLoaded | undefined> {
    this.loading ??= this.build().then(
      loaded => {
        this.failing = false;
        this.loadedVersion = loaded.referenceVersion;
        return loaded;
      },
      () => {
        this.loading = undefined;
        if (!this.failing) {
          this.failing = true;
          this.log.appendLine('[WorkshopHelpReference] reference unavailable');
        }
        return undefined;
      }
    );
    return this.loading;
  }

  private async build(): Promise<WorkshopHelpLoaded> {
    let referenceVersion = '';
    const areas = await Promise.all(WORKSHOP_HELP_AREAS.map(async area => {
      const bytes = await this.files.readFile(path.join(this.directory, area + '.md'));
      const document = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n');
      if (area === 'overview') {
        referenceVersion = REFERENCE_VERSION.exec(document)?.[1] ?? '';
        if (!referenceVersion) {
          throw new Error('Missing reference version');
        }
      }
      return parseSections(area, document);
    }));
    const sections = areas.flat();
    const index = new Map(sections.map(section => [section.id, section]));
    if (index.size !== sections.length) {
      throw new Error('Duplicate help section');
    }
    this.log.appendLine(`[WorkshopHelpReference] areas=${areas.length} sections=${index.size}`);
    if (referenceVersion !== this.version) {
      // A caveat, not a refusal: every result names the version it describes (the sync test is the gate).
      this.log.appendLine(`[WorkshopHelpReference] version mismatch reference=${referenceVersion} installed=${this.version}`);
    }
    return { referenceVersion, sections: index };
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

/**
 * The query as help searches it: terms past the limit leave the phrase too, so a
 * word the result calls "Not searched" can never move a section. Recall keeps the
 * shared parser's whole phrase.
 */
function keptTermsQuery(query: WorkshopQuery): WorkshopQuery {
  const overflow = new Set(query.overflowTerms);
  return overflow.size === 0 ? query : { ...query, phrase: query.phrase.filter(word => !overflow.has(word)) };
}

export function searchWorkshopHelp(index: WorkshopHelpIndex, text: string) {
  const { searchHits, snippetCharacters } = PROMPT_BUDGETS.workshopHelp;
  const query = keptTermsQuery(parseWorkshopQuery(text));
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
  // Terms past the query limit are never searched; the result names them.
  return { hits, matched: matches.length, ignoredTerms: query.overflowTerms };
}
