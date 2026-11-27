/**
 * Okey's reproduction of 2026-11-17, over a mocked transport: with web
 * research on, a Claude persona asks for `transcript.catalog` as a native
 * tool call instead of the XML request in its text. The adapter translates
 * the call into the XML envelope, the codec decodes it, the capability
 * runs, and the persona answers. Retained history holds the XML.
 */

import { workshopUnrunNativeCallsNote } from '@/application/services/workshop/WorkshopNativeToolCallTranslator';
import { wrapAgentFetchedArtifactEvidence } from '@/utils/workshopPromptFrames';
import { estimateRequestTokens, exceedsContextWindow, measureContextWindow } from '@orchestration/RequestContextPreflight';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { createNativeToolCallHarness, native, WEB_RESEARCH_TOOLS, type WireReply } from './nativeToolCallHarness';

type Harness = ReturnType<typeof createNativeToolCallHarness>;
let room: Harness;
beforeEach(() => { room = createNativeToolCallHarness(); });
afterEach(() => room.dispose());

const SESSION = '0a1b2c3d-0000-4000-8000-000000000611';
const CATALOG_ENVELOPE = '<prose-minion-tool-call name="transcript.catalog">\n  <match>6.11</match>\n</prose-minion-tool-call>';
const ANSWER = 'One saved session matches 6.11: the tea party pass.';

/** No request may carry a tool call or a tool result: only plain system, user and assistant text. */
const expectPlainTranscript = (messages: ReadonlyArray<{ role: string; content: string }>) => {
  expect(messages.every((message) => ['system', 'user', 'assistant'].includes(message.role))).toBe(true);
  const turns = messages.filter((message) => message.role !== 'system').map((message) => message.role);
  expect(turns).toEqual(turns.map((_role, index) => (index % 2 === 0 ? 'user' : 'assistant')));
};

