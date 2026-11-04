/**
 * The text of `memory.catalog`, `memory.search` and `memory.read` results
 * (ADR 2026-11-04 D1, D2, D3). Pure: the library returns data, and this
 * writes what a persona reads. Every body opens with D2's one line, so the
 * framing travels with published evidence. The persona capability escapes
 * the whole body as evidence; nothing here is markup a model can follow.
 *
 * Unreadable and conflicting files never appear: the library never lists
 * them, so no renderer can show one.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';
import type { WorkshopMemorySearchStatus } from '@shared/types/workshopCapabilities';
import {
  compareProjectMemoryCatalogOrder,
  isProjectMemoryInEffect,
  type ProjectMemoryListed,
  type ProjectMemoryReadItem
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import type { ProjectMemorySearchOutcome } from '@/application/services/workshop/memory/WorkshopProjectMemorySearch';
import {
  memoryBody,
  projectMemoryDay,
  projectMemoryProvenanceLine
} from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';

export interface WorkshopProjectMemoryRenderedCatalog {
  readonly content: string;
  readonly shown: number;
  /** In effect and of the kind asked, but past the catalog's entry bound. */
  readonly notShown: number;
}

/** The live catalog (D1): memories in effect, pinned first, then newest; it can differ from the room's frame. */
export function renderWorkshopProjectMemoryCatalog(
  memories: readonly ProjectMemoryListed[],
  kind?: ProjectMemoryKind
): WorkshopProjectMemoryRenderedCatalog {
  const inEffect = memories.filter(isProjectMemoryInEffect);
  const matching = inEffect.filter((listed) => kind === undefined || listed.memory.kind === kind).sort(compareProjectMemoryCatalogOrder);
  const shown = matching.slice(0, PROMPT_BUDGETS.workshopProjectMemory.catalogEntries);
  const superseded = memories.filter((listed) => listed.memory.status === 'active' && listed.superseded).length;
  const archived = memories.filter((listed) => listed.memory.status === 'archived').length;
  const lines = [
    'This is the live catalog of this project\'s notes; it can differ from the notes listed at the start of this conversation.',
    shown.length === 0
      ? kind ? `No note of kind ${kind} is in effect.` : 'No note is in effect.'
      : `${count(shown.length, 'note')} in effect${kind ? ` of kind ${kind}` : ''}, pinned first, then newest:`,
    ...shown.map(catalogLine),
    ...(matching.length > shown.length ? [`${count(matching.length - shown.length, 'more note')} in effect: use memory.search to find them.`] : []),
    ...(superseded + archived > 0
      ? [`Not listed: ${count(superseded, 'superseded note')} and ${count(archived, 'archived note')}; memory.search with <status>all</status> finds them.`]
      : [])
  ];
  return { content: memoryBody(lines), shown: shown.length, notShown: matching.length - shown.length };
}

export function renderWorkshopProjectMemorySearch(
  outcome: ProjectMemorySearchOutcome,
  status: WorkshopMemorySearchStatus
): string {
  const among = status === 'active' ? 'notes in effect' : status === 'all' ? 'all notes' : `${status} notes`;
  if (outcome.hits.length === 0) {
    return memoryBody([`No match among ${count(outcome.searched, 'note')} searched (${among}).`]);
  }
  return memoryBody([
    outcome.mode === 'any-term'
      ? `No note holds every word, so these hold some of them (${among}):`
      : `Notes holding every word (${among}):`,
    ...outcome.hits.flatMap(({ listed, snippet }) => [`- ${headline(listed)}: ${listed.memory.title}`, `  ${snippet}`]),
    ...(outcome.matched > outcome.hits.length
      ? [`${count(outcome.matched - outcome.hits.length, 'more match', 'more matches')} not shown; narrow the query.`]
      : []),
    'Read a note whole with memory.read and its id.'
  ]);
}

export interface WorkshopProjectMemoryRenderedRead {
  readonly content: string;
  /** The memories read whole, in the order asked: each one a "Project note" row. */
  readonly read: readonly ProjectMemoryListed[];
  /** Whole memories left out because the read's character budget ran out. */
  readonly notReadForSpace: readonly string[];
}

/** Each named memory whole, in the order asked, up to `readCharacters` across the call; none is cut. */
export function renderWorkshopProjectMemoryRead(
  items: readonly ProjectMemoryReadItem[],
  readCharacters: number = PROMPT_BUDGETS.workshopProjectMemory.readCharacters
): WorkshopProjectMemoryRenderedRead {
  const blocks: string[] = [];
  const read: ProjectMemoryListed[] = [];
  const notReadForSpace: string[] = [];
  let spent = 0;
  for (const item of items) {
    switch (item.kind) {
      case 'memory': {
        const block = memoryBlock(item);
        if (spent + block.length > readCharacters) {
          notReadForSpace.push(item.listed.memory.id);
          blocks.push(`${item.listed.memory.id}: not shown; this read reached its ${readCharacters.toLocaleString('en-US')}-character limit. Read it on its own.`);
          continue;
        }
        spent += block.length;
        read.push(item.listed);
        blocks.push(block);
        break;
      }
      case 'unknown':
        blocks.push(`${item.id}: no note in this project has this id. Copy ids exactly as a catalog or search shows them.`);
        break;
      case 'busy':
        blocks.push(`${item.id}: being edited in another window; try again.`);
        break;
      case 'unreadable':
        blocks.push(`${item.id}: could not be read just now; try again.`);
        break;
      default:
        return assertNever(item);
    }
  }
  return { content: memoryBody(blocks), read, notReadForSpace };
}

function memoryBlock(item: Extract<ProjectMemoryReadItem, { kind: 'memory' }>): string {
  const { memory, supersededBy } = item.listed;
  const provenance = projectMemoryProvenanceLine(item.provenance);
  return [
    `Note ${headline(item.listed)}`,
    `title: ${memory.title}`,
    `summary: ${memory.summary}`,
    `created: ${projectMemoryDay(memory.created)}; saved by: ${savedBy(memory.origin, memory.proposedBy)}`,
    ...(memory.supersedes.length > 0 ? [`supersedes: ${memory.supersedes.join(', ')}`] : []),
    ...(supersededBy.length > 0 ? [`superseded by: ${supersededBy.join(', ')}; that note is the one in effect.`] : []),
    ...(provenance ? [provenance] : []),
    'body:',
    memory.body.trim().length > 0 ? memory.body.trim() : '(no body)',
    `end of note ${memory.id}`
  ].join('\n');
}

/** "mem-7f3c2a · canon · active · pinned · updated 2026-11-03". */
function headline(listed: ProjectMemoryListed): string {
  const standing = listed.memory.status === 'archived' ? 'archived' : listed.superseded ? 'superseded' : 'active';
  return [listed.memory.id, listed.memory.kind, standing, ...(listed.memory.pinned ? ['pinned'] : []), `updated ${projectMemoryDay(listed.memory.updated)}`]
    .join(' · ');
}

function catalogLine(listed: ProjectMemoryListed): string {
  return `- ${headline(listed)}: ${listed.memory.title}: ${listed.memory.summary}`;
}

function savedBy(origin: string, proposedBy: string | undefined): string {
  switch (origin) {
    case 'writer':
      return 'the writer';
    case 'proposed':
      return `the writer, on ${proposedBy ?? 'a persona'}'s proposal`;
    case 'auto':
      return `automatically, on ${proposedBy ?? 'a persona'}'s proposal`;
    default:
      return origin;
  }
}

function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value.toLocaleString('en-US')} ${value === 1 ? singular : plural}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled memory read item: ${JSON.stringify(value)}`);
}
