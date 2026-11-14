/**
 * A read of several files as a persona's turn records it (ADR 2026-11-14
 * D2, D7): one call, one capability card, a manifest row per file delivered
 * with that file's own line range and fingerprint, Read in from each row,
 * and the context window handed through to the read.
 */

import { createHash } from 'crypto';
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import {
  aliceLines,
  aliceResources,
  AliceFile,
  manuscript,
  windowWith
} from '@/__tests__/application/services/workshop/resource/resourceReadFixtures';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { readWorkshopReadInResource } from '@/application/services/workshop/WorkshopReadInResource';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import type { LogSink } from '@/platform';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const notUnderTest = (): Promise<never> => Promise.reject(new Error('not under test here'));
const unusedRecall: WorkshopTranscriptRecallPort = {
  catalog: notUnderTest, search: notUnderTest, read: notUnderTest, todos: notUnderTest, bookmarks: notUnderTest
};

const CH1 = aliceLines(12, 60, 'Chapter one');
const CH2 = aliceLines(8, 60, 'Chapter two');
const RABBIT = '# The White Rabbit\nChecks his watch.\nLate for the Duchess.';
const PROJECT: AliceFile[] = [
  manuscript('alice-ch1.md', CH1),
  manuscript('alice-ch2.md', CH2),
  { group: 'characters', path: 'white-rabbit.md', content: RABBIT }
];

const THREE_FILES =
  '<prose-minion-tool-call name="resource.read"><group>manuscript</group><path>alice-ch1.md</path>' +
  '<path>alice-ch2.md</path><path group="characters">white-rabbit.md</path></prose-minion-tool-call>';

