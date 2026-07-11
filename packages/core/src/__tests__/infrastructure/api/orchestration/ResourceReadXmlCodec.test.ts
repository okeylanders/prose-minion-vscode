import { createResourceReadXmlInstruction, ResourceReadXmlCodec } from '@orchestration/ResourceReadXmlCodec';

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

  it('teaches a binary response contract rather than allowing narrated tool intent', () => {
    const instruction = createResourceReadXmlInstruction('characters/mara.md');

    expect(instruction).toContain('There are only two valid response shapes');
    expect(instruction).toContain('complete final response now');
    expect(instruction).toContain('Never narrate an intended lookup or a future action');
    expect(instruction).toContain('<path>characters/mara.md</path>');
    expect(instruction).toContain('complete opaque resource key');
    expect(instruction).not.toContain('```');
  });

  it.each([
    ['a Markdown fence around the call', `\`\`\`xml\n%s\n\`\`\``],
    ['a fence without a language tag', `\`\`\`\n%s\n\`\`\``],
    ['a narrated preamble before the call', 'I need to pull some descriptors first.\n\n%s'],
    ['a narrated preamble and a fence', 'Let me load the guides.\n```xml\n%s\n```'],
    ['an XML declaration before the call', '<?xml version="1.0"?>\n%s']
  ])('tolerates %s and extracts the exact tail request', (_garnish, template) => {
    const exact = request(path('private/project/character.md'));
    expect(codec.inspect(template.replace('%s', exact))).toEqual({
      kind: 'request',
      request: { operation: 'resource.read', paths: ['private/project/character.md'] }
    });
  });

  it('keeps protocol markup followed by prose non-executable', () => {
    const exact = request(path('private/project/character.md'));
    expect(codec.inspect(`${exact} Then I will answer.`)).toMatchObject({
      kind: 'invalid', reason: 'mixed-content', pathCount: 1
    });
    expect(codec.inspect(`Quoting the protocol: ${exact} — and continuing my answer.`)).toMatchObject({
      kind: 'invalid', reason: 'mixed-content', pathCount: 1
    });
    expect(codec.inspect(`\`\`\`xml\n${exact}\n\`\`\`\nNow I will wait for the guides.`)).toMatchObject({
      kind: 'invalid', reason: 'mixed-content'
    });
    expect(codec.inspect('Ordinary final prose.')).toEqual({ kind: 'none' });
  });

  it('classifies a genuine answer that mentions the protocol as prose, not a call', () => {
    const quoted = 'The protocol expects `<prose-minion-tool-call name="resource.read">`, but none was ' +
      'needed, so here is my analysis: the dialogue tags are strong and the beats land.';
    expect(codec.inspect(quoted)).toEqual({ kind: 'none' });
    expect(codec.hideIfProtocolShaped(quoted)).toBe(quoted);

    const exact = request(path('story.md'));
    const deepMarker = `${'This answer discusses pacing at length. '.repeat(15)}${exact}`;
    expect(codec.inspect(deepMarker)).toEqual({ kind: 'none' });

    const mentionThenCall = `The docs show \`<prose-minion-tool-call>\` syntax.\n${exact}`;
    expect(codec.inspect(mentionThenCall)).toMatchObject({
      kind: 'request', request: { paths: ['story.md'] }
    });
  });

  it.each([
    ['malformed XML', '<prose-minion-tool-call name="resource.read"><paths><path>story.md</path></paths>'],
    ['an unknown operation', request(path('story.md')).replace('resource.read', 'dictionary.lookup')],
    ['multiple roots', `${request(path('story.md'))}${request(path('characters/mara.md'))}`],
    ['a comment inside the root', request(path('story.md')).replace('<paths>', '<!-- no --><paths>')],
    ['a duplicate paths container', '<prose-minion-tool-call name="resource.read"><paths><path>story.md</path></paths><paths><path>other.md</path></paths></prose-minion-tool-call>'],
    ['an empty path', request('<path> </path>')],
    ['duplicate paths', request(`${path('story.md')}${path('story.md')}`)],
    ['mixed prose after the call', `${request(path('story.md'))} Then I will answer.`],
    ['a nested unexpected element', request('<path><value>story.md</value></path>')]
  ])('rejects %s', (_reason, candidate) => {
    expect(codec.parseExactRequest(candidate)).toBeUndefined();
  });

  it('hides complete, garnished, and mixed protocol-shaped output from visible content', () => {
    const exact = request(path('story.md'));
    expect(codec.hideIfProtocolShaped(exact)).toBe('');
    expect(codec.hideIfProtocolShaped(`I need guides first.\n${exact}`)).toBe('');
    expect(codec.hideIfProtocolShaped(`${exact} prose`)).toBe('');
  });
});
