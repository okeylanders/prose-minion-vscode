/**
 * `locationsProposal` on a persisted turn (ADR 2026-11-19 D27): optional,
 * additive and exact, on a host or guest reply only, with no
 * `schemaVersion` bump (ADR 2026-07-30). Forward only: an older build's
 * strict reader refuses a session that holds it.
 *
 * Every closed word is checked against a `Record` over its union, so a new
 * reason does not compile until this codec reads it. Lengths are bounded by
 * `PROMPT_BUDGETS.contextPaths` and `WORKSHOP_LOCATIONS_CARD_LIMITS`, the
 * one table the producer (`settleWorkshopReplyLocations`) bounds a card by
 * too, so a card the room commits always restores (PR #290 P2).
 *
 * **What is drawn is what Apply writes** (PR #290 P1). A card's parts must
 * agree (`workshopLocationsCardMismatch`): every group once, in order; each
 * baseline the value its group's current patterns were read from; the
 * patterns Apply writes for a group exactly the kept patterns its row
 * shows, and present only where the row offers the group; and answers only
 * for offered groups, each once. A card whose parts disagree is refused on
 * restore, and Apply refuses one in memory.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  CONTEXT_PATH_GROUPS,
  type ContextPathGroup,
  type ContextPathLeftReason,
  type ContextPathNotOffered,
  type ContextPathPatternDrop,
  type ContextPathSettingLevel
} from '@shared/types';
import type { WorkshopLocationsGroupAnswer, WorkshopLocationsProposalCard, WorkshopTurn } from '@messages';
import { contextPathSettingPatterns } from '@/application/services/contextPaths/ContextPathPatternSafety';
import {
  arrayOf,
  boundedArrayAt,
  boundedStringAt,
  booleanAt,
  enumAt,
  exactObject,
  numberAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';

const keys = <T extends string>(record: Record<T, true>): readonly T[] => Object.keys(record) as T[];

const LEVELS = keys<ContextPathSettingLevel>({ default: true, user: true, workspace: true, 'workspace-folder': true });
const DROPS = keys<ContextPathPatternDrop>({
  empty: true, comma: true, absolute: true, drive: true, home: true, 'workspace-prefix': true,
  'parent-segment': true, backslash: true, 'control-character': true, 'too-long': true, duplicate: true,
  'over-cap': true, unmatched: true, incomplete: true
});
const NOT_OFFERED = keys<ContextPathNotOffered>({
  'not-proposed': true, 'nothing-kept': true, incomplete: true, 'workspace-set': true, unchanged: true
});
const LEFT = keys<ContextPathLeftReason>({
  'not-offered': true, 'workspace-set': true, changed: true, incomplete: true, 'matches-changed': true,
  'write-failed': true, 'not-reached': true
});

/**
 * The card's own bounds, shared by its producer and its reader. Never
 * taught: a persona never sees a card.
 */
export const WORKSHOP_LOCATIONS_CARD_LIMITS = Object.freeze({
  /** A displayed path (a root's name, folders and a file name): clipped to this by the producer. */
  pathCharacters: 1_024,
  /** A group's stored value, its patterns joined: a card is not made past it. */
  valueCharacters: 16_384
});

const bounds = PROMPT_BUDGETS.contextPaths;
const PATH_CHARACTERS = WORKSHOP_LOCATIONS_CARD_LIMITS.pathCharacters;
const VALUE_CHARACTERS = WORKSHOP_LOCATIONS_CARD_LIMITS.valueCharacters;
/** A pattern as the checker may show it, a refused one included: the frame and the call bound it. */
const PATTERN_CHARACTERS = bounds.patternCharacters;
const PATTERNS = bounds.checkPatterns;
const GROUP_COUNT = CONTEXT_PATH_GROUPS.length;

function groupAt(value: unknown, path: string): ContextPathGroup {
  enumAt(value, path, CONTEXT_PATH_GROUPS);
  return value as ContextPathGroup;
}

function countAt(value: unknown, path: string): void {
  numberAt(value, path);
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    shapeError(path, 'a whole number');
  }
}

function stringsAt(value: unknown, path: string, maximum: number, characters: number): void {
  boundedArrayAt(value, path, 0, maximum, 'strings');
  value.forEach((item, index) => boundedStringAt(item, `${path}[${index}]`, characters));
}

