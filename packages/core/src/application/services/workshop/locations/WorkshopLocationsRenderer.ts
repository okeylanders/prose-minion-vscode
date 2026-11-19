/**
 * What a `locations.*` result says (ADR 2026-11-19 D26). Pure: the
 * capability asks the scan and the checker; this module writes the text.
 *
 * - **`locations.current`:** each group by its id and label, where its value
 *   comes from, its patterns, how many files they find (or that they could
 *   not be counted, D22a), and up to `examples` of them.
 * - **`locations.folders`:** `foldersPerPage` folders a page, in the scan's
 *   breadth-first order. The continuation is written exactly when a later
 *   page exists, and is that page's complete call on one line; a page past
 *   the end answers in words, with the last page and no call.
 * - **`locations.check`:** per group checked, the checker's answer: each
 *   pattern kept with its count, each dropped with its reason, the files in
 *   all, the files another group would share, and whether Apply would offer
 *   the group. It says that nothing was written.
 * - **Every call written here decodes as written** through the codec, and
 *   names a later page.
 * - Every name and pattern passes `workshopLocationsText`.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  CONTEXT_PATH_DROP_WORDS,
  CONTEXT_PATH_GROUP_LABELS,
  CONTEXT_PATH_NOT_OFFERED_WORDS
} from '@shared/constants/contextPathSuggestionWords';
import type {
  ContextPathGroup,
  ContextPathGroupView,
  ContextPathProposalView,
  ContextPathSettingLevel
} from '@shared/types';
import type { ProjectFolderSummary } from '@shared/types/projectFolders';
import { workshopCapabilityPageOf } from '@/application/services/workshop/WorkshopCapabilityPaging';
import { workshopLocationsBody, workshopLocationsText } from '@/application/services/workshop/locations/WorkshopLocationsCopy';

const number = (value: number): string => value.toLocaleString('en-US');
const count = (value: number, singular: string, plural = `${singular}s`): string =>
  `${number(value)} ${value === 1 ? singular : plural}`;
const text = workshopLocationsText;
const code = (value: string): string => `\`${text(value)}\``;
const files = (value: number | null): string => (value === null ? 'couldn\'t be counted completely' : count(value, 'file'));

/** A group as a persona names it: the id a pattern's `group` takes, and its label. */
export function workshopLocationsGroupName(group: ContextPathGroup): string {
  return `${group} (${CONTEXT_PATH_GROUP_LABELS[group]})`;
}

const LEVEL_WORDS: Readonly<Record<ContextPathSettingLevel, string>> = {
  default: 'the built-in default',
  user: 'the writer\'s own settings, for every project',
  workspace: 'this workspace\'s settings file, which Apply can\'t change',
  'workspace-folder': 'a workspace folder\'s settings file, which Apply can\'t change'
};

/** `locations.folders`' complete call for a page, on one line: what a continuation names. */
export function workshopLocationsFoldersCall(page: number): string {
  return `<prose-minion-tool-call name="locations.folders"><page>${page}</page></prose-minion-tool-call>`;
}

export function renderWorkshopLocationsCurrent(view: ContextPathProposalView): string {
  return workshopLocationsBody([
    'Each context-path group: its id (what a pattern\'s group names) and label, where its value comes from, its patterns, ' +
      'and the Markdown and text files they find now.',
    ...view.groups.map(currentRow)
  ]);
}

function currentRow(group: ContextPathGroupView): string {
  const { current } = group;
  return [
    `- ${workshopLocationsGroupName(group.group)}`,
    `from ${LEVEL_WORDS[group.level]}`,
    current.patterns.length > 0 ? `patterns ${current.patterns.map(code).join(', ')}` : 'no patterns',
    files(current.count),
    ...(current.examples.length > 0 ? [`for example ${current.examples.map(text).join(', ')}`] : [])
  ].join(' · ');
}

export interface WorkshopLocationsFolderScan {
  readonly folders: readonly ProjectFolderSummary[];
  /** The bounds the scan reached; empty when it read everything. */
  readonly stopped: readonly string[];
  readonly unreadable: number;
}

export interface WorkshopLocationsRenderedFolders {
  readonly content: string;
  readonly shown: number;
  readonly notShown: number;
  readonly page: number;
  readonly pages: number;
  readonly hint?: string;
}

