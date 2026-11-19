/**
 * The helper's `project-locations` task (ADR 2026-11-19 D21, amending ADR
 * 2026-11-05 D6): from the names-only folder scan, glob patterns per
 * context-path group. Started only by the Settings button "Suggest from my
 * folders"; the writer reviews the checked proposal before anything is
 * written, and the helper never writes a setting.
 *
 * - **Input:** the scan's folders (path, `.md` and `.txt` counts, a few
 *   names), at most `folders` of them and within `inputCharacters` as JSON,
 *   and each group's name and what it holds. Names only, never contents.
 * - **Answer:** `{ "groups": { "<group>": ["<pattern>", …] } }`, exact. A
 *   group key outside `CONTEXT_PATH_GROUPS` is a fault; a group left out
 *   (or given no patterns) keeps its patterns. The checker, not this
 *   decoder, judges each pattern.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CONTEXT_PATH_GROUPS, isContextPathGroup, type ContextPathGroup } from '@shared/types/context';
import type { ProjectFolderSummary } from '@shared/types/projectFolders';
import { helperExactFields, type HelperDecoded, type HelperTaskPolicy } from '@services/helper/HelperTaskPolicy';

/** What each group holds, in the words the helper reads. */
export const PROJECT_LOCATION_GROUP_MEANINGS: Readonly<Record<ContextPathGroup, string>> = {
  characters: 'character sheets, biographies and arc notes',
  locations: 'places, settings and world-building notes',
  themes: 'theme notebooks and motif tracking',
  things: 'notable objects, artifacts and props',
  chapters: 'working drafts, chapter outlines and scene sketches',
  manuscript: 'polished manuscript chapters',
  projectBrief: 'the project brief: synopsis, pitch, query letter, overview',
  general: 'general reference: research, style and tone guides, series bible'
};

export interface ProjectLocationsInput {
  readonly folders: readonly ProjectFolderSummary[];
  /** The scan reached a bound and left its deepest folders out. */
  readonly scanStopped: boolean;
}

export interface ProjectLocationsProposal {
  /** Per group, the patterns proposed, as written. A group absent keeps its patterns. */
  readonly groups: Partial<Record<ContextPathGroup, readonly string[]>>;
}

const BUDGET = PROMPT_BUDGETS.helper['project-locations'];

function folderData(folder: ProjectFolderSummary): Readonly<Record<string, unknown>> {
  return {
    path: folder.path,
    markdownFiles: folder.markdownFiles,
    textFiles: folder.textFiles,
    sampleNames: [...folder.sampleNames]
  };
}

/** How many of the scan's folders are sent: at most `folders`, and the whole request within `inputCharacters`. */
export function projectLocationsFoldersSent(input: ProjectLocationsInput): number {
  let sent = Math.min(input.folders.length, BUDGET.folders);
  while (sent > 0 && JSON.stringify(projectLocationsData(input, sent)).length > BUDGET.inputCharacters) {
    sent -= 1;
  }
  return sent;
}

function projectLocationsData(input: ProjectLocationsInput, sent: number): Readonly<Record<string, unknown>> {
  return {
    groups: CONTEXT_PATH_GROUPS.map((name) => ({ name, holds: PROJECT_LOCATION_GROUP_MEANINGS[name] })),
    folders: input.folders.slice(0, sent).map(folderData),
    foldersLeftOut: input.folders.length - sent,
    scanStopped: input.scanStopped
  };
}

export function buildProjectLocationsInput(input: ProjectLocationsInput): Readonly<Record<string, unknown>> {
  return projectLocationsData(input, projectLocationsFoldersSent(input));
}

export function decodeProjectLocations(root: Readonly<Record<string, unknown>>): HelperDecoded<ProjectLocationsProposal> {
  const shape = helperExactFields(root, ['groups']);
  if (shape) {
    return { ok: false, fault: shape };
  }
  const answer = root.groups;
  if (typeof answer !== 'object' || answer === null || Array.isArray(answer)) {
    return { ok: false, fault: 'wrong-type' };
  }
  const groups: Partial<Record<ContextPathGroup, readonly string[]>> = {};
  for (const [key, value] of Object.entries(answer as Record<string, unknown>)) {
    if (!isContextPathGroup(key)) {
      return { ok: false, fault: 'outside-vocabulary' };
    }
    if (!Array.isArray(value) || value.some((pattern) => typeof pattern !== 'string')) {
      return { ok: false, fault: 'wrong-type' };
    }
    if (value.length > 0) {
      groups[key] = [...(value as string[])];
    }
  }
  return { ok: true, value: { groups } };
}

export const PROJECT_LOCATIONS_POLICY: HelperTaskPolicy<ProjectLocationsInput, ProjectLocationsProposal> = {
  promptSection: 'helper/10-project-locations.md',
  buildInput: buildProjectLocationsInput,
  describeInput: (input) => {
    const sent = projectLocationsFoldersSent(input);
    return { folders: sent, 'folders left out': input.folders.length - sent };
  },
  decode: decodeProjectLocations,
  call: {
    temperature: 0,
    outputTokens: BUDGET.outputTokens,
    responseCharacters: BUDGET.responseCharacters,
    timeoutMs: 30_000
  }
};
