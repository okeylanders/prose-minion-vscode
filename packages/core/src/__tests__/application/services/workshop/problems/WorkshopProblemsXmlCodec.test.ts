import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const codec = new WorkshopCapabilityXmlCodec();
const inspect = (fields: string) => codec.inspect(
  `<prose-minion-tool-call name="problems.read">${fields}</prose-minion-tool-call>`
);
const excerpt = '<group>excerpt</group>';

describe('problems.read XML validation', () => {
  it.each([
    ['', 'missing-field'],
    ['<group/>', 'empty-field'],
    ['<group>chapters</group>', 'missing-field'],
    ['<group>unknown</group><path>Drafts/Chapter.md</path>', 'unknown-resource-group'],
    ['<group>chapters</group><path>../Chapter.md</path>', 'invalid-resource-path'],
    ['<group>chapters</group><path>/private/Chapter.md</path>', 'invalid-resource-path'],
    ['<group>chapters</group><path>C:\\Drafts\\Chapter.md</path>', 'invalid-resource-path'],
    [`<group>chapters</group><path>${'a'.repeat(PROMPT_BUDGETS.workshopResource.pathCharacters + 1)}</path>`, 'oversized-input'],
    [`${excerpt}<path>Drafts/Chapter.md</path>`, 'unexpected-field'],
    [`${excerpt}<uri>file:///Drafts/Chapter.md</uri>`, 'unexpected-field'],
    [`${excerpt}<group>chapters</group>`, 'duplicate-field'],
    [`${excerpt}<start from="2">1</start>`, 'field-attributes']
  ])('refuses invalid or additional file selectors (%#)', (fields, reason) => {
    expect(inspect(fields)).toMatchObject({ kind: 'invalid', operation: 'problems.read', reason });
  });

  it.each(['', '0', '-1', '+1', '01', '2.5', '1 2', '1000000000'])('refuses an invalid start %j', start => {
    expect(inspect(`${excerpt}<start>${start}</start>`))
      .toEqual({ kind: 'invalid', operation: 'problems.read', reason: 'invalid-start', field: 'start' });
  });

  it('decodes a bounded continuation number as a decimal entry offset', () => {
    const start = '9'.repeat(PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits);
    expect(inspect(`${excerpt}<start>${start}</start>`)).toEqual({
      kind: 'request', request: { capability: 'problems.read', file: { kind: 'excerpt' }, start: Number(start) }
    });
  });
});
