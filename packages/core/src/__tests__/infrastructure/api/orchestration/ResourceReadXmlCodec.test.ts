import { ResourceReadXmlCodec } from '@orchestration/ResourceReadXmlCodec';

const request = (paths: string) => `<prose-minion-tool-call name="resource.read"><paths>${paths}</paths></prose-minion-tool-call>`;
const path = (value: string) => `<path>${value}</path>`;

describe('ResourceReadXmlCodec', () => {
  const codec = new ResourceReadXmlCodec();

  it('decodes the one valid resource.read XML envelope', () => {
    expect(codec.parseExactRequest(`\n${request(`${path('story.md')}${path('characters/mara.md')}`)}\n`)).toEqual({
      operation: 'resource.read',
      paths: ['story.md', 'characters/mara.md']
    });
  });

  it.each([
    ['malformed XML', '<prose-minion-tool-call name="resource.read"><paths><path>story.md</path></paths>'],
    ['an unknown operation', request(path('story.md')).replace('resource.read', 'dictionary.lookup')],
    ['multiple roots', `${request(path('story.md'))}${request(path('characters/mara.md'))}`],
    ['an XML declaration', `<?xml version="1.0"?>${request(path('story.md'))}`],
    ['a comment outside the root', `<!-- no -->${request(path('story.md'))}`],
    ['a duplicate paths container', '<prose-minion-tool-call name="resource.read"><paths><path>story.md</path></paths><paths><path>other.md</path></paths></prose-minion-tool-call>'],
    ['an empty path', request('<path> </path>')],
    ['duplicate paths', request(`${path('story.md')}${path('story.md')}`)],
    ['mixed prose before the call', `Need this first: ${request(path('story.md'))}`],
    ['mixed prose after the call', `${request(path('story.md'))} Then I will answer.`],
    ['a nested unexpected element', request('<path><value>story.md</value></path>')]
  ])('rejects %s', (_reason, candidate) => {
    expect(codec.parseExactRequest(candidate)).toBeUndefined();
  });

  it('hides complete, malformed, and mixed protocol-shaped output from visible content', () => {
    const exact = request(path('story.md'));
    expect(codec.stripExactRequest(exact)).toBe('');
    expect(codec.stripExactRequest(`${exact} prose`)).toBe('');
  });
});
