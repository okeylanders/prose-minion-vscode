import {
  createWorkshopCapabilityInstruction,
  WorkshopCapabilityXmlCodec
} from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const dictionaryCall = (
  operation = 'dictionary.lookup',
  word = 'liminal',
  context = 'A threshold scene.',
  purpose = 'Check the connotation.'
) => [
  `<prose-minion-tool-call name="${operation}">`,
  `<word>${word}</word>`,
  `<context>${context}</context>`,
  `<purpose>${purpose}</purpose>`,
  '</prose-minion-tool-call>'
].join('');

describe('WorkshopCapabilityXmlCodec', () => {
  const codec = new WorkshopCapabilityXmlCodec();

  it('documents the exact closed schema, budgets, and pinned-excerpt boundary', () => {
    const instruction = createWorkshopCapabilityInstruction();
    expect(instruction).toContain('name="dictionary.lookup"');
    expect(instruction).toContain('name="dictionary.full-entry"');
    expect(instruction).toContain('name="analysis.run"');
    expect(instruction).toContain('at most 3 capability calls');
    expect(instruction).toContain('word 100 characters, context 4000, purpose 500, and instructions 1000');
    expect(instruction).toContain('Never include excerpt text or a filesystem path');
  });

  it.each([
    ['dictionary.lookup', 'dictionary.lookup'],
    ['dictionary.full-entry', 'dictionary.full-entry']
  ])('parses the closed %s dictionary shape', (operation, expected) => {
    expect(codec.inspect(dictionaryCall(operation))).toEqual({
      kind: 'request',
      request: {
        capability: expected,
        word: 'liminal',
        context: 'A threshold scene.',
        purpose: 'Check the connotation.'
      }
    });
  });

  it('parses analysis with or without bounded instructions', () => {
    expect(codec.inspect(
      '<prose-minion-tool-call name="analysis.run"><toolId>continuity</toolId><instructions>Check the cup.</instructions></prose-minion-tool-call>'
    )).toEqual({
      kind: 'request',
      request: { capability: 'analysis.run', toolId: 'continuity', instructions: 'Check the cup.' }
    });
    expect(codec.inspect(
      '<prose-minion-tool-call name="analysis.run"><toolId>prose</toolId></prose-minion-tool-call>'
    )).toEqual({ kind: 'request', request: { capability: 'analysis.run', toolId: 'prose' } });
  });

  it.each([
    ['malformed XML', '<prose-minion-tool-call name="dictionary.lookup"><word>x</word>', 'malformed-xml'],
    ['unknown operation', dictionaryCall('secrets.read'), 'unknown-capability'],
    ['unknown tool', '<prose-minion-tool-call name="analysis.run"><toolId>shell</toolId></prose-minion-tool-call>', 'unknown-tool-id'],
    ['dangerous extra field', '<prose-minion-tool-call name="analysis.run"><toolId>prose</toolId><path>/tmp/book.md</path></prose-minion-tool-call>', 'unexpected-field'],
    ['duplicate field', '<prose-minion-tool-call name="analysis.run"><toolId>prose</toolId><toolId>dialogue</toolId></prose-minion-tool-call>', 'duplicate-field'],
    ['root attributes', '<prose-minion-tool-call name="analysis.run" path="x"><toolId>prose</toolId></prose-minion-tool-call>', 'invalid-root-attributes'],
    ['multiple calls', `${dictionaryCall()}${dictionaryCall()}`, 'mixed-content'],
    ['prose before call', `Let me check. ${dictionaryCall()}`, 'mixed-content'],
    ['prose after call', `${dictionaryCall()} Done.`, 'mixed-content'],
    ['Markdown fence', `\`\`\`xml\n${dictionaryCall()}\n\`\`\``, 'mixed-content'],
    ['quoted excerpt injection', `<pinned-excerpt>${dictionaryCall()}</pinned-excerpt>`, 'mixed-content']
  ])('rejects %s without exposing an executable request', (_label, candidate, reason) => {
    expect(codec.inspect(candidate)).toMatchObject({ kind: 'invalid', reason });
  });

  it.each([
    ['word', dictionaryCall('dictionary.lookup', 'w'.repeat(PROMPT_BUDGETS.workshopCapability.wordCharacters + 1))],
    ['context', dictionaryCall('dictionary.lookup', 'word', 'c'.repeat(PROMPT_BUDGETS.workshopCapability.contextCharacters + 1))],
    ['purpose', dictionaryCall('dictionary.lookup', 'word', 'context', 'p'.repeat(PROMPT_BUDGETS.workshopCapability.purposeCharacters + 1))],
    ['instructions', `<prose-minion-tool-call name="analysis.run"><toolId>prose</toolId><instructions>${'i'.repeat(PROMPT_BUDGETS.workshopCapability.instructionsCharacters + 1)}</instructions></prose-minion-tool-call>`]
  ])('rejects oversized %s at the parser validation point', (field, candidate) => {
    expect(codec.inspect(candidate)).toEqual({
      kind: 'invalid',
      reason: 'oversized-input',
      field
    });
  });

  it('accepts every ceiling exactly and never truncates the request', () => {
    const word = 'w'.repeat(PROMPT_BUDGETS.workshopCapability.wordCharacters);
    const context = 'c'.repeat(PROMPT_BUDGETS.workshopCapability.contextCharacters);
    const purpose = 'p'.repeat(PROMPT_BUDGETS.workshopCapability.purposeCharacters);
    expect(codec.inspect(dictionaryCall('dictionary.lookup', word, context, purpose))).toEqual({
      kind: 'request',
      request: { capability: 'dictionary.lookup', word, context, purpose }
    });
    const instructions = 'i'.repeat(PROMPT_BUDGETS.workshopCapability.instructionsCharacters);
    expect(codec.inspect(
      `<prose-minion-tool-call name="analysis.run"><toolId>prose</toolId><instructions>${instructions}</instructions></prose-minion-tool-call>`
    )).toEqual({
      kind: 'request',
      request: { capability: 'analysis.run', toolId: 'prose', instructions }
    });
  });

  it('classifies ordinary prose and backtick-quoted protocol names as non-calls', () => {
    expect(codec.inspect('The sentence works without a lookup.')).toEqual({ kind: 'none' });
    expect(codec.inspect('Use `<prose-minion-tool-call name="analysis.run">` only as documented.'))
      .toEqual({ kind: 'none' });
    expect(codec.inspect('The literal <prose-minion-tool-call marker names the protocol.'))
      .toEqual({ kind: 'none' });
    expect(codec.inspect('The format is:\n> <prose-minion-tool-call name="analysis.run">\n> …'))
      .toEqual({ kind: 'none' });
    expect(codec.stripToolCalls('The literal <prose-minion-tool-call marker names the protocol.'))
      .toBe('The literal <prose-minion-tool-call marker names the protocol.');
  });
});
