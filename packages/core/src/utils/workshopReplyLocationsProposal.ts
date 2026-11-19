/**
 * A reply's context-paths proposal frames, decoded and judged (ADR
 * 2026-11-19 D27). Pure: the tail extractor (`workshopReplyControls`) finds
 * the frames in its one pass and hands this the ones tagged
 * `<prose-minion-locations-proposal>`, each with whether it stands at the
 * tail.
 *
 * ```xml
 * <prose-minion-locations-proposal>
 *   <group name="characters">
 *     <pattern>Cast/**\/*</pattern>
 *   </group>
 * </prose-minion-locations-proposal>
 * ```
 *
 * - **One a reply.** The first frame that decodes is kept; any later frame
 *   is `duplicate`, whatever it holds.
 * - **Its inside:** one or more `<group name="…">`, each a context-path
 *   group, once; each holding one to `patternsPerGroup` `<pattern>`
 *   elements of at most `patternCharacters`. Anything else is
 *   `malformed:<fault>`.
 * - Whether a pattern is safe, and what it matches, is the checker's, at
 *   settlement (`WorkshopReplyLocations`). Nothing here logs a pattern.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup, type ContextPathGroup } from '@shared/types/context';
import { readWorkshopTrailerElements, type WorkshopTrailerReadFault } from '@/utils/workshopTrailerElements';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';

export const WORKSHOP_LOCATIONS_PROPOSAL_TAG = 'prose-minion-locations-proposal';

export const WORKSHOP_LOCATIONS_PROPOSAL_REDACTION = '[context paths proposal removed]';

export type WorkshopLocationsProposalFault =
  | WorkshopTrailerReadFault
  | 'no-group'
  | 'unknown-group'
  | 'repeated-group'
  | 'empty-group'
  | 'empty-pattern'
  | 'pattern-too-long'
  | 'too-many-patterns';

/** A proposal as the frame wrote it: per group, its patterns, trimmed, in order. */
export type WorkshopLocationsProposalDraft = Readonly<Partial<Record<ContextPathGroup, readonly string[]>>>;

export type WorkshopReplyLocationsRejection =
  | WorkshopReplyTrailerStructureRejection
  | `malformed:${WorkshopLocationsProposalFault}`
  | 'duplicate';

export interface WorkshopReplyLocationsControl {
  /** The one proposal kept, when a frame decoded. */
  readonly proposal?: WorkshopLocationsProposalDraft;
  /** One reason per frame dropped, in the order written. */
  readonly rejections: readonly WorkshopReplyLocationsRejection[];
}

export type WorkshopLocationsProposalDecode =
  | { readonly kind: 'proposal'; readonly proposal: WorkshopLocationsProposalDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopLocationsProposalFault };

const GROUP_OPEN = /<group\s+name\s*=\s*"([^"]*)"\s*>/iy;
const GROUP_CLOSE = /<\/group\s*>/i;

/** Decode a frame's inside (between its opening and closing tags). */
export function decodeWorkshopLocationsProposal(inner: string): WorkshopLocationsProposalDecode {
  const bounds = PROMPT_BUDGETS.contextPaths;
  const groups: Partial<Record<ContextPathGroup, readonly string[]>> = {};
  let at = 0;
  let any = false;
  while (true) {
    while (at < inner.length && /\s/.test(inner[at])) {
      at += 1;
    }
    if (at >= inner.length) {
      break;
    }
    GROUP_OPEN.lastIndex = at;
    const opening = GROUP_OPEN.exec(inner);
    if (!opening) {
      return reject('stray-text');
    }
    const name = opening[1].trim();
    if (!isContextPathGroup(name)) {
      return reject('unknown-group');
    }
    if (groups[name]) {
      return reject('repeated-group');
    }
    const start = at + opening[0].length;
    const close = GROUP_CLOSE.exec(inner.slice(start));
    if (!close) {
      return reject('unclosed-element');
    }
    const read = readWorkshopTrailerElements(inner.slice(start, start + close.index), { elements: ['pattern'] });
    if (read.kind === 'fault') {
      return reject(read.fault);
    }
    if (read.elements.length === 0) {
      return reject('empty-group');
    }
    if (read.elements.length > bounds.patternsPerGroup) {
      return reject('too-many-patterns');
    }
    const patterns: string[] = [];
    for (const element of read.elements) {
      const pattern = element.content.trim();
      if (pattern.length === 0) {
        return reject('empty-pattern');
      }
      if (pattern.length > bounds.patternCharacters) {
        return reject('pattern-too-long');
      }
      patterns.push(pattern);
    }
    groups[name] = patterns;
    any = true;
    at = start + close.index + close[0].length;
  }
  return any ? { kind: 'proposal', proposal: groups } : reject('no-group');
}

export function judgeWorkshopReplyLocations(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>
): WorkshopReplyLocationsControl {
  let proposal: WorkshopLocationsProposalDraft | undefined;
  const rejections: WorkshopReplyLocationsRejection[] = [];
  for (const { frame, atTail } of frames) {
    const structural = workshopReplyTrailerStructureRejection(frame, atTail);
    if (structural) {
      rejections.push(structural);
      continue;
    }
    const decoded = decodeWorkshopLocationsProposal(frame.inner ?? '');
    if (decoded.kind === 'rejected') {
      rejections.push(`malformed:${decoded.fault}`);
    } else if (proposal) {
      rejections.push('duplicate');
    } else {
      proposal = decoded.proposal;
    }
  }
  return { ...(proposal ? { proposal } : {}), rejections };
}

function reject(fault: WorkshopLocationsProposalFault): Extract<WorkshopLocationsProposalDecode, { kind: 'rejected' }> {
  return { kind: 'rejected', fault };
}
