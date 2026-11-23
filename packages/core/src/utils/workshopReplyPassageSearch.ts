/**
 * A reply's passage-search request frames, decoded and judged (ADR
 * 2026-11-20 D16). Pure: the tail extractor (`workshopReplyControls`) finds
 * the frames in its one pass and hands this the ones tagged
 * `<prose-minion-passage-search>`, each with whether it stands at the tail.
 *
 * ```xml
 * <prose-minion-passage-search>
 * <question>Find every time Jasper adjusts his glasses.</question>
 * <group>chapters</group>
 * <group match="Drafts/chapter-4.*.md, Drafts/chapter-1*.md">manuscript</group>
 * <path group="characters">jasper.md</path>
 * <excerpt/>
 * </prose-minion-passage-search>
 * ```
 *
 * - **One a reply.** The first frame that decodes is kept; any later frame
 *   is `extra`, whatever it holds.
 * - **Its inside:** `<question>` once, 1 to `questionCharacters` characters
 *   on one line once its spacing is collapsed; then 1 to `scopes` places,
 *   each once: `<group>` (every file of a context group), `<path group="…">`
 *   (one configured file, written as `resource.read` writes a path) and
 *   `<excerpt/>` (the room's excerpt). Anything else is `malformed:<fault>`.
 * - **A group may be narrowed** (ADR 2026-11-20 S42): `<group match="…">`,
 *   its character references decoded first, as a capability call's text is
 *   (`&amp;` is `&`; S53), then a comma-separated list read as a
 *   context-path setting is
 *   (`readContextGroupMatchList`: 1 to `matchPatterns`, the attribute at
 *   most `matchCharacters`). Only `<group>` takes it. A group named twice,
 *   narrowed or not, is a repeat.
 * - **No free path and no free pattern.** A pattern narrows a context group
 *   and can only take files away from it, so a request can only name what
 *   the project's context paths already hold.
 * - Whether a group exists, a file is in its group, a pattern is safe and
 *   finds a file of its group, and the room has an excerpt is the host's,
 *   at settlement (`WorkshopReplyPassageSearch`). Nothing here logs what a
 *   field held.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isSafeConfiguredResourcePath } from '@/utils/configuredResourcePath';
import { readContextGroupMatchList, type ContextGroupMatchFormFault } from '@/utils/contextGroupMatchList';
import { decodeXmlCharacterReferences } from '@/utils/xmlCharacterReferences';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';

export const WORKSHOP_PASSAGE_SEARCH_TAG = 'prose-minion-passage-search';

export const WORKSHOP_PASSAGE_SEARCH_REDACTION = '[passage search request removed]';

/** What retained history and the bubble hold when a reply was only a request. */
export const WORKSHOP_PASSAGE_SEARCH_ONLY_REPLY_LINE = 'Asked for a passage search.';

/** Every element the frame reads; `excerpt` alone may close itself, `path` alone takes `group`, and `group` alone takes `match`. */
export const WORKSHOP_PASSAGE_SEARCH_ELEMENTS = ['question', 'group', 'path', 'excerpt'] as const;

export const WORKSHOP_PASSAGE_SEARCH_FAULTS = [
  'stray-text',
  'unknown-element',
  'unclosed-element',
  'unknown-attribute',
  'missing-question',
  'repeated-question',
  'empty-question',
  'question-too-long',
  'no-scope',
  'too-many-scopes',
  'repeated-scope',
  'empty-group',
  'group-too-long',
  'missing-group',
  'missing-path',
  'path-too-long',
  'invalid-path',
  'excerpt-not-empty',
  // A group's narrowing (S42): its list's form; whether each pattern is safe is settlement's.
  'empty-match',
  'match-too-long',
  'too-many-match-patterns'
] as const;
export type WorkshopPassageSearchFault = typeof WORKSHOP_PASSAGE_SEARCH_FAULTS[number];