function assertGroupView(value: unknown, path: string): void {
  const group = exactObject(value, path, ['group', 'level', 'current', 'offer'], ['proposed']);
  groupAt(group.group, `${path}.group`);
  enumAt(group.level, `${path}.level`, LEVELS);
  const current = exactObject(group.current, `${path}.current`, ['patterns', 'count', 'examples']);
  // The live setting's patterns, however many it holds; the whole value is bounded below.
  stringsAt(current.patterns, `${path}.current.patterns`, VALUE_CHARACTERS, VALUE_CHARACTERS);
  if (current.count !== null) {
    countAt(current.count, `${path}.current.count`);
  }
  stringsAt(current.examples, `${path}.current.examples`, bounds.examples, PATH_CHARACTERS);
  const offer = exactObject(group.offer, `${path}.offer`, ['offered'], ['reason']);
  booleanAt(offer.offered, `${path}.offer.offered`);
  if (offer.offered === true) {
    exactObject(offer, `${path}.offer`, ['offered']);
  } else {
    enumAt(offer.reason, `${path}.offer.reason`, NOT_OFFERED);
  }
  if (group.proposed !== undefined) {
    const proposed = exactObject(group.proposed, `${path}.proposed`, ['kept', 'dropped', 'count', 'examples', 'shared']);
    boundedArrayAt(proposed.kept, `${path}.proposed.kept`, 0, bounds.patternsPerGroup, 'patterns');
    proposed.kept.forEach((item, index) => {
      const kept = exactObject(item, `${path}.proposed.kept[${index}]`, ['pattern', 'count']);
      boundedStringAt(kept.pattern, `${path}.proposed.kept[${index}].pattern`, PATTERN_CHARACTERS);
      countAt(kept.count, `${path}.proposed.kept[${index}].count`);
    });
    boundedArrayAt(proposed.dropped, `${path}.proposed.dropped`, 0, PATTERNS, 'patterns');
    proposed.dropped.forEach((item, index) => {
      const dropped = exactObject(item, `${path}.proposed.dropped[${index}]`, ['pattern', 'reason']);
      boundedStringAt(dropped.pattern, `${path}.proposed.dropped[${index}].pattern`, PATTERN_CHARACTERS);
      enumAt(dropped.reason, `${path}.proposed.dropped[${index}].reason`, DROPS);
    });
    countAt(proposed.count, `${path}.proposed.count`);
    stringsAt(proposed.examples, `${path}.proposed.examples`, bounds.examples, PATH_CHARACTERS);
    const shared = exactObject(proposed.shared, `${path}.proposed.shared`, ['count', 'examples']);
    countAt(shared.count, `${path}.proposed.shared.count`);
    boundedArrayAt(shared.examples, `${path}.proposed.shared.examples`, 0, bounds.examples, 'files');
    shared.examples.forEach((item, index) => {
      const file = exactObject(item, `${path}.proposed.shared.examples[${index}]`, ['path', 'groups']);
      boundedStringAt(file.path, `${path}.proposed.shared.examples[${index}].path`, PATH_CHARACTERS);
      boundedArrayAt(file.groups, `${path}.proposed.shared.examples[${index}].groups`, 1, GROUP_COUNT, 'groups');
      file.groups.forEach((other, at) => groupAt(other, `${path}.proposed.shared.examples[${index}].groups[${at}]`));
    });
  }
}

function assertAnswer(value: unknown, path: string): void {
  const answer = exactObject(value, path, ['group', 'outcome'], ['reason']);
  groupAt(answer.group, `${path}.group`);
  enumAt(answer.outcome, `${path}.outcome`, ['applied', 'left', 'declined']);
  if (answer.outcome === 'left') {
    enumAt(answer.reason, `${path}.reason`, LEFT);
  } else if (answer.reason !== undefined) {
    shapeError(`${path}.reason`, 'no reason beside applied or declined');
  }
}

