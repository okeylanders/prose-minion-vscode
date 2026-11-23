/**
 * PR #277 F-01: a persona's lens lookup names no project file in the log.
 *
 * The production path: the real `LexicalGravityLensRepository` and the
 * persona capability share one output channel. A project folder holds a
 * lens that reads, a malformed file with a private name, and a file whose
 * declared slug does not match its name. A persona lists the library, reads
 * a built-in and reads the project lens. No line the shared logger received
 * may hold a filename, a path, the slug of a file that did not read, or the
 * raw error; the count of unreadable files is still reported.
 *
 * *Alice*, with made-up names.
 */
import { unavailableHelpReference } from '@/__tests__/application/services/workshop/help/unavailableHelpReference';
import { unavailableProjectLocations } from '@/__tests__/application/services/workshop/locations/unavailableProjectLocations';
import { unavailableFileHistory } from '@/__tests__/application/services/workshop/history/unavailableFileHistory';
import * as path from 'path';
import { FileType } from '@/platform';
import { LexicalGravityLensRepository } from '@/infrastructure/storage/LexicalGravityLensRepository';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { builtInLexicalGravityLenses } from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { WorkshopResourceSources } from '@/application/services/workshop/WorkshopResourceCapability';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import { aliceLens } from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';

const ROOT = '/workspace/wonderland-private-novel';
const DIRECTORY = path.join(ROOT, 'prose-minion', 'lenses');
const FILES = {
  [path.join(DIRECTORY, 'tea-party.json')]: JSON.stringify(aliceLens('tea-party')),
  // Malformed, under a name taken from a private subject.
  [path.join(DIRECTORY, 'duchess-private-pepper.json')]: '{ "RAW-PARSE-MARKER": tru',
  // Valid, but its declared slug is not its file's.
  [path.join(DIRECTORY, 'cheshire-secret-grin.json')]: JSON.stringify(aliceLens('declared-secret-slug'))
};
/** Nothing of a file that did not read, the folder, or an error's own words. */
const PRIVATE = [
  'duchess', 'pepper', 'cheshire', 'grin', 'declared-secret-slug', 'RAW-PARSE-MARKER',
  '.json', 'JSON', 'Skipped', 'does not match filename', 'wonderland-private-novel', 'prose-minion/lenses', '/workspace'
];
const call = (operation: string, body = ''): string =>
  `<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`;

function wire() {
  const logged: string[] = [];
  const log = { appendLine: (line: string) => { logged.push(line); }, clear: () => undefined, show: () => undefined };
  const readDirectory = jest.fn(async () =>
    Object.keys(FILES).map((file) => [path.basename(file), FileType.File] as [string, FileType]));
  const repository = new LexicalGravityLensRepository(
    createFakeFileSystem({ readDirectory }, FILES),
    createFakeWorkspace({ workspaceFolders: () => [{ path: ROOT, name: 'wonderland-private-novel' }] }),
    log
  );
  const session = new WorkshopSessionService(() => Date.parse('2026-11-17T10:00:00.000Z'));
  session.setSessionScope('open');
  session.beginPersonaMessage('host-request', 'What lenses have I built?');
  const capability = new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService,
    {} as WorkshopAnalysisSidePass,
    { createProvider: jest.fn() } as unknown as WorkshopResourceSources,
    session,
    log,
    {} as WorkshopTranscriptRecallPort,
    offProjectMemory,
    repository,
    unavailableHelpReference,
    unavailableFileHistory,
    unavailableProjectLocations
  ).create({
    requestId: 'host-request',
    excerptVersion: session.getExcerptVersion(),
    personaId: 'jill',
    owner: { kind: 'host' },
    signal: new AbortController().signal,
    events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
  });
  const ask = async (xml: string) => {
    const inspected = capability.inspectRequest(xml);
    if (inspected.kind !== 'request') {
      throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
    }
    return capability.fulfill(inspected.request);
  };
  return { logged, repository, readDirectory, session, ask };
}