/** One place a request names, as the frame wrote it. A group's name, and its narrowing's patterns, are checked by the host. */
export type WorkshopPassageSearchScopeDraft =
  /** `match`: the narrowing's patterns as split, in order; absent for the whole group. */
  | { readonly kind: 'group'; readonly group: string; readonly match?: readonly string[] }
  | { readonly kind: 'file'; readonly group: string; readonly path: string }
  | { readonly kind: 'excerpt' };

export interface WorkshopPassageSearchDraft {
  readonly question: string;
  readonly scopes: readonly WorkshopPassageSearchScopeDraft[];
}

export type WorkshopReplyPassageSearchRejection =
  | WorkshopReplyTrailerStructureRejection
  | `malformed:${WorkshopPassageSearchFault}`
  | 'extra';

export interface WorkshopReplyPassageSearchControl {
  /** The one request kept, when a frame decoded. */
  readonly request?: WorkshopPassageSearchDraft;
  /** One reason per frame dropped, in the order written. */
  readonly rejections: readonly WorkshopReplyPassageSearchRejection[];
}

export type WorkshopPassageSearchDecode =
  | { readonly kind: 'request'; readonly request: WorkshopPassageSearchDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopPassageSearchFault };

/** A group's name is a short word; the host says whether it is a context group. */
const GROUP_NAME_CHARACTERS = 40;

