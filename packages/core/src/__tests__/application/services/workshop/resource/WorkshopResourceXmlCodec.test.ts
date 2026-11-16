/**
 * The `resource.read` grammar (ADR 2026-11-14 D4): repeated `<path>`, a
 * `group` attribute on one, lines only beside exactly one path, and
 * duplicates refused rather than merged.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';

const codec = new WorkshopCapabilityXmlCodec();
const read = (body: string): string => `<prose-minion-tool-call name="resource.read">${body}</prose-minion-tool-call>`;
const refusal = (reason: string, field: string) => ({ kind: 'invalid', reason, field, operation: 'resource.read' });

describe('resource.read grammar', () => {
  it('reads one path with lines, as it always has', () => {
    expect(codec.inspect(read('<group>manuscript</group><path>alice-ch1.md</path><startLine>41</startLine><endLine>80</endLine>')))
      .toEqual({
        kind: 'request',
        request: { capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: 41, endLine: 80 }
      });
  });

  it('reads several paths in the order named, each in the call\'s group', () => {
    expect(codec.inspect(read('<group>manuscript</group><path>alice-ch2.md</path><path>alice-ch1.md</path>'))).toEqual({
      kind: 'request',
      request: {
        capability: 'resource.read',
        files: [{ group: 'manuscript', path: 'alice-ch2.md' }, { group: 'manuscript', path: 'alice-ch1.md' }]
      }
    });
  });

  it('accepts the group and the paths in any order', () => {
    expect(codec.inspect(read('<path>alice-ch1.md</path><group>manuscript</group><path>alice-ch2.md</path>'))).toMatchObject({
      kind: 'request',
      request: { files: [{ group: 'manuscript', path: 'alice-ch1.md' }, { group: 'manuscript', path: 'alice-ch2.md' }] }
    });
  });

  it(`reads ${PROMPT_BUDGETS.workshopResource.readPaths} paths and refuses one more as too-many-paths`, () => {
    const paths = (count: number): string =>
      Array.from({ length: count }, (_, index) => `<path>alice-ch${index + 1}.md</path>`).join('');
    const most = PROMPT_BUDGETS.workshopResource.readPaths;

    const full = codec.inspect(read(`<group>manuscript</group>${paths(most)}`));
    expect(full).toMatchObject({ kind: 'request' });
    expect(full.kind === 'request' && full.request.capability === 'resource.read' && full.request.files).toHaveLength(most);
    expect(codec.inspect(read(`<group>manuscript</group>${paths(most + 1)}`))).toEqual(refusal('too-many-paths', 'path'));
  });

  it('gives a path its own group through the group attribute', () => {
    expect(codec.inspect(read(
      '<group>manuscript</group><path>alice-ch1.md</path><path group="characters">white-rabbit.md</path>'
    ))).toEqual({
      kind: 'request',
      request: {
        capability: 'resource.read',
        files: [{ group: 'manuscript', path: 'alice-ch1.md' }, { group: 'characters', path: 'white-rabbit.md' }]
      }
    });
  });

  it('refuses a group attribute that names no group, and any other attribute', () => {
    expect(codec.inspect(read('<group>manuscript</group><path group="secrets">alice-ch1.md</path>')))
      .toEqual(refusal('unknown-resource-group', 'path'));
    expect(codec.inspect(read('<group>manuscript</group><path group="">alice-ch1.md</path>')))
      .toEqual(refusal('unknown-resource-group', 'path'));
    expect(codec.inspect(read('<group>manuscript</group><path lines="1-4">alice-ch1.md</path>')))
      .toEqual(refusal('field-attributes', 'path'));
    // Only `<path>` carries one, and only on a read.
    expect(codec.inspect(read('<group name="manuscript">manuscript</group><path>alice-ch1.md</path>')))
      .toEqual(refusal('field-attributes', 'group'));
    expect(codec.inspect(
      '<prose-minion-tool-call name="resource.search"><query>Alice</query><path group="manuscript">alice-ch1.md</path></prose-minion-tool-call>'
    )).toMatchObject({ kind: 'invalid', reason: 'field-attributes', operation: 'resource.search' });
  });

  it('still requires the group once, even when every path carries its own', () => {
    expect(codec.inspect(read('<path group="manuscript">alice-ch1.md</path>'))).toEqual(refusal('missing-field', 'group'));
    expect(codec.inspect(read('<group>manuscript</group><group>characters</group><path>alice-ch1.md</path>')))
      .toEqual(refusal('duplicate-field', 'group'));
  });

  it('refuses a path named twice as duplicate-path, never merging it', () => {
    expect(codec.inspect(read('<group>manuscript</group><path>alice-ch1.md</path><path>alice-ch1.md</path>')))
      .toEqual(refusal('duplicate-path', 'path'));
    // The same file reached through a path's own group attribute.
    expect(codec.inspect(read('<group>manuscript</group><path>alice-ch1.md</path><path group="manuscript">alice-ch1.md</path>')))
      .toEqual(refusal('duplicate-path', 'path'));
  });

  it('refuses a repeat that differs only in letter case, deliberately stricter than the lookup', () => {
    expect(codec.inspect(read('<group>manuscript</group><path>Alice.md</path><path>alice.md</path>')))
      .toEqual(refusal('duplicate-path', 'path'));
  });

  it('reads the same path in two groups: they are two files', () => {
    expect(codec.inspect(read('<group>manuscript</group><path>alice.md</path><path group="characters">alice.md</path>')))
      .toMatchObject({ kind: 'request', request: { files: [{ group: 'manuscript' }, { group: 'characters' }] } });
  });

  it.each([
    ['startLine', '<startLine>10</startLine>'],
    ['endLine', '<endLine>40</endLine>'],
    ['startLine', '<startLine>10</startLine><endLine>40</endLine>']
  ])('refuses %s beside two paths as ambiguous-lines', (field, lines) => {
    expect(codec.inspect(read(`<group>manuscript</group><path>alice-ch1.md</path><path>alice-ch2.md</path>${lines}`)))
      .toEqual(refusal('ambiguous-lines', field));
  });

  it('checks every path, wherever it stands', () => {
    expect(codec.inspect(read('<group>manuscript</group><path>alice-ch1.md</path><path>../queen.md</path>')))
      .toEqual(refusal('invalid-resource-path', 'path'));
    expect(codec.inspect(read('<group>manuscript</group><path></path><path>alice-ch1.md</path>')))
      .toEqual(refusal('empty-field', 'path'));
    const long = 'a'.repeat(PROMPT_BUDGETS.workshopResource.pathCharacters + 1);
    expect(codec.inspect(read(`<group>manuscript</group><path>alice-ch1.md</path><path>${long}</path>`)))
      .toEqual(refusal('oversized-input', 'path'));
  });

  it('keeps the other families\' repeatable fields to themselves', () => {
    expect(codec.inspect(read('<group>manuscript</group><path>alice-ch1.md</path><session>abc</session>')))
      .toEqual(refusal('unexpected-field', 'session'));
    expect(codec.inspect(
      '<prose-minion-tool-call name="resource.search"><query>Alice</query><query>Rabbit</query></prose-minion-tool-call>'
    )).toMatchObject({ kind: 'invalid', reason: 'duplicate-field', field: 'query' });
  });
});
