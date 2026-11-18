/**
 * The persona capability tallies the frames it adds (ADR 2026-11-18 D3, D6):
 * the contract frozen into the first message and the `<project-memory>`
 * block (item C's titles tier with it) on a first message; the turn reminder
 * and a `<project-memory-update>` note after. The messages are byte for byte
 * what they were without a recorder. *Alice*, with made-up ids.
 */
import { unavailableHelpReference } from '@/__tests__/application/services/workshop/help/unavailableHelpReference';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { libraryHost, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { noProjectLenses } from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';
import { WorkshopContextTallyRecorder } from '@services/analysis/WorkshopContextTally';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';

function room(host: ReturnType<typeof libraryHost>) {
  const session = new WorkshopSessionService(() => Date.parse('2026-11-18T10:00:00.000Z'));
  session.setSessionScope('open');
  let runs = 0;
  return async (text: string, first: boolean, contextTally?: WorkshopContextTallyRecorder): Promise<string> => {
    const requestId = `host-${++runs}`;
    session.beginPersonaMessage(requestId, text);
    const capability = new WorkshopPersonaCapabilityFactory(
      {} as DictionaryService,
      {} as WorkshopAnalysisSidePass,
      { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
      session,
      { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() },
      {} as WorkshopTranscriptRecallPort,
      host.library,
      noProjectLenses,
      unavailableHelpReference
    ).create({
      requestId,
      excerptVersion: 0,
      personaId: 'jill',
      owner: { kind: 'host' },
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() },
      ...(contextTally ? { contextTally } : {})
    });
    const message = first ? await capability.appendContract(text) : await capability.appendTurnContract(text);
    session.completeRun(requestId, 'Reply.', undefined, false, 'host-conv');
    return message;
  };
}

const frameOf = (message: string, name: string): string =>
  new RegExp(`<${name}[ >][\\s\\S]*?</${name}>`).exec(message)![0];

describe('WorkshopPersonaCapability context tally (ADR 2026-11-18 D6)', () => {
  it('tallies the contract and the memory block, writing the same first message', async () => {
    const plainHost = libraryHost();
    plainHost.put(writerMemory());
    const talliedHost = libraryHost();
    talliedHost.put(writerMemory());
    const tally = new WorkshopContextTallyRecorder();

    const plain = await room(plainHost)('Where is Alice going?', true);
    const tallied = await room(talliedHost)('Where is Alice going?', true, tally);

    expect(tallied).toBe(plain);
    const pieces = tally.snapshot();
    expect(pieces['memory.start']).toBe(estimateTextTokens(frameOf(tallied, 'project-memory')));
    expect(pieces['tool-use.contract']).toBeGreaterThan(0);
    // The writer's own words are the conversation's, never tallied.
    const total = Object.values(pieces).reduce((sum, tokens) => sum + tokens, 0);
    expect(total).toBeLessThan(estimateTextTokens(tallied));
    expect(Object.keys(pieces).sort()).toEqual(['memory.start', 'tool-use.contract']);
  });

  it('tallies the turn reminder and an update note on a later message', async () => {
    const host = libraryHost();
    host.put(writerMemory());
    const say = room(host);
    await say('Hello.', true);
    host.put(writerMemory({ id: 'mem-0d0d0d', title: 'Alice grows twice', updated: '2026-11-04T08:00:00Z' }));
    const tally = new WorkshopContextTallyRecorder();
    const message = await say('Anything new?', false, tally);

    expect(tally.snapshot()['memory.update']).toBe(estimateTextTokens(frameOf(message, 'project-memory-update')));
    expect(tally.snapshot()['tool-use.reminder']).toBeGreaterThan(0);
  });
});
