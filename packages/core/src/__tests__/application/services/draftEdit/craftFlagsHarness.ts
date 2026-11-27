/**
 * A Craft Flags run's test harness (ADR 2026-10-21, Amendment 2026-10-26:
 * Slice 3c): the use case over the shared fake document and annotator, with
 * a stand-in pass that returns chosen flags. Text adapts public-domain
 * *Alice*, with clichés added.
 */
import { CRAFT_FLAG_CATEGORIES, type CraftFlagFinding, type CraftFlagsOutcome, type CraftFlagsPass } from '@/domain/models/CraftFlag';
import type { DraftEditTarget } from '@/domain/models/DraftEdit';
import { CraftFlagsUseCase, type CraftFlagsPassPort } from '@/application/services/draftEdit/CraftFlagsUseCase';
import type { CraftFlagsCallResult, CraftFlagsRunRequest } from '@services/craftFlags/CraftFlagsService';
import { FakeAnnotations, FakeDocuments } from '@/__tests__/application/services/draftEdit/fakeDocuments';

export const CHAPTER = [
  'Alice was beginning to get very tired of sitting by her sister on the bank, and time stood still.',
  '',
  '“Oh dear! Oh dear! I am as busy as a bee!” said the Rabbit. Alice said, \'My heart was in my throat!\' and laughed.',
  '',
  'When the Rabbit took a watch out of its waistcoat-pocket, a chill ran down her spine, and time stood still.',
  '',
  '```',
  'a chill ran down her spine',
  '```'
].join('\n');

export const PASS: CraftFlagsPass = { kind: 'craft', categories: [...CRAFT_FLAG_CATEGORIES] };
export const MODEL = 'placeholder/craft-model';
export const ESTIMATE = { model: MODEL, calls: 1, inputTokens: 900, outputTokens: 1500, usd: 0.03 };

export const flag = (quote: string, { before, ...extra }: Partial<CraftFlagFinding> & { before?: string } = {}): CraftFlagFinding => ({
  anchor: { quote, ...(before ? { before } : {}) },
  category: 'cliche',
  kind: 'cliche',
  why: 'A stopped clock stands in for the jolt.',
  suggestion: 'the pink eyes, as she sees them',
  ...extra
});

export function setup(
  text = CHAPTER,
  calls: CraftFlagsCallResult[] = [],
  options: { beforeReply?: (documents: FakeDocuments) => void; languageId?: string } = {}
) {
  const documents = new FakeDocuments(text, undefined, options.languageId);
  const annotations = new FakeAnnotations(documents);
  const requests: CraftFlagsRunRequest[] = [];
  const pass: CraftFlagsPassPort = {
    estimate: jest.fn(async () => ESTIMATE),
    flag: jest.fn(async (request: CraftFlagsRunRequest) => {
      requests.push(request);
      if (request.stillCurrent && !request.stillCurrent()) {
        return { kind: 'ended' as const };
      }
      options.beforeReply?.(documents);
      return { kind: 'completed' as const, calls, usage: { promptTokens: 900, completionTokens: 300, totalTokens: 1200, costUsd: 0.02 } };
    })
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const useCase = new CraftFlagsUseCase(pass, documents, annotations, log);
  const target = (range?: { start: number; end: number }): DraftEditTarget => ({
    uri: documents.uri,
    version: documents.version,
    text: documents.text,
    languageId: documents.languageId,
    relativePath: 'chapter-01.md',
    ...(range ? { range } : {})
  });
  /** A gesture begun, priced and run at the approved model, as the command does. */
  const runOnce = async (at: DraftEditTarget = target(), signal?: AbortSignal): Promise<CraftFlagsOutcome> => {
    const begun = useCase.begin(at, PASS);
    if (begun.kind !== 'gesture') {
      return begun;
    }
    return useCase.run(begun.gesture, { model: MODEL }, signal);
  };
  return { documents, annotations, pass, requests, log, useCase, target, runOnce };
}

export const read = (...findings: CraftFlagFinding[]): CraftFlagsCallResult => ({ kind: 'read', findings, malformed: 0, notesWithheld: 0 });
export const rangeOf = (text: string, part: string) => ({ start: text.indexOf(part), end: text.indexOf(part) + part.length });