export function renderWorkshopLocationsFolders(scan: WorkshopLocationsFolderScan, page = 1): WorkshopLocationsRenderedFolders {
  const total = scan.folders.length;
  const paged = workshopCapabilityPageOf(total, PROMPT_BUDGETS.contextPaths.foldersPerPage, page);
  const shown = scan.folders.slice(paged.start, paged.end);
  const notShown = total - paged.end;
  const hint = paged.next !== undefined ? workshopLocationsFoldersCall(paged.next) : undefined;
  const partial = scan.stopped.length > 0 || scan.unreadable > 0;
  const lines = [
    ...(paged.pastEnd
      ? [total === 0
        ? `Page ${number(page)} is past the end: no folder is listed.`
        : `Page ${number(page)} is past the end: ${count(total, 'folder')}, ${count(paged.pages, 'page')}.`]
      : total === 0
        ? [`No folder in ${partial ? 'what the scan read' : 'this project'} holds a Markdown or text file.`]
        : [
          `${folderRange(paged.start, paged.end, total, paged.pages)}, shallowest first, names only: each folder's path, ` +
            'how many Markdown and text files it holds itself, and a few of their names. `.` is the project\'s top folder.',
          ...shown.map(folderRow)
        ]),
    ...(scan.stopped.length > 0
      ? ['The scan stopped at one of its bounds, so the deepest folders are not listed.']
      : []),
    ...(scan.unreadable > 0 ? [`${count(scan.unreadable, 'folder')} couldn't be read, so ${scan.unreadable === 1 ? 'it is' : 'they are'} not listed.`] : []),
    ...(hint ? [`${count(notShown, 'more folder')}. The next page: ${hint}`] : [])
  ];
  return { content: workshopLocationsBody(lines), shown: shown.length, notShown, page, pages: paged.pages, ...(hint ? { hint } : {}) };
}

function folderRange(start: number, end: number, total: number, pages: number): string {
  return pages <= 1 ? count(total, 'folder') : `Folders ${number(start + 1)}–${number(end)} of ${number(total)}`;
}

function folderRow(folder: ProjectFolderSummary): string {
  return [
    `- ${text(folder.path)}`,
    `${number(folder.markdownFiles)} .md, ${number(folder.textFiles)} .txt`,
    ...(folder.sampleNames.length > 0 ? [folder.sampleNames.map(text).join(', ')] : [])
  ].join(' · ');
}

export function renderWorkshopLocationsCheck(view: ContextPathProposalView): string {
  const checked = view.groups.filter((group) => group.proposed);
  return workshopLocationsBody([
    'What the patterns would find, checked by the same rules the project\'s context paths are read by. ' +
      'Nothing was written: only the writer applies a proposal.',
    ...checked.flatMap(checkRows)
  ]);
}

function checkRows(group: ContextPathGroupView): string[] {
  const proposed = group.proposed!;
  const offer = group.offer.offered
    ? 'Apply would offer this group.'
    : `Apply would not offer it: ${CONTEXT_PATH_NOT_OFFERED_WORDS[group.offer.reason]}`;
  return [
    `- ${workshopLocationsGroupName(group.group)} · ${files(proposed.count)} in all · ${offer}`,
    `  Now: ${group.current.patterns.length > 0 ? group.current.patterns.map(code).join(', ') : 'no patterns'} · ${files(group.current.count)}`,
    ...proposed.kept.map((kept) => `  Kept: ${code(kept.pattern)} · ${count(kept.count, 'file')}`),
    ...proposed.dropped.map((dropped) => `  Left out: ${code(dropped.pattern)} · ${CONTEXT_PATH_DROP_WORDS[dropped.reason]}`),
    ...(proposed.examples.length > 0 ? [`  For example: ${proposed.examples.map(text).join(', ')}`] : []),
    ...(proposed.shared.count > 0
      ? [`  Shared: ${count(proposed.shared.count, 'file')} another group also finds` +
        (proposed.shared.examples.length > 0
          ? `, such as ${proposed.shared.examples.map((shared) => `${text(shared.path)} (${shared.groups.join(', ')})`).join('; ')}`
          : '')]
      : [])
  ];
}
