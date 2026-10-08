/**
 * Recall of a session that itself recalled, and committed a widget (ADR
 * 2026-10-05 §3, ADR 2026-07-22). Session B reads saved session A through
 * the real persona capability, so A's words land in B as capability
 * evidence, and commits a real Gesture Playground draft, so its payload
 * lands in B's widget config and room thread artifact. B is then saved
 * through the real coordinator and store. Recalled later, B shows the
 * one-line Session Recall event, the commit's visible line and widget label,
 * and the persona replies; never A's transcript and never the widget payload.
 */

import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { prepareGesturePlaygroundOneShotCommit } from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundOneShotCommit';
import { buildWorkshopThreadArtifactFrame } from '@/application/services/workshop/WorkshopThreadArtifactFrame';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import { workshopWidgetArtifactKind } from '@shared/constants/workshopWidgets';
import type { WorkshopGesturePlaygroundDraft } from '@messages';
import { saveRecallRoom, SavedRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');

/** Bodies B holds but never shows; recall of B may return none of them. */
const NESTED = {
  /** In A's persona reply: B holds it only as recalled evidence. */
  recalledReply: 'SENTINEL-NESTED-RECALLED-REPLY',
  /** In the Gesture draft and its directive, never in the commit's visible line. */
  widgetOption: 'SENTINEL-WIDGET-OPTION',
  widgetContext: 'SENTINEL-WIDGET-CONTEXT',
  widgetNotes: 'SENTINEL-WIDGET-NOTES',
  widgetDictionary: 'SENTINEL-WIDGET-DICTIONARY'
} as const;

const gestureDraft = (): WorkshopGesturePlaygroundDraft => ({
  targetPhrase: 'she smiled',
  writerInstructions: 'Keep the reaction private.',
  contextText: `${NESTED.widgetContext}: he set the mug down. She smiled.`,
  characterNotes: `${NESTED.widgetNotes}: Mara, guarded.`,
  sourceReferences: [],
  dictionaryMarkdown: `# Gesture Dictionary\n\n${NESTED.widgetDictionary}: a private deflection.`,
  menu: [
    { heading: 'Delay the answer', options: ['Her gaze snagged', 'The smile arrived late', 'The answer waited'] },
    { heading: 'Move it into the hands', options: [`${NESTED.widgetOption}: she turned her mug`, 'Her thumb found the seam', 'The spoon went still'] },
    { heading: 'Let the observer read it', options: ['He knew that quiet', 'He mistook it for ease', 'The delay told him enough'] },
    { heading: 'Use the room', options: ['The kettle clicked', 'Silence took the chair', 'The doorway stayed open'] }
  ],
  selections: [`${NESTED.widgetOption}: she turned her mug`, 'The kettle clicked'],
  note: 'keep it small',
  includeDictionaryInCommit: true
});

interface Nested {
  readonly source: SavedRecallRoom;
  readonly nested: SavedRecallRoom;
  /** The evidence B's own read returned, as the persona received it. */
  readonly evidence: string;
  readonly commitLine: string;
}

async function saveNestedRooms(): Promise<Nested> {
  const source = await saveRecallRoom('Bridge decisions', (session, advance) => {
    session.setSessionScope('open');
    advance(60_000);
    session.beginPersonaMessage('a-1', 'Does the bridge hold?');
    advance(60_000);
    session.completeRun('a-1', `${NESTED.recalledReply}: the bridge holds, and the river keeps the secret.`,
      undefined, false, 'runtime-a');
  }, { idPrefix: 'source' });

  let evidence = '';
  const prepared = prepareGesturePlaygroundOneShotCommit({ widgetId: 'gesture-playground', requestToken: 'token-1', draft: gestureDraft() });
  if (!prepared.ok) {
    throw new Error(prepared.message);
  }
  const { commit } = prepared;
  const widgetFrame = buildWorkshopThreadArtifactFrame({
    id: 'ta-1',
    kind: workshopWidgetArtifactKind('gesture-playground'),
    name: commit.artifact.label,
    content: commit.artifact.content
  });

  const nested = await saveRecallRoom('Recall and gestures', async (session, advance, room) => {
    session.setSessionScope('open');
    // A host turn that recalls A, through the real persona capability.
    advance(60_000);
    session.beginPersonaMessage('b-recall', 'What did we decide about the bridge?');
    const capability = new WorkshopPersonaCapabilityFactory(
      {} as DictionaryService,
      {} as WorkshopAnalysisSidePass,
      { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
      session,
      room.log,
      new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log)
    ).create({
      requestId: 'b-recall',
      excerptVersion: session.getExcerptVersion(),
      personaId: 'jill',
      owner: { kind: 'host' },
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    const inspected = capability.inspectRequest(
      `<prose-minion-tool-call name="transcript.read"><session>${source.savedSessionId}</session></prose-minion-tool-call>`
    );
    if (inspected.kind !== 'request') {
      throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
    }
    evidence = (await capability.fulfill(inspected.request)).evidence;
    advance(60_000);
    session.completeRun('b-recall', 'We settled it last time: the bridge holds.', undefined, false, 'runtime-b');

    // A real Gesture Playground commit, as the room handler records one.
    advance(60_000);
    const config = session.createWidgetConfig(commit.widgetConfigInput);
    const artifactId = session.mintWidgetArtifactId();
    const turn = session.beginPersonaMessage('b-widget', commit.displayText, undefined, {
      widgetId: commit.widgetId,
      widgetConfigId: config.id,
      rail: 'thread-artifact',
      artifactId,
      selectionCount: commit.artifact.selectionCount
    });
    session.recordRoomThreadArtifacts(turn.id, [{
      id: artifactId,
      kind: workshopWidgetArtifactKind(commit.widgetId),
      name: commit.artifact.label,
      content: commit.artifact.content
    }]);
    advance(60_000);
    session.completeRun('b-widget', 'Try the mug turning once, then the kettle.', undefined, false, 'runtime-b');
    session.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });
  }, {
    fs: source.fs,
    idPrefix: 'nested',
    // The host's retained conversation holds both bodies too, as a real one would.
    archiveMessages: [
      { role: 'user', content: 'What did we decide about the bridge?' },
      { role: 'assistant', content: '<prose-minion-tool-call name="transcript.read">…</prose-minion-tool-call>' },
      { role: 'user', content: evidence },
      { role: 'assistant', content: 'We settled it last time: the bridge holds.' },
      { role: 'user', content: `${widgetFrame}\n${commit.roomText}` },
      { role: 'assistant', content: 'Try the mug turning once, then the kettle.' }
    ]
  });
  return { source, nested, evidence, commitLine: commit.displayText };
}

describe('recall of a session that recalled and committed a widget', () => {
  let rooms: Nested;
  let saved: string;
  let data: string;
  let text: string;
  let fullRead: string;

  beforeAll(async () => {
    rooms = await saveNestedRooms();
    const { nested } = rooms;
    saved = JSON.stringify(await nested.store.readNamed(nested.savedSessionId));
    // A later room recalls B: the catalog, B in both details, and searches of B for every hidden word.
    const recall = new WorkshopTranscriptRecallService(nested.store, nested.coordinator, nested.log);
    const sessions = [{ sessionId: nested.savedSessionId }];
    const catalog = await recall.catalog({});
    const reads = [await recall.read({ sessions, detail: 'full' }), await recall.read({ sessions, detail: 'discussion' })];
    const searches = await Promise.all(
      ['sentinel', 'river secret', 'mug', 'kettle', 'gesture dictionary', 'deflection', 'guarded', 'bridge']
        .map((query) => recall.search({ query, sessionId: nested.savedSessionId }))
    );
    data = JSON.stringify([catalog, reads, searches]);
    fullRead = renderWorkshopRecallRead(reads[0], { now: NOW }).content;
    text = [
      renderWorkshopRecallCatalog(catalog, { now: NOW }),
      ...reads.map((read) => renderWorkshopRecallRead(read, { now: NOW }).content),
      ...searches.map((search) => renderWorkshopRecallSearch(search, { now: NOW }))
    ].join('\n');
  });

  it('starts from a saved session that really holds every hidden body', () => {
    // B's read of A returned A's reply as evidence, and B's file kept it.
    expect(rooms.evidence).toContain(NESTED.recalledReply);
    for (const marker of Object.values(NESTED)) {
      expect(saved).toContain(marker);
    }
  });

  it.each(Object.entries(NESTED))('never returns the %s, as data or as text', (_field, marker) => {
    expect(data).not.toContain(marker);
    expect(text).not.toContain(marker);
  });

  it('shows the nested read as one Session Recall line, and the commit by its visible line and widget label', () => {
    expect(fullRead).toMatch(/\[turn \d+ · [^\]]+ · event\] Session Recall · “Bridge decisions” · requested by Jill · success/);
    expect(fullRead).toMatch(/\[turn \d+ · [^\]]+ · Writer\]\nComposed with Gesture Playground · 2 \w+\n/);
    expect(fullRead).toContain(rooms.commitLine);
    expect(fullRead).toContain('We settled it last time: the bridge holds.');
    expect(fullRead).toContain('Try the mug turning once, then the kettle.');
  });
});