const OPENING = /<([a-z][a-z0-9-]*)((?:\s+[a-z][a-z0-9-]*\s*=\s*"[^"]*")*)\s*(\/?)>/iy;
const ATTRIBUTE = /\s+([a-z][a-z0-9-]*)\s*=\s*"([^"]*)"/giy;
/** The one attribute each element may carry. */
const ELEMENT_ATTRIBUTE: Readonly<Record<string, string>> = { path: 'group', group: 'match' };

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the list's kebab-case fault words. */
const MATCH_FAULTS: Readonly<Record<ContextGroupMatchFormFault, WorkshopPassageSearchFault>> = {
  empty: 'empty-match',
  'too-long': 'match-too-long',
  'too-many': 'too-many-match-patterns'
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * The element's one allowed attribute, its character references decoded as
 * the capability codec decodes text (S53); `undefined` when absent; `null`
 * when anything else is written.
 */
function attributeOf(name: string, written: string): string | undefined | null {
  if (!written) {
    return undefined;
  }
  const allowed = ELEMENT_ATTRIBUTE[name];
  ATTRIBUTE.lastIndex = 0;
  const found = ATTRIBUTE.exec(written);
  // One attribute, the element's own, and nothing after it.
  if (!allowed || !found || found[1].toLowerCase() !== allowed || ATTRIBUTE.lastIndex !== written.length) {
    return null;
  }
  return decodeXmlCharacterReferences(found[2]);
}

/** How two scopes are compared: a repeat differs by more than letter case. */
function scopeKey(scope: WorkshopPassageSearchScopeDraft): string {
  switch (scope.kind) {
    case 'group':
      return `group\u0000${scope.group.toLowerCase()}`;
    case 'file':
      return `file\u0000${scope.group.toLowerCase()}\u0000${scope.path.toLowerCase()}`;
    case 'excerpt':
      return 'excerpt';
  }
}

/** Decode a frame's inside (between its opening and closing tags). */
export function decodeWorkshopPassageSearch(inner: string): WorkshopPassageSearchDecode {
  const bounds = PROMPT_BUDGETS.workshopPassageSearch;
  let question: string | undefined;
  const scopes: WorkshopPassageSearchScopeDraft[] = [];
  const seen = new Set<string>();
  let at = 0;
  while (true) {
    while (at < inner.length && /\s/.test(inner[at])) {
      at += 1;
    }
    if (at >= inner.length) {
      break;
    }
    OPENING.lastIndex = at;
    const opening = OPENING.exec(inner);
    if (!opening) {
      return reject('stray-text');
    }
    const name = opening[1].toLowerCase();
    if (!(WORKSHOP_PASSAGE_SEARCH_ELEMENTS as readonly string[]).includes(name)) {
      return reject('unknown-element');
    }
    const attribute = attributeOf(name, opening[2]);
    if (attribute === null) {
      return reject('unknown-attribute');
    }
    let content = '';
    at += opening[0].length;
    if (opening[3] === '/') {
      if (name !== 'excerpt') {
        // Only the excerpt may close itself; any other reads as text.
        return reject('stray-text');
      }
    } else {
      const close = new RegExp(`</${name}\\s*>`, 'i').exec(inner.slice(at));
      if (!close) {
        return reject('unclosed-element');
      }
      content = inner.slice(at, at + close.index);
      at += close.index + close[0].length;
    }
    if (name === 'question') {
      if (question !== undefined) {
        return reject('repeated-question');
      }
      question = content.replace(/\s+/g, ' ').trim();
      if (question.length === 0) {
        return reject('empty-question');
      }
      if (question.length > bounds.questionCharacters) {
        return reject('question-too-long');
      }
      continue;
    }
    const scope = scopeOf(name, content.trim(), attribute);
    if (typeof scope === 'string') {
      return reject(scope);
    }
    const key = scopeKey(scope);
    if (seen.has(key)) {
      return reject('repeated-scope');
    }
    seen.add(key);
    scopes.push(scope);
    if (scopes.length > bounds.scopes) {
      return reject('too-many-scopes');
    }
  }
  if (question === undefined) {
    return reject('missing-question');
  }
  return scopes.length === 0 ? reject('no-scope') : { kind: 'request', request: { question, scopes } };
}

/** One place from its element: `attribute` is the element's own, as written (`group` on a path, `match` on a group). */
function scopeOf(name: string, content: string, attribute: string | undefined): WorkshopPassageSearchScopeDraft | WorkshopPassageSearchFault {
  if (name === 'excerpt') {
    return content.length > 0 ? 'excerpt-not-empty' : { kind: 'excerpt' };
  }
  const named = name === 'group' ? content : attribute?.trim();
  if (named === undefined) {
    return 'missing-group';
  }
  if (named.length === 0) {
    return name === 'group' ? 'empty-group' : 'missing-group';
  }
  if (named.length > GROUP_NAME_CHARACTERS) {
    return 'group-too-long';
  }
  if (name === 'group') {
    if (attribute === undefined) {
      return { kind: 'group', group: named };
    }
    const match = readContextGroupMatchList([attribute]);
    return match.kind === 'refused' ? MATCH_FAULTS[match.fault] : { kind: 'group', group: named, match: match.patterns };
  }
  if (content.length === 0) {
    return 'missing-path';
  }
  if (content.length > PROMPT_BUDGETS.workshopResource.pathCharacters) {
    return 'path-too-long';
  }
  return isSafeConfiguredResourcePath(content) ? { kind: 'file', group: named, path: content } : 'invalid-path';
}

export function judgeWorkshopReplyPassageSearch(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>
): WorkshopReplyPassageSearchControl {
  let request: WorkshopPassageSearchDraft | undefined;
  const rejections: WorkshopReplyPassageSearchRejection[] = [];
  for (const { frame, atTail } of frames) {
    const structural = workshopReplyTrailerStructureRejection(frame, atTail);
    if (structural) {
      rejections.push(structural);
      continue;
    }
    const decoded = decodeWorkshopPassageSearch(frame.inner ?? '');
    if (decoded.kind === 'rejected') {
      rejections.push(`malformed:${decoded.fault}`);
    } else if (request) {
      rejections.push('extra');
    } else {
      request = decoded.request;
    }
  }
  return { ...(request ? { request } : {}), rejections };
}

function reject(fault: WorkshopPassageSearchFault): Extract<WorkshopPassageSearchDecode, { kind: 'rejected' }> {
  return { kind: 'rejected', fault };
}
