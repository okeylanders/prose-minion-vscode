/**
 * The `history.*` request codec (ADR 2026-11-19 D11, D13, D14): which file a
 * call may name, a commit id's form, and the continuation fields. Made-up
 * *Alice* paths.
 */
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';

const codec = new WorkshopCapabilityXmlCodec();
const call = (operation: string, fields: string): ReturnType<WorkshopCapabilityXmlCodec['inspect']> =>
  codec.inspect(`<prose-minion-tool-call name="${operation}">${fields}</prose-minion-tool-call>`);

describe('history.log', () => {
  it('names a configured file by group and path, or the excerpt alone', () => {
    expect(call('history.log', '<group>chapters</group><path>Drafts/6.11.md</path>')).toEqual({
      kind: 'request',
      request: { capability: 'history.log', file: { kind: 'configured', group: 'chapters', path: 'Drafts/6.11.md' } }
    });
    expect(call('history.log', '<group>excerpt</group><page>3</page>')).toEqual({
      kind: 'request',
      request: { capability: 'history.log', file: { kind: 'excerpt' }, page: 3 }
    });
  });

  it.each([
    ['<group>excerpt</group><path>Drafts/6.11.md</path>', 'unexpected-field', 'path'],
    ['<group>chapters</group>', 'missing-field', 'path'],
    ['<path>Drafts/6.11.md</path>', 'missing-field', 'group'],
    ['<group>rabbit-hole</group><path>Drafts/6.11.md</path>', 'unknown-resource-group', 'group'],
    ['<group>chapters</group><path>/etc/passwd</path>', 'invalid-resource-path', 'path'],
    ['<group>chapters</group><path>../outside.md</path>', 'invalid-resource-path', 'path'],
    ['<group>chapters</group><path>C:/Wonderland/6.11.md</path>', 'invalid-resource-path', 'path'],
    ['<group>chapters</group><path>Drafts/6.11.md</path><page>0</page>', 'invalid-page', 'page'],
    ['<group>chapters</group><path>Drafts/6.11.md</path><page></page>', 'invalid-page', 'page'],
    ['<group>chapters</group><path>Drafts/6.11.md</path><from>3f9a1c2</from>', 'unexpected-field', 'from']
  ])('refuses %s as %s', (fields, reason, field) => {
    expect(call('history.log', fields)).toEqual({ kind: 'invalid', reason, field, operation: 'history.log' });
  });
});

describe('history.diff', () => {
  it('reads commit ids lower case, a commit or current as <to>, and the continuation fields', () => {
    expect(call('history.diff', '<group>excerpt</group><from>3F9A1C2</from><to>8D04E6A1F9</to>')).toEqual({
      kind: 'request',
      request: { capability: 'history.diff', file: { kind: 'excerpt' }, from: '3f9a1c2', to: { kind: 'commit', commit: '8d04e6a1f9' } }
    });
    expect(call('history.diff', '<group>chapters</group><path>Drafts/6.11.md</path><from>3f9a1c2</from><to>Current</to>' +
      '<startChange>4</startChange><current>ABCDEF012345</current>')).toEqual({
      kind: 'request',
      request: {
        capability: 'history.diff',
        file: { kind: 'configured', group: 'chapters', path: 'Drafts/6.11.md' },
        from: '3f9a1c2',
        to: { kind: 'current', fingerprint: 'abcdef012345' },
        startChange: 4
      }
    });
  });

  it.each([
    ['<from>HEAD</from><to>current</to>', 'invalid-commit', 'from'],
    ['<from>--output=x</from><to>current</to>', 'invalid-commit', 'from'],
    ['<from>3f9a1c</from><to>current</to>', 'invalid-commit', 'from'],
    [`<from>${'a'.repeat(41)}</from><to>current</to>`, 'invalid-commit', 'from'],
    ['<from>3f9a1c2</from><to>main</to>', 'invalid-commit', 'to'],
    ['<from>3f9a1c2</from>', 'missing-field', 'to'],
    ['<to>current</to>', 'missing-field', 'from'],
    ['<from>3f9a1c2</from><to>current</to><startChange>0</startChange>', 'invalid-start-change', 'startChange'],
    ['<from>3f9a1c2</from><to>current</to><startChange></startChange>', 'invalid-start-change', 'startChange'],
    ['<from>3f9a1c2</from><to>current</to><current>xyz</current>', 'invalid-current', 'current'],
    ['<from>3f9a1c2</from><to>8d04e6a</to><current>abcdef012345</current>', 'unexpected-field', 'current']
  ])('refuses %s as %s', (fields, reason, field) => {
    expect(call('history.diff', `<group>excerpt</group>${fields}`)).toEqual({ kind: 'invalid', reason, field, operation: 'history.diff' });
  });

  it('repeats no field and takes no attribute', () => {
    expect(call('history.diff', '<group>excerpt</group><from>3f9a1c2</from><from>8d04e6a</from><to>current</to>'))
      .toMatchObject({ kind: 'invalid', reason: 'duplicate-field' });
    expect(call('history.log', '<group excerpt="1">excerpt</group>')).toMatchObject({ kind: 'invalid', reason: 'field-attributes' });
  });
});
