import { readFile } from 'fs/promises';
import * as path from 'path';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { workshopReadEvidenceTokens } from '@/application/services/workshop/reads/WorkshopReadWindowFit';
import { WorkshopHelpCapability } from '@/application/services/workshop/help/WorkshopHelpCapability';
import { renderWorkshopHelpRead, workshopHelpReadCall } from '@/application/services/workshop/help/WorkshopHelpRenderer';
import { workshopHelpHeader } from '@/application/services/workshop/help/WorkshopHelpCopy';
import {
  WorkshopHelpReference, WORKSHOP_HELP_AREAS, searchWorkshopHelp
} from '@/application/services/workshop/help/WorkshopHelpReference';

const directory = path.resolve('packages/core/resources/help');
const codec = new WorkshopCapabilityXmlCodec();
const log = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
const withRoom = (freeInputTokens: number): CapabilityContextWindow => ({
  contextLength: 100000, outputTokens: 1000, headroomTokens: 1000, requestTokens: 5000, freeInputTokens
});
const controller = new AbortController();

async function realReference() {
  const manifest = JSON.parse(await readFile('apps/vscode-extension/package.json', 'utf8')) as { version: string };
  const files = { readFile: jest.fn((file: string) => readFile(file)) };
  const reference = new WorkshopHelpReference(files, directory, manifest.version, log);
  const capability = new WorkshopHelpCapability(reference, log, controller);
  return { reference, files, capability };
}

describe('the shipped help reference', () => {
  it('shares an index across simultaneous calls and reaches every section through its own heading and id', async () => {
    const { reference, files } = await realReference();
    const [loaded, same] = await Promise.all([reference.load(), reference.load()]);
    expect(loaded?.referenceVersion).toBe(reference.version);
    expect(same).toBe(loaded);
    const index = loaded?.sections;
    expect(files.readFile).toHaveBeenCalledTimes(WORKSHOP_HELP_AREAS.length);
    for (const section of index!.values()) {
      expect(searchWorkshopHelp(index!, section.heading).hits[0].id).toBe(section.id);
      expect(section.id.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopHelp.sectionIdCharacters);
      expect((`## ${section.heading}\n${section.body}`).length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopHelp.sectionCharacters);
      expect(codec.inspect(workshopHelpReadCall([section.id]))).toEqual({
        kind: 'request', request: { capability: 'help.read', sections: [section.id] }
      });
    }
  });

  it('reads the known sections whole and in requested order alongside an unknown id', async () => {
    const { reference, capability } = await realReference();
    const sections = ['workshop#pinned-context', 'missing#unknown', 'overview#about-this-reference'];
    const result = await capability.fulfill({ capability: 'help.read', sections });
    expect(result.status).toBe('partial');
    expect(result.content).toContain(reference.version);
    expect(result.content).toContain('Unknown section: missing#unknown');
    const index = (await reference.load())!.sections;
    for (const id of [sections[0], sections[2]]) {
      expect(result.content).toContain(index.get(id)!.body);
    }
    expect(result.content!.indexOf(sections[0])).toBeLessThan(result.content!.indexOf(sections[2]));
  });

  it('fits whole sections including the cost of the exact call, and refuses a section when no room remains', async () => {
    const { reference, capability } = await realReference();
    const loaded = (await reference.load())!;
    const sections = ['workshop#pinned-context', 'overview#about-this-reference', 'workshop#conversation-settings'];
    const request = { capability: 'help.read' as const, sections };
    const header = workshopHelpHeader(loaded.referenceVersion, reference.version);
    const half = workshopReadEvidenceTokens(renderWorkshopHelpRead(request, header, loaded, 1));
    const result = await capability.fulfill(request, withRoom(half * 2));
    // A window-limited read of known sections is a success marked truncated, as lens.read reports one.
    expect(result.status).toBe('success');
    expect(result.metadata).toMatchObject({ sectionsRead: 1, truncated: true });
    expect(workshopReadEvidenceTokens(result)).toBeLessThanOrEqual(half);
    const hint = result.content!.match(/<prose-minion-tool-call.*$/m)![0];
    const next = codec.inspect(hint);
    expect(next).toEqual({ kind: 'request', request: { capability: 'help.read', sections: sections.slice(1) } });
    if (next.kind !== 'request' || next.request.capability !== 'help.read') {
      throw new Error('Invalid hint');
    }
    expect((await capability.fulfill(next.request)).metadata).toMatchObject({ sectionsRead: 2, truncated: false });

    const refused = await capability.fulfill({ ...request, sections: sections.slice(0, 1) }, withRoom(6));
    expect(refused.status).toBe('rejected');
    expect(refused.error).toContain('3 tokens');
    expect(refused.error).toContain(reference.version);
    expect(refused.error).not.toContain('<prose-minion-tool-call');
  });

  it('caps and fits search hits, counts every omission and never offers a continuation', async () => {
    const { capability, reference } = await realReference();
    const request = { capability: 'help.search' as const, query: 'settings' };
    const result = await capability.fulfill(request);
    const matched = Number(result.metadata!.matchCount);
    const shown = PROMPT_BUDGETS.workshopHelp.searchHits;
    expect(matched).toBeGreaterThan(shown);
    expect(result.metadata).toMatchObject({ notShown: matched - shown, sectionsRead: shown });
    expect(result.content).toContain(`${matched - shown} more matching`);
    expect(result.content).toContain('Narrow the query');
    expect(result.content).toContain(reference.version);
    expect(result.content).not.toContain('<prose-minion-tool-call');
    const limited = await capability.fulfill(request, withRoom(workshopReadEvidenceTokens(result)));
    expect(Number(limited.metadata!.sectionsRead)).toBeLessThan(shown);
    expect(Number(limited.metadata!.sectionsRead)).toBeGreaterThan(0);
    expect(limited.content).not.toContain('<prose-minion-tool-call');
  });

  it('reports an unreadable installation in host words on every operation without exposing the path or error', async () => {
    const files = { readFile: jest.fn(async () => { throw new Error('/private/a-writers-file'); }) };
    const reference = new WorkshopHelpReference(files, '/private', '1.0.0', log);
    const capability = new WorkshopHelpCapability(reference, log, controller);
    const search = await capability.fulfill({ capability: 'help.search', query: 'private phrase' });
    const read = await capability.fulfill({ capability: 'help.read', sections: ['unknown#private'] });
    for (const result of [read, search]) {
      expect(result.status).toBe('failed');
      expect(result.error).toContain('1.0.0');
      expect(result.error).toContain('cannot check');
      expect(result.error).not.toContain('/private');
    }
    expect(JSON.stringify(log.appendLine.mock.calls)).not.toMatch(/private|writers-file/);
  });
});