/** Strict structure of a turn's `locationsProposal`; refused on any turn but a host or guest reply. */
export function assertWorkshopLocationsProposalShape(
  value: unknown,
  path: string,
  turn: { readonly role?: unknown; readonly participant?: unknown }
): void {
  if (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest')) {
    shapeError(path, 'a card on a persona reply');
  }
  const card = exactObject(value, path, ['view', 'baselines', 'kept', 'state'], ['answers']);
  const view = exactObject(card.view, `${path}.view`, ['groups'], ['scan']);
  boundedArrayAt(view.groups, `${path}.view.groups`, 1, GROUP_COUNT, 'groups');
  view.groups.forEach((group, index) => assertGroupView(group, `${path}.view.groups[${index}]`));
  if (view.scan !== undefined) {
    const scan = exactObject(view.scan, `${path}.view.scan`, ['folders', 'sent', 'stopped', 'unreadable']);
    countAt(scan.folders, `${path}.view.scan.folders`);
    countAt(scan.sent, `${path}.view.scan.sent`);
    booleanAt(scan.stopped, `${path}.view.scan.stopped`);
    countAt(scan.unreadable, `${path}.view.scan.unreadable`);
  }
  const baselines = exactObject(card.baselines, `${path}.baselines`, CONTEXT_PATH_GROUPS);
  for (const group of CONTEXT_PATH_GROUPS) {
    boundedStringAt(baselines[group], `${path}.baselines.${group}`, VALUE_CHARACTERS);
  }
  const kept = exactObject(card.kept, `${path}.kept`, [], CONTEXT_PATH_GROUPS);
  for (const group of CONTEXT_PATH_GROUPS) {
    if (kept[group] !== undefined) {
      boundedArrayAt(kept[group], `${path}.kept.${group}`, 1, bounds.patternsPerGroup, 'patterns');
      (kept[group] as unknown[]).forEach((pattern, index) => boundedStringAt(pattern, `${path}.kept.${group}[${index}]`, PATTERN_CHARACTERS));
    }
  }
  enumAt(card.state, `${path}.state`, ['pending', 'answered']);
  if (card.state === 'answered') {
    if (card.answers === undefined) {
      shapeError(`${path}.answers`, 'the answers of an answered card');
    }
    arrayOf(card.answers, `${path}.answers`, assertAnswer);
  } else if (card.answers !== undefined) {
    shapeError(`${path}.answers`, 'no answers on a pending card');
  }
  const mismatch = workshopLocationsCardMismatch(value as WorkshopLocationsProposalCard);
  if (mismatch) {
    shapeError(path, `a card whose parts agree (${mismatch})`);
  }
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * Why a card's parts disagree, or undefined when what it draws is what
 * Apply would write. Reads a card already shaped; never throws.
 */
export function workshopLocationsCardMismatch(card: WorkshopLocationsProposalCard): string | undefined {
  const order = card.view.groups.map((group) => group.group);
  if (!sameList(order, CONTEXT_PATH_GROUPS)) {
    return 'every group once, in order';
  }
  for (const group of card.view.groups) {
    if (!sameList(contextPathSettingPatterns(card.baselines[group.group]), group.current.patterns)) {
      return `${group.group}: its baseline is the value its current patterns were read from`;
    }
    const kept = card.kept[group.group];
    if (group.offer.offered) {
      if (!group.proposed || !kept || !sameList(kept, group.proposed.kept.map((entry) => entry.pattern))) {
        return `${group.group}: Apply writes exactly the kept patterns its row shows`;
      }
    } else if (kept !== undefined) {
      return `${group.group}: a group not offered has nothing to write`;
    }
  }
  const offered = new Set(card.view.groups.filter((group) => group.offer.offered).map((group) => group.group));
  const answered = new Set<ContextPathGroup>();
  for (const answer of card.answers ?? []) {
    if (!offered.has(answer.group) || answered.has(answer.group)) {
      return `${answer.group}: answers only for offered groups, each once`;
    }
    answered.add(answer.group);
  }
  if (card.state === 'answered' && answered.size !== offered.size) {
    return 'an answered card answers every offered group';
  }
  return undefined;
}

/** A display path within the card's bound: the producer clips, the reader refuses longer. */
export function workshopLocationsCardPath(value: string): string {
  return value.length <= PATH_CHARACTERS ? value : `${value.slice(0, PATH_CHARACTERS - 1)}…`;
}

/** Mark a pending card answered, in place; a card answered already, or none, is left as it is. */
export function answerWorkshopLocationsProposalOnTurn(
  turn: WorkshopTurn,
  answers: readonly WorkshopLocationsGroupAnswer[]
): void {
  if (turn.locationsProposal?.state !== 'pending') {
    return;
  }
  turn.locationsProposal = { ...turn.locationsProposal, state: 'answered', answers: answers.map((answer) => ({ ...answer })) };
}

/** A defensive copy of one card. */
export function cloneWorkshopLocationsProposal(card: WorkshopLocationsProposalCard): WorkshopLocationsProposalCard {
  return structuredCloneJson(card);
}

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
