/**
 * `WorkshopTurn.memoryProposals` in the persisted session (ADR 2026-11-04
 * D6, D12; epic Slices 3 and 6b). Optional and additive: written only when
 * present, no `schemaVersion` bump (ADR 2026-07-30; ADR 2026-11-03 D9). A
 * session without it reads and writes exactly as before.
 *
 * When present it is exact: one to `proposalsPerReply` items, each within
 * the format's bounds, and only on a persona's reply (a host or guest
 * assistant turn). Each item names what it proposes (`proposes`): `new`, or
 * `edit` (Slice 6c), which names its target (id, edit token, load in full,
 * every id it supersedes and the titles of those listed), what the note
 * said (`before`), and `stale` once a Save
 * found the note changed. A saved card names the memory it became or
 * changed (an edit's is its target); a pending or dismissed one names none.
 * A held card names why in `held`; one held `personal` (the phrasing fence,
 * D9, in either mode) also names the word it matched, `heldWord` (a lower-
 * case word of letters), and no other card does. Both are added values, not
 * a migration (ADR 2026-07-30). A new note may name the
 * open-room turns its trailer cited (`cites`, Bookmark Recall D10): one to
 * `citedTurns` tokens, each once.
 *
 * **Development checkpoints** (Slice 6b; ADR 2026-07-30): sessions saved
 * before the list held one card in `memoryProposal`, without `proposes`.
 * A checkpoint may still hold it (checked with the item's own rules); the
 * normalization `listed-single-memory-proposal` moves it into the list, and
 * the current shape refuses it.
 */

import {
  WORKSHOP_MEMORY_HOLDS,
  WORKSHOP_MEMORY_PROPOSAL_KINDS,
  WORKSHOP_MEMORY_PROPOSAL_STATES,
  type WorkshopMemoryNewProposal,
  type WorkshopMemoryProposal,
  type WorkshopMemoryProposalReplaces,
  type WorkshopTurn
} from '@messages';
import {
  PROJECT_MEMORY_FIELD_CHARACTERS,
  PROJECT_MEMORY_ID,
  PROJECT_MEMORY_KINDS,
  PROJECT_MEMORY_LIST_ENTRIES
} from '@shared/types/projectMemory';
import {
  boundedArrayAt,
  boundedStringAt,
  enumAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_MEMORY_CITED_TURN } from '@/utils/workshopMemoryProposalProtocol';

const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;
/** A word of `WORKSHOP_MEMORY_PERSONAL_WORDS`' shape, not its membership: a list that changes must not refuse a saved session. */
const HELD_WORD_CHARACTERS = 40;
const HELD_WORD = new RegExp(`^\\p{Ll}{1,${HELD_WORD_CHARACTERS}}$`, 'u');

/** A turn as a development checkpoint may hold it: one card, before the list (Slice 6b). */
export type WorkshopLegacyMemoryProposalTurn = WorkshopTurn & {
  /** LEGACY: a development checkpoint's single card; normalized into `memoryProposals`. */
  memoryProposal?: Omit<WorkshopMemoryNewProposal, 'proposes'>;
};