describe.each([['whole replies', false], ['streamed replies', true]])('a native transcript.catalog call with web research on (%s)', (_label, streaming) => {
  beforeEach(async () => {
    await room.coordinator.initialize();
    room.session.setSessionScope('open');
    await room.saveSession(SESSION, 'Chapter 6.11: the tea party pass');
  });

  it('is translated, decoded, run and answered', async () => {
    const { result, visible, unusedReplies } = await room.hostTurn(
      'Which sessions touched 6.11?',
      [native('transcript.catalog', { match: '6.11' }), ANSWER],
      { streaming }
    );

    expect(unusedReplies).toBe(0);
    expect(result.content).toBe(ANSWER);
    expect(result.replySource).toBe('provider');
    expect(room.cards()).toEqual(['transcript.catalog:success']);
    if (streaming) {expect(visible).toBe(ANSWER);}

    // Web research's tools ride every request; they are what primes the native call.
    expect(room.sent.map(({ body }) => body.tools)).toEqual([WEB_RESEARCH_TOOLS, WEB_RESEARCH_TOOLS]);

    // The next request is well-formed: the persona's turn is the XML it should have written, then the evidence.
    const [, followUp] = room.sent;
    expectPlainTranscript(followUp.messages);
    expect(JSON.stringify(followUp.body)).not.toContain('tool_calls');
    expect(followUp.messages.at(-2)).toEqual({ role: 'assistant', content: CATALOG_ENVELOPE });
    expect(followUp.messages.at(-1)!.content).toContain('<workshop-capability-result name="transcript.catalog" status="success"');
    expect(followUp.messages.at(-1)!.content).toContain('Chapter 6.11: the tea party pass');
  });

  it('retains the XML and no tool call, so the conversation continues cleanly', async () => {
    const first = await room.hostTurn('Which sessions touched 6.11?', [native('transcript.catalog', { match: '6.11' }), ANSWER], { streaming });
    const conversationId = first.result.conversationId!;

    const retained = room.manager.getMessages(conversationId);
    expectPlainTranscript(retained);
    expect(retained.map((message) => Object.keys(message).sort())).toEqual(retained.map(() => ['content', 'role']));
    expect(retained.filter((message) => message.role === 'assistant').map((message) => message.content)).toEqual([CATALOG_ENVELOPE, ANSWER]);
    expect(JSON.stringify(retained)).not.toContain('tool_calls');

    const second = await room.hostTurn('And 6.12?', ['Nothing saved mentions 6.12.'], { streaming, conversationId });
    expect(second.result.content).toBe('Nothing saved mentions 6.12.');
    const continued = room.sent.at(-1)!;
    expectPlainTranscript(continued.messages);
    expect(continued.messages.some((message) => message.role === 'assistant' && message.content === CATALOG_ENVELOPE)).toBe(true);
  });

  it('keeps prose beside the call as narration before the request, as typed XML after narration reads', async () => {
    const { result, visible } = await room.hostTurn(
      'Which sessions touched 6.11?',
      [native('transcript.catalog', { match: '6.11' }, 'Let me check the saved sessions.'), ANSWER],
      { streaming }
    );

    expect(result.content).toBe(ANSWER);
    expect(room.cards()).toEqual(['transcript.catalog:success']);
    expect(room.sent[1].messages.at(-2)).toEqual({
      role: 'assistant',
      content: `Let me check the saved sessions.\n\n${CATALOG_ENVELOPE}`
    });
    // The short narration is held, then dropped with the request: the envelope never shows.
    if (streaming) {expect(visible).toBe(ANSWER);}
  });

  it('runs only the first of several calls and tells the persona the rest were not run', async () => {
    const reply: WireReply = { calls: [
      { name: 'transcript.catalog', arguments: { match: '6.11' } },
      { name: 'transcript.todos', arguments: { status: 'open' } },
      { name: 'memory.catalog', arguments: {} }
    ] };
    const { result } = await room.hostTurn('Which sessions touched 6.11?', [reply, ANSWER], { streaming });

    expect(result.content).toBe(ANSWER);
    expect(room.cards()).toEqual(['transcript.catalog:success']);
    const evidence = room.sent[1].messages.at(-1)!.content;
    expect(evidence).toContain('Your reply held 2 more tool calls after this one. They were not run');
    // The note belongs to that reply alone.
    await room.hostTurn('And todos?', [native('transcript.todos', { status: 'open' }), 'No open to-dos.'], { streaming, conversationId: result.conversationId });
    expect(room.sent.at(-1)!.messages.at(-1)!.content).not.toContain('not run');
  });

  it('reads several sessions named as a list written as text, the shape a live model sent', async () => {
    const other = '0a1b2c3d-0000-4000-8000-000000000612';
    await room.saveSession(other, 'Chapter 6.12: the croquet pass');
    const { result } = await room.hostTurn(
      'Compare the two passes.',
      [native('transcript.read', { session: JSON.stringify([SESSION, other]) }), ANSWER],
      { streaming }
    );

    expect(result.content).toBe(ANSWER);
    expect(room.cards()).toEqual(['transcript.read:success']);
    const request = room.sent[1].messages.at(-2)!.content;
    expect(request.match(/<session>/g)).toHaveLength(2);
    expect(room.sent[1].messages.at(-1)!.content).toContain('<workshop-capability-result name="transcript.read" status="success"');
  });

  it('counts a translated call against the turn\'s capability calls', async () => {
    const limit = PROMPT_BUDGETS.workshopCapability.callsPerTurn;
    const replies: WireReply[] = [
      ...Array.from({ length: limit + 1 }, () => native('transcript.catalog', { match: '6.11' })),
      ANSWER
    ];
    const { result, unusedReplies } = await room.hostTurn('Which sessions touched 6.11?', replies, { streaming });

    expect(unusedReplies).toBe(0);
    expect(result.content).toBe(ANSWER);
    expect(room.cards().filter((card) => card === 'transcript.catalog:success')).toHaveLength(limit);
    expect(room.sent.at(-1)!.messages.at(-1)!.content).toContain('reached the Workshop capability-call limit');
  });

  it('logs the operation, counts and fault kinds, and never an argument', async () => {
    const secret = 'QUEEN-OF-HEARTS-TARTS';
    (room.log.appendLine as jest.Mock).mockClear();
    await room.hostTurn('Find it.', [native('transcript.catalog', { match: secret }), ANSWER], { streaming });
    await room.hostTurn('Again.', [native(`steal_${secret}`, { target: secret }), 'I can answer without it.'], { streaming });
    await room.hostTurn('Again.', [native('transcript.catalog', { [secret]: secret }), 'I can answer without it.'], { streaming });

    const lines = room.logLines();
    expect(lines.join('\n')).not.toContain(secret);
    expect(lines).toEqual(expect.arrayContaining([
      expect.stringContaining('native tool call translated to XML: capability=transcript.catalog calls=1 unrun=0'),
      expect.stringContaining('native tool call not translated: fault=unknown-name calls=1'),
      expect.stringContaining('native tool call not translated: fault=unmapped-argument calls=1'),
      expect.stringContaining('1 native tool call(s) not translated: reason=unknown-name.')
    ]));
  });
});

