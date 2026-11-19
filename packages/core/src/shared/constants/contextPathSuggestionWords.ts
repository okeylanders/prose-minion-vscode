/**
 * The words a context-path proposal is shown in (ADR 2026-11-19 D22–D25):
 * one fixed phrase per reason, shared by the Settings sheet now and the
 * room's card later (C2), so the two never word a reason differently.
 * Exhaustive `Record`s over the closed reason lists: a new reason does not
 * compile without its words.
 */

import type {
  ContextPathGroup,
  ContextPathLeftReason,
  ContextPathNotOffered,
  ContextPathPatternDrop,
  ContextPathsSuggestionOutcome
} from '@shared/types';

export const CONTEXT_PATH_GROUP_LABELS: Readonly<Record<ContextPathGroup, string>> = {
  characters: 'Characters',
  locations: 'Locations & Settings',
  themes: 'Themes',
  things: 'Things / Props',
  chapters: 'Draft Chapters & Outlines',
  manuscript: 'Manuscript Chapters',
  projectBrief: 'Project Brief Materials',
  general: 'General References'
};

/** Why a proposed pattern was not kept. */
export const CONTEXT_PATH_DROP_WORDS: Readonly<Record<ContextPathPatternDrop, string>> = {
  empty: 'empty',
  comma: 'holds a comma, which would split the setting',
  absolute: 'starts at the top of the disk',
  drive: 'names a drive',
  home: 'starts at the home folder',
  'workspace-prefix': 'starts with workspace:',
  'parent-segment': 'climbs out of the project with ..',
  backslash: 'holds a backslash',
  'control-character': 'holds a control character',
  'too-long': 'too long',
  duplicate: 'listed twice',
  'over-cap': 'past the most patterns a group takes',
  unmatched: 'matches no file',
  incomplete: 'couldn\'t be checked completely'
};

/** Why a group is shown and not offered. */
export const CONTEXT_PATH_NOT_OFFERED_WORDS: Readonly<Record<ContextPathNotOffered, string>> = {
  'not-proposed': 'Not proposed; it keeps its patterns.',
  'nothing-kept': 'Nothing proposed matched a file; it keeps its patterns.',
  incomplete: 'Couldn\'t be checked completely; left as it is.',
  'workspace-set': 'Set for this workspace in its settings file, so Apply can\'t change it here.',
  unchanged: 'The proposal is what it has already.'
};

/** Why a ticked group was left at Apply; `{group}` is the group's label. */
export const CONTEXT_PATH_LEFT_WORDS: Readonly<Record<ContextPathLeftReason, string>> = {
  'not-offered': '{group} wasn\'t offered, so it was left as it is.',
  'workspace-set': '{group} is set for this workspace in its settings file, so it was left as it is.',
  changed: '{group} changed since this was suggested; it was left as it is.',
  incomplete: '{group} couldn\'t be checked again completely; it was left as it is.',
  'matches-changed': '{group}\'s files changed since this was suggested; it was left as it is. Suggest again to see them.',
  'write-failed': '{group} couldn\'t be saved; it was left as it is.',
  'not-reached': '{group} wasn\'t tried after an earlier group couldn\'t be saved.'
};

/** The one quiet line a suggestion that proposes nothing to review leaves. */
export const CONTEXT_PATH_SUGGESTION_WORDS: Readonly<Record<Exclude<ContextPathsSuggestionOutcome, 'proposed'>, string>> = {
  'nothing-proposed': 'The suggestion proposed nothing; your context paths are as they were.',
  'no-workspace': 'Open a project folder to suggest context paths from it.',
  'no-folders': 'No folder in this project holds a Markdown or text file yet.',
  'scan-incomplete': 'Some folders couldn\'t be read, and none of the rest holds a Markdown or text file; nothing was suggested. Your context paths are as they were.',
  unconfigured: 'Add your OpenRouter API key to suggest context paths.',
  cancelled: 'The suggestion was stopped.',
  failed: 'The suggestion didn\'t work this time; your context paths are as they were.'
};

/** What Apply means at the user level (ADR 2026-11-19 D19, L1). */
export const CONTEXT_PATH_APPLIES_TO_ALL = 'Applies to all your projects.';

/** The section's one line when every group matches nothing in this project. */
export const CONTEXT_PATH_EVERY_GROUP_EMPTY = 'None of these paths finds a file in this project yet. Suggest from my folders can propose some from your folder names.';

export function contextPathLeftWords(group: ContextPathGroup, reason: ContextPathLeftReason): string {
  return CONTEXT_PATH_LEFT_WORDS[reason].replace('{group}', CONTEXT_PATH_GROUP_LABELS[group]);
}