/** Strict structure of one turn's `memoryProposals`, and that its turn may carry them. */
export function assertWorkshopMemoryProposalShape(
  turn: Record<string, unknown>,
  path: string,
  checkpoint: boolean
): void {
  if (turn.memoryProposal !== undefined) {
    const at = `${path}.memoryProposal`;
    if (!checkpoint) {
      shapeError(at, 'absent: a turn\'s cards are its memoryProposals');
    }
    if (turn.memoryProposals !== undefined) {
      shapeError(at, 'absent beside memoryProposals');
    }
    assertProposal(turn.memoryProposal, at, false);
  }
  if (turn.memoryProposals === undefined) {
    return;
  }
  const at = `${path}.memoryProposals`;
  if (!checkpoint && (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest'))) {
    shapeError(at, 'a host or guest persona reply');
  }
  boundedArrayAt(turn.memoryProposals, at, 1, PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply, 'memory suggestions');
  (turn.memoryProposals as unknown[]).forEach((item, index) => assertProposal(item, `${at}[${index}]`, true));
}

function assertProposal(value: unknown, at: string, listed: boolean): void {
  const proposes = listed ? (value as Record<string, unknown> | null)?.proposes : 'new';
  if (listed) {
    enumAt(proposes, `${at}.proposes`, WORKSHOP_MEMORY_PROPOSAL_KINDS);
  }
  const edit = proposes === 'edit';
  const proposal = exactObject(
    value,
    at,
    [...(listed ? ['proposes'] : []), 'title', 'kind', 'summary', 'body', 'state', ...(edit ? ['target', 'before'] : [])],
    [...(edit ? ['stale'] : ['supersedes', 'droppedSupersedes', 'cites']), 'memoryId', 'held', 'heldWord']
  );
  assertFields(proposal, at);
  enumAt(proposal.state, `${at}.state`, WORKSHOP_MEMORY_PROPOSAL_STATES);
  if (proposal.held !== undefined) {
    enumAt(proposal.held, `${at}.held`, WORKSHOP_MEMORY_HOLDS);
  }
  if (proposal.held === 'personal') {
    if (typeof proposal.heldWord !== 'string' || !HELD_WORD.test(proposal.heldWord)) {
      shapeError(`${at}.heldWord`, `the word the fence matched (lower-case letters, at most ${HELD_WORD_CHARACTERS})`);
    }
  } else if (proposal.heldWord !== undefined) {
    shapeError(`${at}.heldWord`, 'absent unless held personal');
  }
  if (proposal.supersedes !== undefined) {
    assertReplaces(proposal.supersedes, `${at}.supersedes`);
  }
  if (proposal.droppedSupersedes !== undefined && (
    !Number.isSafeInteger(proposal.droppedSupersedes)
    || (proposal.droppedSupersedes as number) < 1
    || (proposal.droppedSupersedes as number) > PROJECT_MEMORY_LIST_ENTRIES.supersedes
  )) {
    shapeError(`${at}.droppedSupersedes`, `an integer from 1 to ${PROJECT_MEMORY_LIST_ENTRIES.supersedes}`);
  }
  if (proposal.cites !== undefined) {
    assertCites(proposal.cites, `${at}.cites`);
  }
  if (edit) {
    assertEdit(proposal, at);
  }
  if (proposal.state === 'saved') {
    memoryIdAt(proposal.memoryId, `${at}.memoryId`);
    if (edit && proposal.memoryId !== (proposal.target as { id: string }).id) {
      shapeError(`${at}.memoryId`, 'the memory the edit changed');
    }
  } else if (proposal.memoryId !== undefined) {
    shapeError(`${at}.memoryId`, 'absent on a card that was not saved');
  }
}

/** What a memory says, within the format's bounds. */
function assertFields(fields: Record<string, unknown>, at: string): void {
  oneLineAt(fields.title, `${at}.title`, PROJECT_MEMORY_FIELD_CHARACTERS.title);
  enumAt(fields.kind, `${at}.kind`, PROJECT_MEMORY_KINDS);
  oneLineAt(fields.summary, `${at}.summary`, PROJECT_MEMORY_FIELD_CHARACTERS.summary);
  boundedStringAt(fields.body, `${at}.body`, PROJECT_MEMORY_FIELD_CHARACTERS.body);
}

function assertEdit(proposal: Record<string, unknown>, at: string): void {
  const target = exactObject(proposal.target, `${at}.target`, ['id', 'token', 'pinned', 'supersedes'], ['replaces']);
  memoryIdAt(target.id, `${at}.target.id`);
  if (typeof target.token !== 'string' || !/^[0-9a-f]{12}$/.test(target.token)) {
    shapeError(`${at}.target.token`, 'an edit token (twelve lower-case hex digits)');
  }
  if (typeof target.pinned !== 'boolean') {
    shapeError(`${at}.target.pinned`, 'true or false');
  }
  boundedArrayAt(target.supersedes, `${at}.target.supersedes`, 0, PROJECT_MEMORY_LIST_ENTRIES.supersedes, 'superseded memories');
  const ids = target.supersedes as unknown[];
  ids.forEach((id, index) => memoryIdAt(id, `${at}.target.supersedes[${index}]`));
  if (new Set(ids).size !== ids.length) {
    shapeError(`${at}.target.supersedes`, 'each memory once');
  }
  if (target.replaces !== undefined) {
    assertReplaces(target.replaces, `${at}.target.replaces`);
    if ((target.replaces as Array<{ id: string }>).some((item) => !ids.includes(item.id))) {
      shapeError(`${at}.target.replaces`, 'only memories the note supersedes');
    }
  }
  // The before fields are the note's own, so its whole body (not a trimmed copy) may differ in space.
  assertFields(exactObject(proposal.before, `${at}.before`, ['title', 'kind', 'summary', 'body']), `${at}.before`);
  if (proposal.stale !== undefined && proposal.stale !== true) {
    shapeError(`${at}.stale`, 'true or absent');
  }
}

function assertCites(value: unknown, at: string): void {
  boundedArrayAt(value, at, 1, PROMPT_BUDGETS.workshopProjectMemory.citedTurns, 'cited turns');
  const ids = value as unknown[];
  ids.forEach((id, index) => {
    if (typeof id !== 'string' || !WORKSHOP_MEMORY_CITED_TURN.test(id)) {
      shapeError(`${at}[${index}]`, 'a cited turn (one token)');
    }
  });
  if (new Set(ids).size !== ids.length) {
    shapeError(at, 'each turn once');
  }
}

function assertReplaces(value: unknown, at: string): void {
  boundedArrayAt(value, at, 1, PROJECT_MEMORY_LIST_ENTRIES.supersedes, 'replaced memories');
  const ids = new Set<string>();
  (value as unknown[]).forEach((item, index) => {
    const replaced = exactObject(item, `${at}[${index}]`, ['id', 'title']);
    memoryIdAt(replaced.id, `${at}[${index}].id`);
    oneLineAt(replaced.title, `${at}[${index}].title`, PROJECT_MEMORY_FIELD_CHARACTERS.title);
    if (ids.has(replaced.id as string)) {
      shapeError(`${at}[${index}].id`, 'a memory no other entry names');
    }
    ids.add(replaced.id as string);
  });
}

/**
 * A development checkpoint's single card, moved into the list as its only
 * item (`listed-single-memory-proposal`, Slice 6b). Returns the turn as it
 * was when it holds none.
 */
export function listLegacyWorkshopMemoryProposal(turn: WorkshopLegacyMemoryProposalTurn): WorkshopTurn {
  if (turn.memoryProposal === undefined) {
    return turn;
  }
  const { memoryProposal, ...rest } = turn;
  return { ...rest, memoryProposals: [cloneWorkshopMemoryProposal({ proposes: 'new', ...memoryProposal })] };
}

export function cloneWorkshopMemoryProposal(proposal: WorkshopMemoryProposal): WorkshopMemoryProposal {
  const common = {
    title: proposal.title,
    kind: proposal.kind,
    summary: proposal.summary,
    body: proposal.body,
    state: proposal.state,
    ...(proposal.memoryId !== undefined ? { memoryId: proposal.memoryId } : {}),
    ...(proposal.held !== undefined ? { held: proposal.held } : {}),
    ...(proposal.heldWord !== undefined ? { heldWord: proposal.heldWord } : {})
  };
  if (proposal.proposes === 'edit') {
    return {
      proposes: 'edit',
      ...common,
      target: {
        id: proposal.target.id,
        token: proposal.target.token,
        pinned: proposal.target.pinned,
        supersedes: [...proposal.target.supersedes],
        ...(proposal.target.replaces ? { replaces: cloneReplaces(proposal.target.replaces) } : {})
      },
      before: { ...proposal.before },
      ...(proposal.stale ? { stale: true as const } : {})
    };
  }
  return {
    proposes: 'new',
    ...common,
    ...(proposal.supersedes ? { supersedes: cloneReplaces(proposal.supersedes) } : {}),
    ...(proposal.droppedSupersedes !== undefined ? { droppedSupersedes: proposal.droppedSupersedes } : {}),
    ...(proposal.cites ? { cites: [...proposal.cites] } : {})
  };
}

function cloneReplaces(items: readonly WorkshopMemoryProposalReplaces[]): WorkshopMemoryProposalReplaces[] {
  return items.map((item) => ({ id: item.id, title: item.title }));
}

/** Whether a turn may carry a memory card: a persona's reply. */
export function canCarryWorkshopMemoryProposal(turn: Pick<WorkshopTurn, 'role' | 'participant'>): boolean {
  return turn.role === 'assistant' && (turn.participant === 'host' || turn.participant === 'guest');
}

export function memoryIdAt(value: unknown, path: string): void {
  if (typeof value !== 'string' || !PROJECT_MEMORY_ID.test(value)) {
    shapeError(path, 'a memory id (mem- and six lower-case hex digits)');
  }
}

export function oneLineAt(value: unknown, path: string, maximum: number): void {
  boundedStringAt(value, path, maximum, false);
  if (NOT_ONE_LINE.test(value as string) || (value as string).trim() !== value) {
    shapeError(path, 'one trimmed line');
  }
}
