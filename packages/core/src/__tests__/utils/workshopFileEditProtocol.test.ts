/**
 * The file-edit trailer's codec (ADR 2026-11-05 D2; epic Slice 3): every
 * fault is a value, never thrown; the target is `resource.read`'s or the
 * excerpt; the operations keep the order written and map onto the shared
 * planner's; each bound is the budget's. Made-up text: Alice.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  decodeWorkshopFileEdit,
  sameWorkshopFileEditTarget,
  workshopFileEditOperationsFault,
  workshopFileEditTextOperations,
  type WorkshopFileEditFault
} from '@/utils/workshopFileEditProtocol';
import { planTextEdits } from '@/utils/textEdits/planTextEdits';

const B = PROMPT_BUDGETS.workshopFileEdits;
const TARGET = '<group>characters</group><path>characters/alice.md</path>';
const WHY = '<why>Alice is ten now.</why>';
const PAIR = '<find>Alice is seven</find><replace-with>Alice is ten</replace-with>';

const decode = (inner: string) => decodeWorkshopFileEdit(inner);
const fault = (inner: string): WorkshopFileEditFault | undefined => {
  const decoded = decode(inner);
  return decoded.kind === 'rejected' ? decoded.fault : undefined;
};

describe('decodeWorkshopFileEdit', () => {
  it('decodes a resource target, its why and its operations, in the order written', () => {
    const decoded = decode(`
      ${TARGET}
      <prepend>Chapter notes.</prepend>
      ${WHY}
      <find>Alice is seven</find>
      <replace-with>Alice is ten</replace-with>
      <append>She follows the Rabbit.</append>
      <find>the Dormouse</find>
      <replace-with></replace-with>
    `);
    expect(decoded).toEqual({
      kind: 'edit',
      edit: {
        target: { kind: 'resource', group: 'characters', path: 'characters/alice.md' },
        why: 'Alice is ten now.',
        operations: [
          { op: 'prepend', text: 'Chapter notes.' },
          { op: 'replace', find: 'Alice is seven', with: 'Alice is ten' },
          { op: 'append', text: 'She follows the Rabbit.' },
          { op: 'replace', find: 'the Dormouse', with: '' }
        ]
      }
    });
  });

  it.each(['<excerpt/>', '<excerpt />', '<EXCERPT/>', '<excerpt></excerpt>', '<excerpt>  </excerpt>'])('reads %s as the excerpt', (excerpt) => {
    expect(decode(`${excerpt}${WHY}${PAIR}`)).toMatchObject({ kind: 'edit', edit: { target: { kind: 'excerpt' } } });
  });

  it('a rewrite stands alone, its text trimmed', () => {
    expect(decode(`${TARGET}${WHY}<rewrite>\n# Alice\n\nTen years old.\n</rewrite>`)).toMatchObject({
      kind: 'edit',
      edit: { operations: [{ op: 'rewrite', text: '# Alice\n\nTen years old.' }] }
    });
  });

  it('the operations are the shared planner\'s, so a card plans exactly as written', () => {
    const decoded = decode(`${TARGET}${WHY}${PAIR}<append>She follows the Rabbit.</append>`);
    if (decoded.kind !== 'edit') {
      throw new Error('expected an edit');
    }
    const plan = planTextEdits('Alice is seven.', workshopFileEditTextOperations(decoded.edit.operations), { allowsRewrite: true });
    expect(plan.kind).toBe('planned');
  });

  describe('faults, by reason', () => {
    const pairs = (count: number) => Array.from({ length: count }, (_, index) =>
      `<find>quote ${index}</find><replace-with>with ${index}</replace-with>`).join('');
    it.each<[string, string, WorkshopFileEditFault]>([
      ['text between elements', `${TARGET}${WHY} stray ${PAIR}`, 'stray-text'],
      ['an unknown element', `${TARGET}${WHY}<field>x</field>${PAIR}`, 'unknown-element'],
      ['an unclosed element', `${TARGET}${WHY}<find>Alice`, 'unclosed-element'],
      ['a self-closed element that holds text', `${TARGET}<why/>${PAIR}`, 'stray-text'],
      ['a repeated group', `${TARGET}<group>themes</group>${WHY}${PAIR}`, 'repeated-element'],
      ['a repeated why', `${TARGET}${WHY}${WHY}${PAIR}`, 'repeated-element'],
      ['a second append', `${TARGET}${WHY}<append>a</append><append>b</append>`, 'repeated-element'],
      ['a second prepend', `${TARGET}${WHY}<prepend>a</prepend><prepend>b</prepend>`, 'repeated-element'],
      ['a second rewrite', `${TARGET}${WHY}<rewrite>a</rewrite><rewrite>b</rewrite>`, 'repeated-element'],
      ['no target', `${WHY}${PAIR}`, 'missing-target'],
      ['the excerpt and a path', `<excerpt/><path>characters/alice.md</path>${WHY}${PAIR}`, 'conflicting-target'],
      ['the excerpt holding text', `<excerpt>chapter one</excerpt>${WHY}${PAIR}`, 'excerpt-not-empty'],
      ['a path and no group', `<path>characters/alice.md</path>${WHY}${PAIR}`, 'missing-group'],
      ['a group and no path', `<group>characters</group>${WHY}${PAIR}`, 'missing-path'],
      ['an empty path', `<group>characters</group><path> </path>${WHY}${PAIR}`, 'missing-path'],
      ['an unknown group', `<group>secrets</group><path>secrets/a.md</path>${WHY}${PAIR}`, 'unknown-group'],
      ['no why', `${TARGET}${PAIR}`, 'missing-why'],
      ['an empty why', `${TARGET}<why> </why>${PAIR}`, 'missing-why'],
      ['a why on two lines', `${TARGET}<why>Alice\nis ten.</why>${PAIR}`, 'why-not-one-line'],
      ['a why past its bound', `${TARGET}<why>${'a'.repeat(B.whyCharacters + 1)}</why>${PAIR}`, 'why-too-long'],
      ['no operation', `${TARGET}${WHY}`, 'empty-edit'],
      ['an empty rewrite', `${TARGET}${WHY}<rewrite> </rewrite>`, 'empty-edit'],
      ['an empty append', `${TARGET}${WHY}<append></append>`, 'empty-edit'],
      ['an empty prepend', `${TARGET}${WHY}<prepend>\n</prepend>`, 'empty-edit'],
      ['a find with no replace-with', `${TARGET}${WHY}<find>Alice</find>`, 'unpaired-find'],
      ['a find followed by something else', `${TARGET}${WHY}<find>Alice</find><append>x</append><replace-with>y</replace-with>`, 'unpaired-find'],
      ['a replace-with on its own', `${TARGET}${WHY}<replace-with>Alice</replace-with>`, 'unpaired-find'],
      ['an empty find', `${TARGET}${WHY}<find> </find><replace-with>Alice</replace-with>`, 'empty-find'],
      ['more pairs than the cap', `${TARGET}${WHY}${pairs(B.editReplaces + 1)}`, 'too-many-replaces'],
      ['a rewrite beside a replace', `${TARGET}${WHY}<rewrite>a</rewrite>${PAIR}`, 'conflicting-operations'],
      ['a rewrite beside an append', `${TARGET}${WHY}<append>a</append><rewrite>b</rewrite>`, 'conflicting-operations'],
      ['a rewrite past its bound', `${TARGET}${WHY}<rewrite>${'a'.repeat(B.rewriteCharacters + 1)}</rewrite>`, 'rewrite-too-long'],
      ['a find past its bound', `${TARGET}${WHY}<find>${'a'.repeat(B.findCharacters + 1)}</find><replace-with>b</replace-with>`, 'find-too-long'],
      ['a replace-with past its bound', `${TARGET}${WHY}<find>a</find><replace-with>${'b'.repeat(B.replaceWithCharacters + 1)}</replace-with>`, 'replace-with-too-long'],
      ['an append past its bound', `${TARGET}${WHY}<append>${'a'.repeat(B.passageCharacters + 1)}</append>`, 'passage-too-long'],
      ['a prepend past its bound', `${TARGET}${WHY}<prepend>${'a'.repeat(B.passageCharacters + 1)}</prepend>`, 'passage-too-long']
    ])('%s', (_name, inner, expected) => {
      expect(fault(inner)).toBe(expected);
    });

    it('takes exactly the cap of pairs, and the bounds themselves', () => {
      expect(fault(`${TARGET}${WHY}${pairs(B.editReplaces)}`)).toBeUndefined();
      expect(fault(`${TARGET}<why>${'a'.repeat(B.whyCharacters)}</why><append>${'a'.repeat(B.passageCharacters)}</append>`)).toBeUndefined();
    });

    it('never throws, whatever it reads', () => {
      for (const inner of ['', '<', '</why>', '<why><why></why>', '<excerpt/><excerpt/>', '<<>>', '\u0000']) {
        expect(() => decode(inner)).not.toThrow();
      }
    });
  });

  describe('a resource path, by resource.read\'s rule', () => {
    const withPath = (path: string) => fault(`<group>chapters</group><path>${path}</path>${WHY}${PAIR}`);
    it.each([
      '/abs/alice.md',
      'C:/alice.md',
      'c:alice.md',
      'file:///alice.md',
      'chapters/../secret.md',
      'chapters/./one.md',
      '../one.md',
      'chapters//one.md',
      'chapters\\one.md',
      'chapters/one.md/'
    ])('refuses %s', (path) => {
      expect(withPath(path)).toBe('invalid-path');
    });

    it('refuses a path past `resource.read`\'s bound, and keeps one at it', () => {
      const bound = PROMPT_BUDGETS.workshopResource.pathCharacters;
      expect(withPath(`chapters/${'a'.repeat(bound - 'chapters/'.length + 1)}`)).toBe('path-too-long');
      expect(withPath(`chapters/${'a'.repeat(bound - 'chapters/'.length)}`)).toBeUndefined();
    });

    it('keeps a nested workspace-relative path', () => {
      expect(withPath('book/part one/chapter-1.md')).toBeUndefined();
    });
  });
});

describe('workshopFileEditOperationsFault', () => {
  it('holds a saved card\'s operations to the decoder\'s rules', () => {
    expect(workshopFileEditOperationsFault([])).toBe('empty-edit');
    expect(workshopFileEditOperationsFault([{ op: 'rewrite', text: 'a' }, { op: 'append', text: 'b' }])).toBe('conflicting-operations');
    expect(workshopFileEditOperationsFault([{ op: 'replace', find: 'a', with: '' }])).toBeUndefined();
  });
});

describe('sameWorkshopFileEditTarget', () => {
  it('names one file by group and path ignoring case, or both the excerpt', () => {
    const alice = { kind: 'resource', group: 'characters', path: 'characters/alice.md' } as const;
    expect(sameWorkshopFileEditTarget(alice, { ...alice, path: 'characters/Alice.md' })).toBe(true);
    expect(sameWorkshopFileEditTarget(alice, { ...alice, group: 'general' })).toBe(false);
    expect(sameWorkshopFileEditTarget({ kind: 'excerpt' }, { kind: 'excerpt' })).toBe(true);
    expect(sameWorkshopFileEditTarget({ kind: 'excerpt' }, alice)).toBe(false);
  });
});