describe('a persona\'s read of several files', () => {
  let session: WorkshopSessionService;
  let appendLine: jest.Mock<void, [string]>;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 7);
    session.setExcerpt({ text: 'Alice followed the Rabbit.', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-request', 'Read the first chapters and the Rabbit\'s sheet.');
    appendLine = jest.fn();
  });

  const capability = (files: readonly AliceFile[] = PROJECT) => {
    const log = { appendLine } as unknown as LogSink;
    const assistant = { analyzeWritingTools: jest.fn(), discardConversation: jest.fn() } as unknown as AssistantToolService;
    return new WorkshopPersonaCapabilityFactory(
      {} as unknown as DictionaryService,
      new WorkshopAnalysisSidePass(assistant, session, log),
      aliceResources(files).factory,
      session,
      log,
      unusedRecall,
      offProjectMemory
    ).create({
      requestId: 'host-request',
      excerptVersion: session.getExcerptVersion(),
      personaId: 'jill',
      owner: { kind: 'host' },
      excerpt: session.getExcerpt()!,
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
  };
  const decode = (call: string): WorkshopCapabilityRequest => {
    const inspection = new WorkshopCapabilityXmlCodec().inspect(call);
    if (inspection.kind !== 'request') {
      throw new Error(`Not a request: ${JSON.stringify(inspection)}`);
    }
    return inspection.request;
  };
  const cards = () => session.getSnapshot().turns.filter((turn) => turn.artifact === 'resource_read');

  it('is one call: one request, one fulfillment, one card', async () => {
    const adapter = capability();
    // The engine counts a call per request it inspects, and three files are one request.
    const request = adapter.inspectRequest(THREE_FILES);
    expect(request).toMatchObject({ kind: 'request', request: { capability: 'resource.read' } });

    const fulfillment = await adapter.fulfill(decode(THREE_FILES));

    expect(cards()).toHaveLength(1);
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ id: cards()[0].id, category: 'resource.read' })]);
    expect(cards()[0].capability).toMatchObject({
      operation: 'resource.read',
      status: 'success',
      requestSummary: '3 files: alice-ch1.md, alice-ch2.md, +1 more',
      metadata: {
        filesNamed: 3,
        filesRead: 3,
        files: [
          { group: 'manuscript', path: 'alice-ch1.md', outcome: 'read', startLine: 1, endLine: 12 },
          { group: 'manuscript', path: 'alice-ch2.md', outcome: 'read', startLine: 1, endLine: 8 },
          { group: 'characters', path: 'white-rabbit.md', outcome: 'read', startLine: 1, endLine: 3 }
        ]
      }
    });
    expect(fulfillment.evidence).toContain('<workshop-capability-result name="resource.read" status="success"');
    for (const text of ['Chapter one line 12', 'Chapter two line 8', 'Late for the Duchess.']) {
      expect(fulfillment.evidence).toContain(text);
    }
    expect(fulfillment.evidence).toContain('untrusted project-file evidence');
  });

  it('records a row per file, each with its own line range and fingerprint, all naming the one card', async () => {
    const fulfillment = await capability().fulfill(decode(THREE_FILES));

    const [card] = cards();
    expect(fulfillment.deliveredSources).toEqual([
      expect.objectContaining({
        kind: 'resource', label: 'alice-ch1.md', turnId: card.id,
        configuredResource: { group: 'manuscript', path: 'alice-ch1.md' }, lineRange: { start: 1, end: 12 }, sourceFingerprint: sha256(CH1)
      }),
      expect.objectContaining({
        kind: 'resource', label: 'alice-ch2.md', turnId: card.id,
        configuredResource: { group: 'manuscript', path: 'alice-ch2.md' }, lineRange: { start: 1, end: 8 }, sourceFingerprint: sha256(CH2)
      }),
      expect.objectContaining({
        kind: 'resource', label: 'white-rabbit.md', turnId: card.id,
        configuredResource: { group: 'characters', path: 'white-rabbit.md' }, lineRange: { start: 1, end: 3 }, sourceFingerprint: sha256(RABBIT)
      })
    ]);
    expect(fulfillment.deliveredItems).toEqual(['alice-ch1.md', 'alice-ch2.md', 'white-rabbit.md']);
    // Each row's size is its own section's, so three rows never claim the card three times over.
    const sizes = fulfillment.deliveredSources!.map((row) => row.sizeChars);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThan(card.content.length);
    expect(new Set(sizes).size).toBe(3);
    // Host-private: no fingerprint in the card, the session or the evidence.
    for (const text of [CH1, CH2, RABBIT]) {
      expect(JSON.stringify(session.getSnapshot())).not.toContain(sha256(text));
      expect(fulfillment.evidence).not.toContain(sha256(text));
    }
  });

  it('opens Read in from each row: the row names its own file, and says when that file changed', async () => {
    const fulfillment = await capability().fulfill(decode(THREE_FILES));
    // The reader's catalog over the same project, after chapter two was edited.
    const now = PROJECT.map((file) => (file.path === 'alice-ch2.md' ? { ...file, content: `${CH2}\nA new last line.` } : file));
    const { factory } = aliceResources(now);
    const provider = await factory.createProvider([]);
    const catalog = {
      entries: () => provider.listResources(),
      readText: async (summary: { path: string }) => (await provider.loadResources([summary.path]))[0]?.content
    };

    const changed: Record<string, boolean> = {};
    for (const row of fulfillment.deliveredSources!) {
      const read = await readWorkshopReadInResource(catalog, row.configuredResource!.group, row.configuredResource!.path);
      expect(read).toMatchObject({ kind: 'content', resource: { path: row.label } });
      if (read.kind === 'content') {
        changed[row.label] = read.fingerprint !== row.sourceFingerprint;
        expect(read.content.split('\n').slice(row.lineRange!.start - 1, row.lineRange!.end)).toHaveLength(row.lineRange!.end);
      }
    }
    expect(changed).toEqual({ 'alice-ch1.md': false, 'alice-ch2.md': true, 'white-rabbit.md': false });
  });

  it('records a partial card, and rows only for the files delivered, when one path is missing', async () => {
    const fulfillment = await capability().fulfill({
      capability: 'resource.read',
      files: [{ group: 'manuscript', path: 'alice-ch1.md' }, { group: 'manuscript', path: 'alice-ch7.md' }]
    });

    expect(cards()).toHaveLength(1);
    expect(cards()[0].capability).toMatchObject({ status: 'partial', metadata: { filesNamed: 2, filesRead: 1 } });
    expect(fulfillment.evidence).toContain('status="partial"');
    expect(fulfillment.evidence).toContain('Not read: The requested path is not one of the configured project resources in that group.');
    expect(fulfillment.deliveredSources).toEqual([expect.objectContaining({ label: 'alice-ch1.md', turnId: cards()[0].id })]);
    expect(fulfillment.deliveredItems).toEqual(['alice-ch1.md']);
  });

  it('records a failed card and no row when no file was delivered', async () => {
    const fulfillment = await capability().fulfill({
      capability: 'resource.read',
      files: [{ group: 'manuscript', path: 'alice-ch7.md' }, { group: 'manuscript', path: 'alice-ch8.md' }]
    });

    expect(cards()[0].capability).toMatchObject({ status: 'failed' });
    expect(fulfillment.deliveredSources).toEqual([]);
    expect(fulfillment.deliveredItems).toEqual(['resource.read:failed']);
  });

  it('hands the engine\'s window to the read: it is fitted, and says so at its top', async () => {
    const long = [manuscript('alice-ch1.md', aliceLines(2_000, 99)), manuscript('alice-ch2.md', aliceLines(2_000, 99))];
    const request: WorkshopCapabilityRequest = {
      capability: 'resource.read',
      files: [{ group: 'manuscript', path: 'alice-ch1.md' }, { group: 'manuscript', path: 'alice-ch2.md' }]
    };

    const fitted = await capability(long).fulfill(request, windowWith(12_000));

    const [card] = cards();
    expect(card.capability).toMatchObject({ status: 'success', metadata: { limitedBy: 'context-window', truncated: true } });
    expect(card.content).toMatch(/^# Project resources · 2 of 2 files read\n\nThis read was limited to [\d,]+ bytes, half the room left in your context window\./);
    // The evidence as the model receives it costs about half the room: the fit measured it escaped.
    expect(Buffer.byteLength(fitted.evidence, 'utf8') / PROMPT_BUDGETS.inferenceContext.bytesPerToken).toBeLessThan(6_600);
    expect(fitted.deliveredSources).toHaveLength(2);
    for (const row of fitted.deliveredSources!) {
      expect(row.lineRange!.end).toBeLessThan(PROMPT_BUDGETS.workshopResource.readDefaultLines);
    }
  });

  it('records a refused read as a rejected card, with the room it had, when the window is too small', async () => {
    const long = [manuscript('alice-ch1.md', aliceLines(2_000, 99)), manuscript('alice-ch2.md', aliceLines(2_000, 99))];

    const fulfillment = await capability(long).fulfill({
      capability: 'resource.read',
      files: [{ group: 'manuscript', path: 'alice-ch1.md' }, { group: 'manuscript', path: 'alice-ch2.md' }]
    }, windowWith(1_600));

    expect(cards()[0].capability).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'resource-context-window' } });
    expect(fulfillment.evidence).toContain('half the room left in your context window holds only about 3,200 bytes');
    expect(fulfillment.deliveredSources).toEqual([]);
  });

  it('logs counts and groups for several files, and never a path or a line of the text', async () => {
    const adapter = capability();
    const request = decode(THREE_FILES);

    await adapter.fulfill(request);

    expect(adapter.requestLogSummary(request)).toBe('files=3; groups=manuscript,characters; lines=default');
    const lines = appendLine.mock.calls.map(([line]) => line).join('\n');
    expect(lines).toContain('input=files=3; groups=manuscript,characters; lines=default');
    expect(lines).toContain('read files=3 delivered=3 status=success');
    expect(lines).toContain('path=n/a');
    expect(lines).not.toMatch(/alice-ch|white-rabbit|Chapter one|Duchess/);
  });

  it('says what it is reading while it reads', () => {
    const adapter = capability();
    const several = decode(THREE_FILES);
    const one: WorkshopCapabilityRequest = { capability: 'resource.read', files: [{ group: 'characters', path: 'white-rabbit.md' }] };

    expect(adapter.statusMessage(several)).toBe('Jill is reading 3 project files…');
    expect(adapter.statusTicker(several)).toBe('Read · 3 files');
    expect(adapter.statusMessage(one)).toBe('Jill is reading white-rabbit.md…');
    expect(adapter.statusTicker(one)).toBe('Read · characters');
    // A one-path read keeps the log line it has always had.
    expect(adapter.requestLogSummary(one)).toBe('group=characters; path="white-rabbit.md"; lines=default-default');
  });

  it('over the call limit, records the read\'s summary on its rejected card', () => {
    const adapter = capability();

    adapter.handleCapabilityLimit(decode(THREE_FILES));

    expect(cards()[0].capability).toMatchObject({
      status: 'rejected',
      requestSummary: '3 files: alice-ch1.md, alice-ch2.md, +1 more',
      metadata: { rejectionReason: 'capability-call-limit' }
    });
  });
});
