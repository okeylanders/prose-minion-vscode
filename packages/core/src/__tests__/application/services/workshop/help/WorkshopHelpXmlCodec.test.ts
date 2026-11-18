import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const codec = new WorkshopCapabilityXmlCodec();
const inspect = (operation: string, body: string) =>
  codec.inspect(`<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`);
const section = (id: string) => `<section>${id}</section>`;
const query = (text: string) => `<query>${text}</query>`;
const bounds = PROMPT_BUDGETS.workshopHelp;
const longestId = 'a#' + 's'.repeat(bounds.sectionIdCharacters - 2);

describe('help requests through the persona XML codec', () => {
  it('takes one query up to the search bound', () => {
    const text = 'a'.repeat(bounds.queryCharacters);
    expect(inspect('help.search', query(text))).toEqual({ kind: 'request', request: { capability: 'help.search', query: text } });
  });

  it('accepts distinct ids in order, including an unknown but well-formed id', () => {
    const sections = ['workshop#pinned-context', 'other#unknown', longestId];
    expect(inspect('help.read', sections.map(section).join(''))).toEqual({
      kind: 'request', request: { capability: 'help.read', sections }
    });
  });

  it.each([
    ['help.search', '', 'missing-field', 'query'],
    ['help.search', query(' '), 'empty-field', 'query'],
    ['help.search', query('a'.repeat(bounds.queryCharacters + 1)), 'oversized-input', 'query'],
    ['help.search', query('a') + query('b'), 'duplicate-field', 'query'],
    ['help.search', query('a') + '<page>2</page>', 'unexpected-field', 'page'],
    ['help.read', '', 'missing-field', 'section'],
    ['help.read', section(' '), 'empty-field', 'section'],
    ['help.read', section(longestId + 's'), 'invalid-section', 'section'],
    ['help.read', section('workshop#pinned context'), 'invalid-section', 'section'],
    ['help.read', section('workshop#.private/inside'), 'invalid-section', 'section'],
    ['help.read', section('workshop#pin') + section('workshop#pin'), 'duplicate-section', 'section'],
    ['help.read', Array.from({ length: bounds.readSections + 1 }, (_, i) => section(`area#heading-${i}`)).join(''), 'too-many-sections', 'section'],
    ['help.read', '<section area="workshop">pin</section>', 'field-attributes', 'section'],
    ['help.read', query('pin'), 'unexpected-field', 'query']
  ])('refuses %s with %s as %s', (operation, body, reason, field) => {
    expect(inspect(operation, body)).toEqual({ kind: 'invalid', reason, field, operation });
  });

  it('keeps help.catalog unknown', () => {
    expect(inspect('help.catalog', '')).toEqual({ kind: 'invalid', reason: 'unknown-capability' });
  });
});
