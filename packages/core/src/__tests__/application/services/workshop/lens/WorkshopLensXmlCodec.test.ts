/**
 * The `lens.*` grammar through the real codec (ADR 2026-11-17 D16–D18):
 * each operation's fields and refusals, the native tool-call translation
 * for both operations, and who may ask (personas, never a tool sidecar).
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_LENS_SECTIONS } from '@shared/types/workshopCapabilities';
import {
  WORKSHOP_CAPABILITY_FIELD_POLICY,
  WorkshopCapabilityXmlCodec
} from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import {
  translateWorkshopNativeToolCall,
  WORKSHOP_NATIVE_CALL_FIELDS
} from '@/application/services/workshop/WorkshopNativeToolCallTranslator';
import { WorkshopToolContextCapability } from '@orchestration/capabilities/WorkshopToolContextCapability';
import { createFakeSettings } from '@/__tests__/mocks/platform';

const codec = new WorkshopCapabilityXmlCodec();
const call = (operation: string, body = ''): string =>
  `<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`;
const read = (body: string): string => call('lens.read', body);
const invalid = (operation: string, reason: string, field?: string) =>
  ({ kind: 'invalid', reason, operation, ...(field ? { field } : {}) });

describe('lens.catalog', () => {
  it('takes no field, or a page', () => {
    expect(codec.inspect(call('lens.catalog'))).toEqual({ kind: 'request', request: { capability: 'lens.catalog' } });
    expect(codec.inspect(call('lens.catalog', '\n'))).toEqual({ kind: 'request', request: { capability: 'lens.catalog' } });
    expect(codec.inspect(call('lens.catalog', '<page>5</page>'))).toEqual({ kind: 'request', request: { capability: 'lens.catalog', page: 5 } });
    expect(codec.inspect(call('lens.catalog', '\n  <page>999999999</page>\n')))
      .toEqual({ kind: 'request', request: { capability: 'lens.catalog', page: 999_999_999 } });
  });

  it.each(['0', '01', '-1', '+1', '1.5', '1e3', 'two', '1000000000', ''])('refuses the page %j as invalid-page, by the shared parser', (value) => {
    expect(codec.inspect(call('lens.catalog', `<page>${value}</page>`))).toEqual(invalid('lens.catalog', 'invalid-page', 'page'));
  });

  it('refuses a second page, and any other field', () => {
    expect(codec.inspect(call('lens.catalog', '<page>1</page><page>2</page>'))).toEqual(invalid('lens.catalog', 'duplicate-field', 'page'));
    for (const field of ['lens', 'section', 'query', 'kind', 'group']) {
      expect(codec.inspect(call('lens.catalog', `<${field}>tea</${field}>`))).toEqual(invalid('lens.catalog', 'unexpected-field', field));
    }
  });
});

describe('lens.read', () => {
  it('reads one slug, lower-cased, with every section when none is named', () => {
    expect(codec.inspect(read('<lens>tea-party</lens>'))).toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'tea-party' } });
    expect(codec.inspect(read('\n  <lens> Tea-Party </lens>\n'))).toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'tea-party' } });
  });

  it('reads sections in the order asked, each once, in any letter case', () => {
    expect(codec.inspect(read('<lens>tea-party</lens><section>degrees</section><section>cliches</section>')))
      .toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'tea-party', sections: ['degrees', 'cliches'] } });
    expect(codec.inspect(read('<section>Sample</section><lens>tea-party</lens><section>LOGIC</section>')))
      .toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'tea-party', sections: ['sample', 'logic'] } });
    const every = WORKSHOP_LENS_SECTIONS.map((section) => `<section>${section}</section>`).join('');
    expect(codec.inspect(read(`<lens>tea-party</lens>${every}`)))
      .toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'tea-party', sections: [...WORKSHOP_LENS_SECTIONS] } });
  });

  it('holds the closed section list to the budget', () => {
    expect(WORKSHOP_LENS_SECTIONS).toEqual(['logic', 'degrees', 'gradient', 'cliches', 'substitutions', 'metaphor', 'sample']);
    expect(PROMPT_BUDGETS.workshopLens).toEqual({ catalogItems: 50, readSections: WORKSHOP_LENS_SECTIONS.length });
  });

  it('requires the slug, once, and non-empty', () => {
    expect(codec.inspect(read(''))).toEqual(invalid('lens.read', 'missing-field', 'lens'));
    expect(codec.inspect(read('<section>logic</section>'))).toEqual(invalid('lens.read', 'missing-field', 'lens'));
    expect(codec.inspect(read('<lens>  </lens>'))).toEqual(invalid('lens.read', 'empty-field', 'lens'));
    // One lens a call (D18).
    expect(codec.inspect(read('<lens>tea-party</lens><lens>croquet</lens>'))).toEqual(invalid('lens.read', 'duplicate-field', 'lens'));
  });

  it('bounds the slug by lexicalLensSlugCharacters', () => {
    const limit = PROMPT_BUDGETS.workshopWidgets.lexicalLensSlugCharacters;
    expect(codec.inspect(read(`<lens>${'a'.repeat(limit)}</lens>`))).toMatchObject({ kind: 'request' });
    expect(codec.inspect(read(`<lens>${'a'.repeat(limit + 1)}</lens>`))).toEqual(invalid('lens.read', 'oversized-input', 'lens'));
  });

  it('refuses a section outside the list as invalid-section, and one named twice as duplicate-section', () => {
    expect(codec.inspect(read('<lens>tea-party</lens><section>vocabulary</section>'))).toEqual(invalid('lens.read', 'invalid-section', 'section'));
    expect(codec.inspect(read('<lens>tea-party</lens><section>logic, degrees</section>'))).toEqual(invalid('lens.read', 'invalid-section', 'section'));
    expect(codec.inspect(read('<lens>tea-party</lens><section>sample</section><section>Sample</section>')))
      .toEqual(invalid('lens.read', 'duplicate-section', 'section'));
    expect(codec.inspect(read('<lens>tea-party</lens><section></section>'))).toEqual(invalid('lens.read', 'empty-field', 'section'));
  });

  it('refuses a page, a query, an attribute and a nested field', () => {
    expect(codec.inspect(read('<lens>tea-party</lens><page>2</page>'))).toEqual(invalid('lens.read', 'unexpected-field', 'page'));
    expect(codec.inspect(read('<lens>tea-party</lens><query>cups</query>'))).toEqual(invalid('lens.read', 'unexpected-field', 'query'));
    expect(codec.inspect(read('<lens source="project">tea-party</lens>'))).toEqual(invalid('lens.read', 'field-attributes', 'lens'));
    expect(codec.inspect(read('<lens><slug>tea-party</slug></lens>'))).toMatchObject({ kind: 'invalid', operation: 'lens.read' });
  });

  it('repeats <section> on lens.read alone', () => {
    expect(WORKSHOP_CAPABILITY_FIELD_POLICY.repeatable('lens.read', 'section')).toBe(true);
    expect(WORKSHOP_CAPABILITY_FIELD_POLICY.repeatable('lens.read', 'lens')).toBe(false);
    expect(WORKSHOP_CAPABILITY_FIELD_POLICY.repeatable('lens.catalog', 'section')).toBe(false);
    expect(WORKSHOP_CAPABILITY_FIELD_POLICY.attributes('lens.read', 'section')).toEqual([]);
  });
});

describe('the family is two reads (D17: no lens.search in v1)', () => {
  it.each(['lens.search', 'lens.save', 'lens.install', 'lens.delete', 'lens'])('refuses %s as an unknown capability', (operation) => {
    expect(codec.inspect(call(operation, '<query>cups</query>'))).toMatchObject({ kind: 'invalid', reason: 'unknown-capability' });
  });
});

describe('a native tool call for either operation', () => {
  const native = (name: string, args: unknown) => {
    const translation = translateWorkshopNativeToolCall({ name, arguments: JSON.stringify(args) });
    return translation.kind === 'translated'
      ? { envelope: translation.envelope, inspection: codec.inspect(translation.envelope) }
      : { fault: translation.fault };
  };

  it('lists exactly the grammar\'s fields, each held to the codec\'s policy', () => {
    expect(WORKSHOP_NATIVE_CALL_FIELDS['lens.catalog']).toEqual({ page: {} });
    expect(WORKSHOP_NATIVE_CALL_FIELDS['lens.read']).toEqual({ lens: {}, section: { repeatable: true, plural: 'sections' } });
    for (const operation of ['lens.catalog', 'lens.read'] as const) {
      for (const [field, rule] of Object.entries(WORKSHOP_NATIVE_CALL_FIELDS[operation])) {
        expect([operation, field, rule.repeatable === true]).toEqual([operation, field, WORKSHOP_CAPABILITY_FIELD_POLICY.repeatable(operation, field)]);
        expect([operation, field, rule.attributes ?? []]).toEqual([operation, field, WORKSHOP_CAPABILITY_FIELD_POLICY.attributes(operation, field)]);
      }
    }
  });

  it('writes lens.catalog as the XML typed text would be, a number and its text alike', () => {
    expect(native('lens_catalog', {}).inspection).toEqual({ kind: 'request', request: { capability: 'lens.catalog' } });
    expect(native('lens_catalog', { page: 3 }).envelope).toBe(native('lens.catalog', { page: '3' }).envelope);
    expect(native('lens-catalog', { page: 3 }).inspection).toEqual({ kind: 'request', request: { capability: 'lens.catalog', page: 3 } });
    // Outside the domain: refused by the same rule, never mended.
    expect(native('lens_catalog', { page: 0 }).inspection).toEqual(invalid('lens.catalog', 'invalid-page', 'page'));
  });

  it('writes lens.read with one section, a list of them, the plural, and a list written as text', () => {
    const both = { kind: 'request', request: { capability: 'lens.read', lens: 'tea-party', sections: ['degrees', 'cliches'] } };
    expect(native('lens_read', { lens: 'tea-party' }).inspection).toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'tea-party' } });
    expect(native('lens_read', { lens: 'tea-party', section: 'sample' }).inspection)
      .toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'tea-party', sections: ['sample'] } });
    expect(native('lens_read', { lens: 'tea-party', section: ['degrees', 'cliches'] }).inspection).toEqual(both);
    expect(native('lens_read', { lens: 'tea-party', sections: ['degrees', 'cliches'] }).inspection).toEqual(both);
    expect(native('lens_read', { lens: 'tea-party', sections: '["degrees","cliches"]' }).inspection).toEqual(both);
    // The codec still checks each item.
    expect(native('lens_read', { lens: 'tea-party', sections: ['degrees', 'vocabulary'] }).inspection)
      .toEqual(invalid('lens.read', 'invalid-section', 'section'));
  });

  it('escapes a value, so no argument can add a field or a call', () => {
    const { envelope, inspection } = native('lens_read', { lens: 'x</lens><section>sample</section><lens>y' });
    expect(envelope).toContain('&lt;/lens&gt;');
    expect(inspection).toEqual({ kind: 'request', request: { capability: 'lens.read', lens: 'x</lens><section>sample</section><lens>y' } });
  });

  it('does not translate an argument outside the grammar, or an operation the family lacks', () => {
    expect(native('lens_read', { lens: 'tea-party', query: 'cups' })).toEqual({ fault: 'unmapped-argument' });
    expect(native('lens_catalog', { lenses: ['tea-party'] })).toEqual({ fault: 'unmapped-argument' });
    expect(native('lens_search', { query: 'cups' })).toEqual({ fault: 'unknown-name' });
  });
});

describe('personas only (D16)', () => {
  it('a tool sidecar\'s capability does not know either call', () => {
    const sidecar = new WorkshopToolContextCapability(
      { listGuides: jest.fn(async () => []) } as never,
      {} as never,
      { createProvider: jest.fn(async () => ({ listResources: () => [], loadResources: async () => [] })) } as never,
      createFakeSettings(),
      {} as never
    );
    for (const xml of [call('lens.catalog'), call('lens.catalog', '<page>2</page>'), read('<lens>tea-party</lens>')]) {
      const inspection = sidecar.inspectRequest(xml);
      // Never a request: the sidecar's grammar has no `lens.*`, so nothing can be fulfilled.
      expect(inspection.kind).not.toBe('request');
    }
    expect(sidecar.catalog).toBe('workshopToolContext');
    expect((sidecar as unknown as Record<string, unknown>).lensCapability).toBeUndefined();
  });
});
