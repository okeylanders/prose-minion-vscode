/**
 * The Memory tab as drawn (Slice 0d's "The Memory tab" and its states).
 * Pure: the mode draft, the workspace, the host's estimate and the files
 * that need attention in; every word and figure the panel draws out.
 *
 * - "Set" is not "loaded" (decision 17, PR #196 F-05): over the budget the
 *   meter states what was requested apart from what loaded, and the loaded
 *   figure is the builder's, never above the budget.
 * - Unavailable is not a mode (decision 3, ADR D8): it never disables the
 *   mode cards, only this workspace's memory and its buttons.
 * - The well's numbers are the budgets' (decision 15), never literals.
 */

import type {
  WorkshopMemoryBudgets,
  WorkshopMemoryConflict,
  WorkshopMemoryFrameEstimate,
  WorkshopMemoryUnreadableFile,
  WorkshopMemoryWorkspace,
  WorkshopProjectMemoryMode
} from './workshopMemoryViewInputs';
import { WORKSHOP_MEMORY_BUDGETS } from './workshopMemoryViewInputs';
import {
  aboutTokens,
  filesWord,
  memoriesWord,
  memoryCount,
  unreadableReasonWords,
  WORKSHOP_MEMORY_SET_ASIDE
} from './workshopMemoryWords';

export interface WorkshopMemoryTabInput {
  /** The mode draft: what Apply would write. */
  readonly mode: WorkshopProjectMemoryMode;
  readonly workspace: WorkshopMemoryWorkspace;
  /** The frame builder's estimate; absent until the host answers. */
  readonly estimate?: WorkshopMemoryFrameEstimate;
  /** Readable memories in the folder, in effect or not: what "N saved" counts. */
  readonly saved: number;
  readonly unreadable: readonly WorkshopMemoryUnreadableFile[];
  readonly conflicts: readonly WorkshopMemoryConflict[];
  readonly budgets?: WorkshopMemoryBudgets;
}

export interface WorkshopMemoryModeCard {
  readonly mode: WorkshopProjectMemoryMode;
  readonly name: string;
  readonly description: string;
  readonly recommended: boolean;
  readonly selected: boolean;
}

export interface WorkshopMemoryMeterView {
  readonly key: 'full' | 'list';
  /** The caption's left and right halves. */
  readonly left: string;
  readonly right: string;
  /** Filled share, 0–100. */
  readonly percent: number;
  /** Drawn amber and full: the budget is spent or passed. */
  readonly full: boolean;
  /** The meter's value against its budget, for assistive technology. */
  readonly value: number;
  readonly max: number;
  readonly valueText: string;
}

export interface WorkshopMemoryLoadView {
  readonly name: string;
  readonly description: string;
  readonly chips: ReadonlyArray<{ readonly text: string; readonly quiet: boolean }>;
  readonly meters: readonly WorkshopMemoryMeterView[];
  /** The amber lines under the row: what doesn't fit, and where it went. */
  readonly more: readonly string[];
}

export interface WorkshopMemoryAttentionView {
  readonly title: string;
  readonly description: string;
  readonly files: ReadonlyArray<{ readonly entryKey: string; readonly fileName: string; readonly reason: string }>;
}

export interface WorkshopMemoryTabView {
  readonly notice?: { readonly title: string; readonly text: string };
  readonly well: {
    readonly memorySize: string;
    readonly contextSize: string;
  };
  readonly cards: readonly WorkshopMemoryModeCard[];
  readonly load: WorkshopMemoryLoadView;
  readonly folder: { readonly description: string; readonly locked: boolean };
  readonly attention?: WorkshopMemoryAttentionView;
}

const MODE_CARDS: ReadonlyArray<Omit<WorkshopMemoryModeCard, 'selected'>> = [
  {
    mode: 'off',
    name: 'Off',
    description: 'Personas start each conversation without project memory, and they don’t suggest new ones.',
    recommended: false
  },
  {
    mode: 'ask',
    name: 'Ask first',
    description: 'A persona can suggest a memory under its reply. It’s saved only when you choose Save.',
    recommended: true
  },
  {
    mode: 'auto',
    name: 'Save and tell me',
    description: 'Personas save what’s worth keeping and say so in the thread. Edit or forget any of it there.',
    recommended: false
  }
];

const UNAVAILABLE_NOTICE: Record<'no-workspace' | 'multi-root', string> = {
  'no-workspace': 'No folder is open, so there’s no project to keep memories in.',
  'multi-root': 'This workspace has several folders, so memory can’t tell which project it belongs to.'
};