describe('a persona\'s lens lookup over the real repository and one shared log (PR #277 F-01)', () => {
  it('lists, reads a built-in and reads a project lens without logging a file\'s name, its slug, a path or the raw error', async () => {
    const { logged, ask, session } = wire();
    const [builtIn] = builtInLexicalGravityLenses();

    const catalog = await ask(call('lens.catalog'));
    const starter = await ask(call('lens.read', `<lens>${builtIn.slug}</lens>`));
    const project = await ask(call('lens.read', '<lens>tea-party</lens><section>sample</section>'));
    const missing = await ask(call('lens.read', '<lens>declared-secret-slug</lens>'));

    // The count is kept, in the evidence and in the log.
    expect(catalog.evidence).toContain('2 lens files couldn\'t be read.');
    expect(catalog.evidence).toContain('- tea-party · ');
    expect(starter.evidence).toContain('A built-in starter.');
    expect(project.evidence).toContain('## sample');
    // A file that did not read is not a lens: its declared slug names nothing.
    expect(missing.evidence).toContain('status="failed"');
    expect(logged.some((line) => line.includes('catalog page=1 pages=1') && line.includes('unreadableFiles=2'))).toBe(true);
    expect(logged.filter((line) => line.includes('capability=lens.'))).toHaveLength(4);

    // Nothing private, in any line of the shared log.
    for (const fragment of PRIVATE) {
      expect([fragment, logged.filter((line) => line.includes(fragment))]).toEqual([fragment, []]);
    }
    // Nor in what the persona was shown or the cards the session keeps: an unreadable file is a count.
    const shown = [catalog, starter, project].map((fulfillment) => fulfillment.evidence).join('\n') +
      JSON.stringify(session.readRoomLedger().filter((turn) => turn.capability?.operation.startsWith('lens.') && turn.capability.status !== 'failed'));
    for (const fragment of PRIVATE.filter((entry) => entry !== 'JSON')) {
      expect([fragment, shown.includes(fragment)]).toEqual([fragment, false]);
    }
    // The repository itself wrote nothing on the persona's path.
    expect(logged.filter((line) => line.startsWith('[LexicalGravityLensRepository]'))).toEqual([]);
  });

  it('reads a built-in without listing the project\'s folder at all', async () => {
    const { ask, readDirectory, logged } = wire();
    const [builtIn] = builtInLexicalGravityLenses();
    const starter = await ask(call('lens.read', `<lens>${builtIn.slug}</lens>`));
    expect(starter.evidence).toContain('status="success"');
    expect(readDirectory).not.toHaveBeenCalled();
    expect(logged.some((line) => line.includes('source=built-in'))).toBe(true);
    // A project lens, and a catalog, do read it.
    await ask(call('lens.read', '<lens>tea-party</lens>'));
    expect(readDirectory).toHaveBeenCalledTimes(1);
    await ask(call('lens.catalog'));
    expect(readDirectory).toHaveBeenCalledTimes(2);
  });

  it('the count-only listing reads the same files by the same rule as the writer\'s, and returns no name', async () => {
    const { repository, logged } = wire();
    const readable = await repository.listReadable();
    expect(readable.lenses.map((lens) => lens.slug)).toEqual(['tea-party']);
    expect(readable.unreadableFiles).toBe(2);
    expect(Object.keys(readable).sort()).toEqual(['lenses', 'unreadableFiles']);
    expect(logged).toEqual([]);

    // The writer's own view, for the Lexical Gravity modal, is as it was: each skipped file is named.
    const named = await repository.list();
    expect(named.lenses.map((lens) => lens.slug)).toEqual(readable.lenses.map((lens) => lens.slug));
    expect(named.incompatibleResources.map((resource) => resource.resourceName).sort())
      .toEqual(['cheshire-secret-grin.json', 'duchess-private-pepper.json']);
    expect(logged.filter((line) => line.startsWith('[LexicalGravityLensRepository] Skipped '))).toHaveLength(2);
  });
});
