/**
 * What the adapter cannot translate takes the bounded correction path, and
 * nothing runs: an unknown name, arguments that do not map, unparseable
 * argument JSON. A call that maps but breaks the grammar is the codec's to
 * reject, exactly as typed XML is.
 */

import { OPENROUTER_TOOL_CALL_LIMITS } from '@providers/OpenRouterToolCalls';
import { createNativeToolCallHarness, native, type WireReply } from './nativeToolCallHarness';

type Harness = ReturnType<typeof createNativeToolCallHarness>;
let room: Harness;
beforeEach(async () => {
  room = createNativeToolCallHarness();
  await room.coordinator.initialize();
  room.session.setSessionScope('open');
});
afterEach(() => room.dispose());

/** Invalid JSON as sent; cut at the bound it would read as `{}`, an unfiltered catalog. */
const OVERSIZED: WireReply = native('transcript.catalog', '{}'.padEnd(OPENROUTER_TOOL_CALL_LIMITS.argumentCharacters, ' ') + 'invalid tail');

const XML_CALL = '<prose-minion-tool-call name="transcript.catalog"><match>6.11</match></prose-minion-tool-call>';

describe.each([['whole replies', false], ['streamed replies', true]])('a native call the adapter cannot translate (%s)', (_label, streaming) => {
  it.each<[string, WireReply]>([
    ['an unknown name', native('file.delete', { path: 'chapters/one.md' })],
    ['a server tool the persona was not given', native('web_search', { query: 'tea parties' })],
    ['arguments that do not map', native('transcript.catalog', { match: '6.11', limit: 5 })],
    ['unparseable argument JSON', native('transcript.catalog', '{"match": "6.11')],
    ['arguments that are not an object', native('transcript.catalog', '"6.11"')],
    // PR #267 F-01: a payload the wire did not carry soundly is never read as a call with no arguments.
    ['arguments sent as an object, not JSON text', { calls: [{ name: 'transcript.catalog', arguments: { match: '6.11' }, raw: true }] }],
    ['arguments past the boundary\'s bound, whose kept prefix would be valid JSON', OVERSIZED],
    ['a malformed payload with a finish reason other than tool_calls', { calls: [{ name: 'transcript.catalog', arguments: { match: '6.11' }, raw: true }], finish: 'stop' }],
    ['an unknown name with a finish reason other than tool_calls', { calls: [{ name: 'file.delete', arguments: {} }], finish: 'stop' }]
  ])('%s: nothing runs, and the persona is asked for the XML request', async (_case, reply) => {
    const { result, visible, unusedReplies } = await room.hostTurn(
      'Which sessions touched 6.11?',
      [reply, XML_CALL, 'One session matches.'],
      { streaming }
    );

    expect(unusedReplies).toBe(0);
    // Only the corrected, typed XML request ran.
    expect(room.cards()).toEqual(['transcript.catalog:success']);
    const correction = room.sent[1].messages;
    expect(correction.at(-2)).toEqual({ role: 'assistant', content: '[An unsupported native tool call was returned and was not executed.]' });
    expect(correction.at(-1)!.content).toContain('not a native tool call');
    expect(JSON.stringify(room.sent.map(({ body }) => body))).not.toContain('tool_calls');
    expect(result.content).toBe('One session matches.');
    if (streaming) {expect(visible).toBe('One session matches.');}

    // The failed attempt is not history: the retained turn is the XML request that worked.
    const retained = room.manager.getMessages(result.conversationId!);
    expect(JSON.stringify(retained)).not.toContain('unsupported native tool call');
    expect(retained.filter((message) => message.role === 'assistant').map((message) => message.content))
      .toEqual([XML_CALL, 'One session matches.']);
  });

  it('is bounded: repeated untranslatable calls end in a host-worded outcome, and nothing runs', async () => {
    const { result, unusedReplies } = await room.hostTurn(
      'Which sessions touched 6.11?',
      [native('file.delete', {}), native('file.delete', {})],
      { streaming }
    );

    expect(unusedReplies).toBe(0);
    expect(room.cards()).toEqual([]);
    expect(result.replySource).toBe('host-fallback');
    expect(result.content).toContain('could not complete its tool request');
  });

  it('leaves a call that maps but breaks the grammar to the codec, as typed XML is', async () => {
    const { result } = await room.hostTurn(
      'Read chapter one.',
      [native('resource.read', { group: 'chapters', path: '../outside.md' }), 'I could not read that file.'],
      { streaming }
    );

    expect(result.content).toBe('I could not read that file.');
    expect(room.cards()).toEqual(['resource.read:rejected']);
    const correction = room.sent[1].messages;
    expect(correction.at(-2)!.content).toContain('<prose-minion-tool-call name="resource.read">');
    expect(correction.at(-1)!.content).toContain('Your Workshop capability request was rejected (invalid-resource-path). Field: path.');
  });

  it('lets prose stand when an untranslatable call rides beside it: streamed prose cannot be retracted', async () => {
    const prose = 'Here is what I remember of 6.11 without looking anything up, which is a fair amount as it happens.';
    const { result, unusedReplies } = await room.hostTurn('Which sessions touched 6.11?', [native('file.delete', {}, prose)], { streaming });

    expect(unusedReplies).toBe(0);
    expect(room.cards()).toEqual([]);
    expect(result.content).toBe(prose);
  });
});