export function workshopMemoryTabView(input: WorkshopMemoryTabInput): WorkshopMemoryTabView {
  const budgets = input.budgets ?? WORKSHOP_MEMORY_BUDGETS;
  const workspace = input.workspace;
  const unavailable = workspace.kind === 'unavailable';
  return {
    ...(workspace.kind === 'unavailable'
      ? {
        notice: {
          title: 'Project memory isn’t available here.',
          text: `${UNAVAILABLE_NOTICE[workspace.reason]} Open a single folder to use project memory. The mode above still applies to your other projects.`
        }
      }
      : {}),
    well: {
      memorySize: `Kept small: about ${memoryCount(budgets.pinnedTokens + budgets.catalogTokens)} tokens in all`,
      contextSize: `Much larger: up to ${memoryCount(budgets.contextWords)} words`
    },
    cards: MODE_CARDS.map((card) => ({ ...card, selected: card.mode === input.mode })),
    load: loadView(input, budgets),
    folder: {
      description: unavailable
        ? 'Available once memory belongs to one project folder.'
        : input.saved === 0 && workspace.kind === 'available'
          ? 'One Markdown file per memory. The folder is made when the first memory is saved, or when you open it.'
          : 'One Markdown file per memory. You can read and edit them in VS Code.',
      locked: unavailable
    },
    ...(workspace.kind === 'available' ? attentionView(input.unreadable, input.conflicts) : {})
  };
}

function loadView(input: WorkshopMemoryTabInput, budgets: WorkshopMemoryBudgets): WorkshopMemoryLoadView {
  const quiet = (text: string) => ({ text, quiet: true });
  switch (input.workspace.kind) {
    case 'unavailable':
      return {
        name: 'Nothing loads',
        description: 'Personas in this workspace get no project memory, whatever the mode above says.',
        chips: [quiet('unavailable')],
        meters: [],
        more: []
      };
    case 'loading':
      return { name: 'Reading this project’s memories…', description: '', chips: [], meters: [], more: [] };
    case 'unknown':
      return {
        name: 'This project’s memory folder couldn’t be listed',
        description: 'The folder couldn’t be listed just now, so nothing from it is shown. Your memory files weren’t touched.',
        chips: [],
        meters: [],
        more: []
      };
    case 'available':
      break;
  }
  if (input.mode === 'off') {
    return {
      name: 'Nothing loads while memory is off',
      description: input.saved === 0
        ? 'There are no saved memories yet.'
        : 'Memory is off in every project. This project’s memories stay in its folder, and you can still manage them.',
      chips: [quiet(input.saved === 0 ? 'no memories' : `${memoryCount(input.saved)} saved`)],
      meters: [],
      more: []
    };
  }
  if (input.saved === 0) {
    const also = 'You can also say “remember that…”, or choose Save to memory… on any message.';
    return {
      name: 'No memories yet',
      description: input.mode === 'auto'
        ? `Personas save what’s worth keeping as you work. ${also}`
        : `When a persona suggests a memory, it appears under its reply for you to save. ${also}`,
      chips: [quiet('0 memories')],
      meters: [],
      more: []
    };
  }
  const estimate = input.estimate;
  if (!estimate) {
    return { name: 'Reading this project’s memories…', description: '', chips: [], meters: [], more: [] };
  }
  if (estimate.memories === 0) {
    return {
      name: 'No memories are active',
      description: 'Every memory in this project is archived or replaced by a newer one, so none loads. Restore an archived one in Manage memories… to make it active again.',
      chips: [quiet('0 active')],
      meters: [],
      more: []
    };
  }
  return estimateLoadView(estimate, budgets);
}

function estimateLoadView(estimate: WorkshopMemoryFrameEstimate, budgets: WorkshopMemoryBudgets): WorkshopMemoryLoadView {
  const notLoaded = Math.max(0, estimate.pinned - estimate.pinnedLoaded);
  const candidates = Math.max(0, estimate.memories - estimate.pinnedLoaded);
  const listOver = estimate.catalogEntries < candidates;
  const hidden = candidates - estimate.catalogEntries;
  const meters = [fullMeter(estimate, notLoaded, budgets), listMeter(estimate, candidates, listOver, budgets)];
  const more = [
    ...(estimate.pinnedOver && notLoaded > 0
      ? [`${notLoaded === 1 ? '1 memory set to load in full doesn’t fit, so it loads as a list entry' : `${memoryCount(notLoaded)} memories set to load in full don’t fit, so they load as list entries`}. Turn off Always load in full on one in Manage memories… to make room.`]
      : []),
    ...(listOver
      ? [`${memoryCount(hidden)} more ${hidden === 1 ? 'is' : 'are'} searchable. Personas find them with memory search when the conversation needs them.`]
      : [])
  ];
  const chip = (text: string) => ({ text, quiet: false });

  if (estimate.pinnedOver) {
    return {
      name: 'Memories set to load in full first, then the rest',
      description: `Each persona sees the ${memoryCount(estimate.pinnedLoaded)} of them that fit in full, and the title and summary of ${listOver ? 'the others that fit' : 'every other memory'}.`,
      chips: [
        chip(memoriesWord(estimate.memories)),
        chip(`${memoryCount(estimate.pinnedLoaded)} of ${memoryCount(estimate.pinned)} in full`),
        chip(`≈ ${aboutTokens(estimate.frameTokens)} tokens at the start`)
      ],
      meters,
      more
    };
  }
  const chips = [
    chip(memoriesWord(estimate.memories)),
    chip(`${memoryCount(estimate.pinnedLoaded)} in full`),
    chip(`≈ ${aboutTokens(estimate.frameTokens)} tokens`)
  ];
  if (listOver) {
    const full = estimate.pinnedLoaded > 0 ? `, and the ${memoryCount(estimate.pinnedLoaded)} set to load in full` : '';
    return {
      name: 'Memories loaded in full first, then the most recent',
      description: `Each persona sees the title and summary of the memories that fit${full}. Choose Always load in full for the ones every conversation needs.`,
      chips,
      meters,
      more
    };
  }
  const loaded = estimate.pinnedLoaded;
  return {
    name: 'Every memory’s title and summary',
    description: loaded === 0
      ? 'Each persona opens a full note when the conversation needs it.'
      : `Each persona also sees the ${loaded === 1 ? '1 memory' : `${memoryCount(loaded)} memories`} set to load in full, and opens the rest when the conversation needs them.`,
    chips,
    meters,
    more
  };
}

