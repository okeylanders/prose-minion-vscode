import * as fs from 'fs';
import { WorkshopHelpCapability } from '@/application/services/workshop/help/WorkshopHelpCapability';
import { WorkshopHelpReference, WORKSHOP_HELP_AREAS } from '@/application/services/workshop/help/WorkshopHelpReference';
import { WORKSHOP_QUERY_TERMS } from '@/application/services/workshop/WorkshopTextSearch';
import { bundledHelpReference, helpDirectory, helpVersion } from '@/__tests__/application/services/workshop/help/bundledHelpReference';
import { createRecallRunHarness, recallCall } from '@/__tests__/application/services/workshop/recall/workshopRecallRunHarness';

const newLog = () => ({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() });
const logged = (log: ReturnType<typeof newLog>): string[] => log.appendLine.mock.calls.map(([line]) => String(line));
const turn = { signal: new AbortController().signal };
const realRead = (file: string) => fs.promises.readFile(file);

describe('loading the help reference', () => {
  it('loads a reference written for another version, and every result names both versions once', async () => {
    const log = newLog();
    const installed = '99.0.0';
    const reference = new WorkshopHelpReference({ readFile: realRead }, helpDirectory, installed, log);
    const capability = new WorkshopHelpCapability(reference, log, turn);
    const header = `Prose Minion reference, version ${helpVersion}. You are running ${installed}, so newer features may be missing.`;
    const search = await capability.fulfill({ capability: 'help.search', query: 'pin a file' });
    const read = await capability.fulfill({ capability: 'help.read', sections: ['workshop#pinned-context'] });
    for (const result of [search, read]) {
      expect(result.status).toBe('success');
      expect(result.content!.split('\n')[0]).toBe(header);
    }
    expect(logged(log).filter(line => line.includes('mismatch'))).toEqual([
      `[WorkshopHelpReference] version mismatch reference=${helpVersion} installed=${installed}`
    ]);
  });

  it('adds no caveat when the reference is the installed version', async () => {
    const log = newLog();
    const capability = new WorkshopHelpCapability(bundledHelpReference(log), log, turn);
    const search = await capability.fulfill({ capability: 'help.search', query: 'pin a file' });
    expect(search.content!.split('\n')[0]).toBe(`Prose Minion reference, version ${helpVersion}.`);
    expect(logged(log).join('\n')).not.toContain('mismatch');
  });

  it('fails a reference whose overview names no version', async () => {
    const log = newLog();
    const readFile = async (file: string) => file.endsWith('overview.md')
      ? Buffer.from((await realRead(file)).toString('utf8').replace(/^Reference version: .*$/m, 'Reference version: soon'))
      : realRead(file);
    expect(await new WorkshopHelpReference({ readFile }, helpDirectory, helpVersion, log).load()).toBeUndefined();
  });

  it('retries a read that failed, and the next call gets the reference', async () => {
    const log = newLog();
    let fail = true;
    const readFile = jest.fn(async (file: string) => {
      if (fail) {
        throw new Error('busy');
      }
      return realRead(file);
    });
    const reference = new WorkshopHelpReference({ readFile }, helpDirectory, helpVersion, log);
    expect(await reference.load()).toBeUndefined();
    fail = false;
    const loaded = await reference.load();
    expect(loaded?.sections.size).toBeGreaterThan(0);
    expect(await reference.load()).toBe(loaded);
    expect(readFile).toHaveBeenCalledTimes(WORKSHOP_HELP_AREAS.length * 2);
  });

  it('shares one build among concurrent callers', async () => {
    const readFile = jest.fn(realRead);
    const reference = new WorkshopHelpReference({ readFile }, helpDirectory, helpVersion, newLog());
    const all = await Promise.all([reference.load(), reference.load(), reference.load()]);
    expect(new Set(all).size).toBe(1);
    expect(readFile).toHaveBeenCalledTimes(WORKSHOP_HELP_AREAS.length);
  });

  it('logs a run of failures once, and again only after a success ends the run', async () => {
    const log = newLog();
    let fail = true;
    const reference = new WorkshopHelpReference({
      readFile: async (file: string) => {
        if (fail) {
          throw new Error('/private/a-writers-file');
        }
        return realRead(file);
      }
    }, helpDirectory, helpVersion, log);
    const unavailable = () => logged(log).filter(line => line.includes('reference unavailable')).length;
    await reference.load();
    await reference.load();
    await Promise.all([reference.load(), reference.load()]);
    expect(unavailable()).toBe(1);
    fail = false;
    expect(await reference.load()).toBeDefined();
    expect(logged(log).join('\n')).not.toMatch(/private|writers-file/);
  });
});

describe('a help search past the query term limit', () => {
  const searched = ['pinned', 'context', 'memory', 'lightbox', 'board', 'proofread', 'dictionary', 'model'];
  const ignored = ['zebra', 'quokka'];

  it('holds the limit the test names', () => {
    expect(searched).toHaveLength(WORKSHOP_QUERY_TERMS);
  });

  it('names the words past the limit, asks for fewer, and searches the first eight', async () => {
    const log = newLog();
    const capability = new WorkshopHelpCapability(bundledHelpReference(log), log, turn);
    const long = await capability.fulfill({ capability: 'help.search', query: [...searched, ...ignored].join(' ') });
    const eight = await capability.fulfill({ capability: 'help.search', query: searched.join(' ') });
    const line = `Not searched, past the ${WORKSHOP_QUERY_TERMS}-term limit: zebra, quokka. Ask with fewer words.`;
    expect(long.content!.split('\n')).toContain(line);
    expect(long.metadata).toMatchObject({ ignoredTerms: 2 });
    expect(JSON.stringify(long.metadata)).not.toMatch(/zebra|quokka/);
    // The same sections, in the same order, as the eight words alone.
    expect(long.content!.split('\n').filter(entry => entry !== line)).toEqual(eight.content!.split('\n'));
    expect(eight.content).not.toContain('Not searched');
    expect(eight.metadata).not.toHaveProperty('ignoredTerms');
  });

  it('keeps every word of the query out of the log through the persona engine', async () => {
    const room = createRecallRunHarness({ help: bundledHelpReference });
    const query = [...searched, ...ignored].join(' ');
    try {
      await room.coordinator.initialize();
      room.session.setSessionScope('open');
      await room.host('help-long-query', 'Where is everything?', [
        recallCall('help.search', `<query>${query}</query>`),
        () => {
          expect(room.sent.at(-1)).toContain('past the 8-term limit: zebra, quokka');
          return 'The reference covers those in several sections.';
        }
      ]);
      const lines = (room.log.appendLine as jest.Mock).mock.calls.map(([entry]) => String(entry)).join('\n');
      expect(lines).toContain('capability=help.search');
      for (const word of [...searched, ...ignored]) {
        expect(lines).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
      }
    } finally {
      room.dispose();
    }
  });
});
