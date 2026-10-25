/**
 * A worked example's reply read through the production reply reader
 * (`readLightboxGroupReply`), with its log lines and recovery capture, for
 * the reading-tolerance tests (Slice 4K). The chapter is the worked
 * example's (the opening of "Alice's Adventures in Wonderland", Lewis
 * Carroll, 1865, public domain). No provider is called.
 */
import type { LightboxReadingGroupId } from '@messages';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { lightboxGroupTools, readLightboxGroupReply } from '@/infrastructure/lightbox/LightboxGroupReply';
import type { LightboxPreparedCall } from '@/infrastructure/lightbox/LightboxRunEstimate';
import type { LightboxRunSource } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { readWorkedExample } from './lightboxReadingFixtures';

export async function readWorkedReply(
  group: Exclude<LightboxReadingGroupId, 'F'>,
  rawContent: string,
  finishReason: ExecutionResult['finishReason'] = 'stop'
) {
  const example = readWorkedExample(group);
  const lines: string[] = [];
  const capture = jest.fn(async () => ({
    filePath: '/workspace/prose-minion/recovery/model-responses/reply.response.txt',
    toolName: 'lightbox-readings' as const,
    storageScope: 'project' as const
  }));
  const ports = {
    recovery: { capture },
    recoveryPresenter: { present: jest.fn(async () => undefined) },
    outputChannel: { appendLine: (line: string) => lines.push(line), show: jest.fn(), clear: jest.fn() }
  };
  const call: LightboxPreparedCall = { group, lenses: example.lenses, systemMessage: '', userMessage: '', chapterTokens: 0 };
  const source: LightboxRunSource = {
    boardId: 'board-1',
    material: {
      paragraphs: example.paragraphs,
      columns: example.paragraphs.map((_, index) => ({ from: index + 1, to: index + 1 })),
      context: []
    },
    sourceWords: 500,
    contextWords: 0,
    averageWordsPerSentence: 20
  };
  const result: ExecutionResult = {
    content: 'visible', rawContent, usedGuides: [], requestedResources: [], artifacts: [], finishReason, modelId: 'provider/model-v1'
  };
  const outcome = await readLightboxGroupReply(ports, { call, result, source, tools: lightboxGroupTools(source), token: 'token-1-0000' });
  return { outcome, logged: lines.join('\n'), capture };
}
