/**
 * A capability's `<page>` field and the pages of a listing (ADR 2026-11-17
 * D10). Neutral: every family that pages reads the field through
 * `workshopCapabilityPage`, and this module imports nothing of a family.
 *
 * - **There is no highest page.** The field's domain is syntactic: a whole
 *   number in plain decimal digits with no sign, space, point or leading
 *   zero, of at most `pageDigits` digits.
 * - **No listing reaches the bound.** The last page of a listing is
 *   `ceil(count / pageSize)`, and the host can hold at most
 *   `WORKSHOP_CAPABILITY_LARGEST_LISTING` items. A test holds
 *   `ceil(largest / pageSize)` within `pageDigits` digits for every page
 *   size that uses the field, so a renderer can never name a page the
 *   codec refuses (PR #269 F-02).
 * - **A hint is written exactly when a later page exists,** and names the
 *   next page: `workshopCapabilityPageOf(...).next`.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/** The most items a JavaScript array holds: no listing is longer. */
export const WORKSHOP_CAPABILITY_LARGEST_LISTING = 2 ** 32 - 1;

const PAGE = new RegExp(`^[1-9][0-9]{0,${PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits - 1}}$`);

export type WorkshopCapabilityPageField =
  | { readonly kind: 'page'; readonly page: number }
  | { readonly kind: 'invalid' };

/** The page a `<page>` field's text names. The text is read exactly as given: nothing is mended. */
export function workshopCapabilityPage(value: string): WorkshopCapabilityPageField {
  return PAGE.test(value) ? { kind: 'page', page: Number(value) } : { kind: 'invalid' };
}

export interface WorkshopCapabilityPageOf {
  /** How many pages `count` items make; zero for none. */
  readonly pages: number;
  /** Whether the page asked lies past the last (of an empty listing, any page but the first). */
  readonly pastEnd: boolean;
  /** The zero-based slice of the listing this page holds; empty when past the end. */
  readonly start: number;
  readonly end: number;
  /** The page a continuation names: present exactly when a later page exists. */
  readonly next?: number;
}

/** Page `page` (from 1) of `count` items, `pageSize` to a page. */
export function workshopCapabilityPageOf(count: number, pageSize: number, page: number): WorkshopCapabilityPageOf {
  const pages = Math.ceil(count / pageSize);
  if (page > Math.max(pages, 1)) {
    return { pages, pastEnd: true, start: count, end: count };
  }
  const start = pageSize * (page - 1);
  return { pages, pastEnd: false, start, end: Math.min(pageSize * page, count), ...(page < pages ? { next: page + 1 } : {}) };
}