function fullMeter(estimate: WorkshopMemoryFrameEstimate, notLoaded: number, budgets: WorkshopMemoryBudgets): WorkshopMemoryMeterView {
  const budget = memoryCount(budgets.pinnedTokens);
  const loadedTokens = Math.min(estimate.pinnedLoadedTokens, budgets.pinnedTokens);
  if (estimate.pinnedOver) {
    const requested = aboutTokens(estimate.pinnedTokens, true);
    const loaded = aboutTokens(loadedTokens);
    const fits = notLoaded === 1 ? '1 doesn’t fit' : `${memoryCount(notLoaded)} don’t fit`;
    return {
      key: 'full',
      left: `Set to load in full · ${memoryCount(estimate.pinned)} · ${fits}`,
      right: `about ${requested} requested · ${loaded} of ${budget} loaded`,
      percent: 100,
      full: true,
      value: loadedTokens,
      max: budgets.pinnedTokens,
      valueText: `Set to load in full: ${memoryCount(estimate.pinned)}, about ${requested} tokens requested; about ${loaded} of ${budget} loaded; ${fits}`
    };
  }
  const about = aboutTokens(loadedTokens);
  return {
    key: 'full',
    left: `Loaded in full · ${memoryCount(estimate.pinnedLoaded)}`,
    right: `about ${about} of ${budget} tokens`,
    percent: percentOf(loadedTokens, budgets.pinnedTokens),
    full: false,
    value: loadedTokens,
    max: budgets.pinnedTokens,
    valueText: `Loaded in full: ${memoryCount(estimate.pinnedLoaded)}, about ${about} of ${budget} tokens`
  };
}

function listMeter(
  estimate: WorkshopMemoryFrameEstimate,
  candidates: number,
  listOver: boolean,
  budgets: WorkshopMemoryBudgets
): WorkshopMemoryMeterView {
  const budget = memoryCount(budgets.catalogTokens);
  const tokens = Math.min(estimate.catalogTokens, budgets.catalogTokens);
  const about = aboutTokens(tokens);
  const fits = listOver
    ? `${memoryCount(estimate.catalogEntries)} of ${memoryCount(candidates)} fit`
    : candidates === 0 ? 'none to list' : `all ${memoryCount(candidates)} fit`;
  return {
    key: 'list',
    left: `Titles and summaries · ${fits}`,
    right: `about ${about} of ${budget} tokens`,
    percent: listOver ? 100 : percentOf(tokens, budgets.catalogTokens),
    full: listOver,
    value: tokens,
    max: budgets.catalogTokens,
    valueText: `Titles and summaries: ${fits}, about ${about} of ${budget} tokens`
  };
}

function percentOf(value: number, max: number): number {
  if (max <= 0 || value <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(1, Math.round((value / max) * 100)));
}

function attentionView(
  unreadable: readonly WorkshopMemoryUnreadableFile[],
  conflicts: readonly WorkshopMemoryConflict[]
): { attention?: WorkshopMemoryAttentionView } {
  const conflictFiles = conflicts.flatMap((conflict) => conflict.files.map((file) => ({
    entryKey: file.entryKey,
    fileName: file.fileName,
    reason: 'same id as another file'
  })));
  const files = [
    ...unreadable.map((file) => ({ entryKey: file.entryKey, fileName: file.fileName, reason: unreadableReasonWords(file.reason, file.key, true) })),
    ...conflictFiles
  ];
  if (files.length === 0) {
    return {};
  }
  // A set-aside copy isn't a file to fix: like a conflict, it reads as needing attention.
  const onlyUnreadable = conflictFiles.length === 0 && unreadable.every((file) => file.reason !== WORKSHOP_MEMORY_SET_ASIDE);
  return {
    attention: {
      title: onlyUnreadable
        ? `${filesWord(files.length)} can’t be read`
        : `${filesWord(files.length)} ${files.length === 1 ? 'needs' : 'need'} attention`,
      description: onlyUnreadable
        ? 'They aren’t loaded, and personas can’t find them. Fix the frontmatter in the editor, or move the file out of the folder. Nothing else is affected.'
        : 'They aren’t loaded, and personas can’t find them. Fix them in the editor; Memory never rewrites them. Nothing else is affected.',
      files
    }
  };
}
