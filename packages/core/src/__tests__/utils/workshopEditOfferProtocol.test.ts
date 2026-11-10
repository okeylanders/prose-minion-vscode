/**
 * The edit-offer trailer's codec (ADR 2026-11-10 D1; epic Slice 1): a closed
 * kind, the file named as a file-edit trailer names it, an optional count
 * from 1 to 99, and every fault a value. Made-up text: Alice.
 */
import { WORKSHOP_EDIT_OFFER_KINDS } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  decodeWorkshopEditOffer,
  isWorkshopEditOfferCount,
  WORKSHOP_EDIT_OFFER_ELEMENTS,
  WORKSHOP_EDIT_OFFER_TAG
} from '@/utils/workshopEditOfferProtocol';
import { decodeWorkshopFileEdit } from '@/utils/workshopFileEditProtocol';

const fault = (inner: string) => {
  const decoded = decodeWorkshopEditOffer(inner);
  return decoded.kind === 'rejected' ? decoded.fault : decoded.offer;
};
const FILE = '<group>chapters</group><path>chapters/down-the-rabbit-hole.md</path>';

describe('decodeWorkshopEditOffer', () => {
  it('names the tag, the closed kinds and the closed elements', () => {
    expect(WORKSHOP_EDIT_OFFER_TAG).toBe('prose-minion-edit-offer');
    expect(WORKSHOP_EDIT_OFFER_KINDS).toEqual(['fixes', 'rewrites']);
    expect(WORKSHOP_EDIT_OFFER_ELEMENTS).toEqual(['kind', 'group', 'path', 'excerpt', 'count']);
  });

  it('reads each kind, for the excerpt or a catalog file, with or without a count', () => {
    expect(decodeWorkshopEditOffer('\n  <kind>fixes</kind>\n  <excerpt/>\n  <count>3</count>\n')).toEqual({
      kind: 'offer', offer: { kind: 'fixes', target: { kind: 'excerpt' }, count: 3 }
    });
    expect(decodeWorkshopEditOffer(`<kind> Rewrites </kind>${FILE}`)).toEqual({
      kind: 'offer',
      offer: { kind: 'rewrites', target: { kind: 'resource', group: 'chapters', path: 'chapters/down-the-rabbit-hole.md' } }
    });
    // The elements may come in any order.
    expect(fault(`<count>2</count>${FILE}<kind>fixes</kind>`)).toMatchObject({ kind: 'fixes', count: 2 });
  });

  it('refuses a missing or unknown kind', () => {
    expect(fault('<excerpt/>')).toBe('missing-kind');
    expect(fault('<kind> </kind><excerpt/>')).toBe('missing-kind');
    expect(fault('<kind>polish</kind><excerpt/>')).toBe('unknown-kind');
    expect(fault('<kind>fixes rewrites</kind><excerpt/>')).toBe('unknown-kind');
  });

  it('names the file by the file-edit codec\'s rule, fault for fault', () => {
    const targets: ReadonlyArray<readonly [string, string]> = [
      ['', 'missing-target'],
      ['<excerpt/><group>chapters</group>', 'conflicting-target'],
      ['<path>chapters/one.md</path>', 'missing-group'],
      ['<group>chapters</group>', 'missing-path'],
      ['<group>diaries</group><path>one.md</path>', 'unknown-group'],
      ['<group>chapters</group><path>../one.md</path>', 'invalid-path'],
      ['<group>chapters</group><path>/etc/passwd</path>', 'invalid-path'],
      [`<group>chapters</group><path>${'a'.repeat(PROMPT_BUDGETS.workshopResource.pathCharacters + 1)}</path>`, 'path-too-long'],
      ['<excerpt>Alice</excerpt>', 'excerpt-not-empty']
    ];
    for (const [target, expected] of targets) {
      expect(fault(`<kind>fixes</kind>${target}`)).toBe(expected);
      // The same target is the same fault in a file edit.
      const edit = decodeWorkshopFileEdit(`${target}<why>Alice.</why><find>a</find><replace-with>b</replace-with>`);
      expect(edit).toEqual({ kind: 'rejected', fault: expected });
    }
  });

  it('holds the count to a whole number from 1 to the bound, in digits', () => {
    const count = (written: string) => fault(`<kind>fixes</kind><excerpt/><count>${written}</count>`);
    expect(count('1')).toMatchObject({ count: 1 });
    expect(count(` ${PROMPT_BUDGETS.workshopEditOffers.count} `)).toMatchObject({ count: 99 });
    for (const bad of ['0', '100', '-1', '+3', '03', '3.0', '1e1', 'three', '', '3 fixes', '９']) {
      expect(count(bad)).toBe('invalid-count');
    }
    expect(isWorkshopEditOfferCount(99)).toBe(true);
    for (const bad of [0, 100, 1.5, Number.NaN, '3', null, undefined]) {
      expect(isWorkshopEditOfferCount(bad)).toBe(false);
    }
  });

  it('refuses a repeated element, an element outside the format, and text between elements', () => {
    expect(fault('<kind>fixes</kind><kind>rewrites</kind><excerpt/>')).toBe('repeated-element');
    expect(fault('<kind>fixes</kind><excerpt/><count>1</count><count>2</count>')).toBe('repeated-element');
    expect(fault('<kind>fixes</kind><excerpt/><excerpt/>')).toBe('repeated-element');
    expect(fault('<kind>fixes</kind><excerpt/><why>Alice</why>')).toBe('unknown-element');
    expect(fault('<kind>fixes</kind><excerpt/><find>Alice</find>')).toBe('unknown-element');
    expect(fault('<kind>fixes</kind><excerpt/> three typos')).toBe('stray-text');
    expect(fault('<kind>fixes<excerpt/>')).toBe('unclosed-element');
    expect(fault('<kind/><excerpt/>')).toBe('stray-text');
  });
});