it('keeps skipped siblings on a withheld result and refuses a follow-up that only fits the bare notice', async () => {
  const reply: WireReply = { calls: [
    { name: 'dictionary.lookup', arguments: { word: 'curious', context: 'The rabbit hole.', purpose: 'Check tone.' } },
    { name: 'transcript.catalog', arguments: {} }
  ] };
  const warning = workshopUnrunNativeCallsNote(1);
  const ask = async (harness: Harness) => {
    await harness.coordinator.initialize();
    harness.session.setSessionScope('open');
    harness.dictionary.lookupWordStreaming.mockResolvedValueOnce({
      toolName: 'dictionary_lookup', content: 'WITHHELD_DICTIONARY_TEXT '.repeat(4_000)
    });
    return harness.hostTurn('Help.', [reply, 'Answered.']);
  };
  const window = jest.spyOn(OpenRouterModels, 'getCachedContextLength').mockReturnValue(12_000);
  try {
    const { result } = await ask(room);
    expect(result.content).toBe('Answered.');
    expect(room.cards()).toEqual(['dictionary.lookup:rejected']);
    const card = room.session.readRoomLedger().find(turn => turn.capability)!;
    expect(card.content).toContain('dictionary.lookup result did not fit');
    expect(card.content.split(warning)).toHaveLength(2);
    const history = room.sent[1].messages.slice(0, -1);
    const followUp = (evidence: string) => [
      ...history, { role: 'user' as const, content: wrapAgentFetchedArtifactEvidence('art-1', evidence) }
    ];
    expect(room.sent[1].messages).toEqual(followUp(card.content));
    expect(JSON.stringify(room.manager.getMessages(result.conversationId!))).not.toContain('WITHHELD_DICTIONARY_TEXT');

    // Size a fresh model window for the same conversation, with just a few tokens above the bare notice.
    const bare = (body: string) => body.replace(`\n${warning}`, '');
    const { defaultOutputTokens, headroomFraction } = PROMPT_BUDGETS.inferenceContext;
    const bareTokens = estimateRequestTokens(followUp(bare(card.content)), WEB_RESEARCH_TOOLS);
    const narrowWindow = Math.ceil((bareTokens + defaultOutputTokens + 3) / (1 - headroomFraction));
    window.mockReturnValue(narrowWindow);
    const narrow = createNativeToolCallHarness();
    try {
      await expect(ask(narrow)).rejects.toMatchObject({ reason: 'context-window-exceeded' });
      expect(narrow.sent).toHaveLength(1);
      expect(narrow.cards()).toEqual(['dictionary.lookup:rejected']);
      const replacement = narrow.session.readRoomLedger().find(turn => turn.capability)!.content;
      expect(replacement).toContain(warning);
      const overflows = (body: string) => exceedsContextWindow(
        measureContextWindow(followUp(body), narrowWindow, undefined, WEB_RESEARCH_TOOLS)
      );
      expect(overflows(bare(replacement))).toBe(false);
      expect(overflows(replacement)).toBe(true);
    } finally {
      narrow.dispose();
    }
  } finally {
    window.mockRestore();
  }
});

describe('one translated native call from every capability family', () => {
  beforeEach(async () => {
    await room.coordinator.initialize();
    room.session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  });

  it.each<[string, string, unknown, string]>([
    ['dictionary', 'dictionary.lookup', { word: 'curious', context: 'Alice at the rabbit hole.', purpose: 'Check tone.' }, 'success'],
    ['analysis', 'analysis.run', { toolId: 'continuity', excerptMode: 'inherit', contextMode: 'omit' }, 'success'],
    ['resource', 'resource.catalog', {}, 'success'],
    ['transcript', 'transcript.todos', { status: 'open' }, 'success'],
    // Project memory is off in this room: the call still reaches the library, which answers that it is off.
    ['memory', 'memory_catalog', {}, 'rejected']
  ])('%s: %s is translated, decoded, run and answered', async (_family, name, args, status) => {
    const operation = name.replace('_', '.');
    const { result } = await room.hostTurn('Help.', [native(name, args), 'Answered from the evidence.'], { streaming: true });

    expect(result.content).toBe('Answered from the evidence.');
    const [, followUp] = room.sent;
    expect(followUp.messages.at(-2)!.content).toMatch(new RegExp(`^<prose-minion-tool-call name="${operation.replace('.', '\\.')}">`));
    expect(followUp.messages.at(-1)!.content).toContain(`<workshop-capability-result name="${operation}" status="${status}"`);
    if (operation === 'dictionary.lookup') {expect(room.dictionary.lookupWordStreaming).toHaveBeenCalledTimes(1);}
    if (operation === 'analysis.run') {expect(room.analysis.runWithInputs).toHaveBeenCalledTimes(1);}
  });
});
