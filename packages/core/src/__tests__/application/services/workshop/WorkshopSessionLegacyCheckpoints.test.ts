/**
 * Development-checkpoint shapes found in real saved sessions (ADR 2026-07-30),
 * read through the real store and the persistence coordinator's open path.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WORKSHOP_NO_ROOM_SEED } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import {
  assertCreativeVariationsDraftShape
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec';
import {
  assertCreativeVariationsDraftCheckpointShape,
  normalizeCreativeVariationsDraftForHydration
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsCheckpointNormalization';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import {
  CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  WorkshopCreativeVariationsDraft
} from '@messages';
import { LogSink, Workspace } from '@/platform';

const root = '/workspace/wonderland';
const directory = `${root}/prose-minion/sessions`;
const now = () => new Date('2026-08-14T12:00:00.000Z');
const workspace: Workspace = {
  workspaceFolders: () => [{ name: 'wonderland', path: root }],
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
};

const WORKUP_ID = 'cvw-00000000-0000-4000-8000-0000000000a1';
const ADVISORY_ID = `${WORKUP_ID}:card-1:flag-1`;
const SUBJECT = 'Alice closed the little door before the Rabbit could answer.';

const aliceDraft = (): WorkshopCreativeVariationsDraft => {
  const cards: NonNullable<WorkshopCreativeVariationsDraft['workup']>['cards'] = [
    {
      position: 1,
      approach: 'Give the door the delay',
      direction: 'Let the latch carry her hesitation.',
      prose: 'Alice eased the little door shut and held the latch until the Rabbit gave up waiting.',
      tradeoff: { gain: 'The delay becomes physical.', cost: 'The latch draws the eye.' },
      invariantFlags: [{
        id: ADVISORY_ID,
        invariantField: 'must-survive',
        kind: 'advisory-risk',
        note: 'The latch may pull attention from the unanswered question.'
      }]
    },
    {
      position: 2,
      approach: 'Watch the Rabbit wait',
      direction: 'Hold on the Rabbit while Alice keeps the silence.',
      prose: 'The Rabbit twitched his whiskers twice; Alice kept her hand flat against the wood.',
      tradeoff: { gain: 'The pressure belongs to the Rabbit.', cost: 'The camera leaves Alice.' },
      invariantFlags: []
    },
    {
      position: 3,
      approach: 'Nearly answer',
      direction: 'Begin a reply, then close the door on it.',
      prose: '“I only meant—” Alice pushed the door to before the rest could follow.',
      tradeoff: { gain: 'The restraint becomes audible.', cost: 'More dialogue than the source.' },
      invariantFlags: []
    }
  ];
  return {
    subject: { text: SUBJECT, provenance: { kind: 'pasted' } },
    surroundingContext: { writerText: '', sourceReferences: [] },
    invariants: { mustSurvive: 'Alice does not answer the Rabbit.', mustNotChange: '' },
    intent: { kind: 'custom-aim', aim: 'Make the refusal curious, not cruel.', distance: 'tail' },
    requestedCount: 3,
    workup: {
      workupId: WORKUP_ID,
      generationProtocolVersion: CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
      cards,
      overlap: computeCreativeVariationsTextualOverlap(SUBJECT, cards)
    },
    selections: [{ position: 1, carryMode: 'direction' }],
    note: ''
  };
};

/** A named session file as a build from 2026-08-10..15 wrote it. */
function legacyAdvisorySession(sessionId: string): WorkshopPersistedSessionV2 {
  const source = new WorkshopSessionService(() => now().getTime());
  source.recordSessionMarker('start', 'Session started.');
  source.createWidgetConfig({ widgetId: 'creative-variations', draft: aliceDraft() });
  const workshop = source.exportCommittedState();
  const selection = (workshop.widgetConfigs![0].draft as WorkshopCreativeVariationsDraft).selections[0] as unknown as Record<string, unknown>;
  selection.acceptedAdvisoryRiskIds = [ADVISORY_ID];
  return {
    schemaVersion: 2, sessionId, title: 'Alice at the little door',
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 1, excerptWordCount: 0 },
    workshop, conversations: []
  };
}

function setup() {
  const fs = new MemoryFileSystem();
  const logLines: string[] = [];
  const log: LogSink = { appendLine: (line) => logLines.push(line), clear: jest.fn(), show: jest.fn() };
  const store = new WorkshopSessionStore(fs, workspace, log, now);
  const session = new WorkshopSessionService(() => now().getTime());
  let nextId = 0;
  const assistant = {
    exportWorkshopConversationArchive: jest.fn(() => []),
    importWorkshopConversationArchive: jest.fn(async () => []),
    discardConversation: jest.fn()
  } as unknown as AssistantToolService;
  const settings = { getWriterProfile: () => DEFAULT_WORKSHOP_WRITER_PROFILE } as WorkshopConversationSettingsService;
  const coordinator = new WorkshopSessionPersistenceCoordinator(
    session, assistant, settings, new WorkshopSessionTimeService({ now }), store, WORKSHOP_NO_ROOM_SEED, log,
    { now, idFactory: () => `room-${++nextId}`, ensureAssistantReady: jest.fn(async () => undefined) }
  );
  return { fs, store, session, coordinator, logLines };
}

const fileName = '20260814-120000-alice-at-the-little-door.json';
const filePath = `${directory}/${fileName}`;

describe('Creative Variations advisory acceptance (dev checkpoint 2026-08-10..15)', () => {
  it('lists, opens, saves without the field, and reopens with nothing left to repair', async () => {
    const { fs, store, session, coordinator, logLines } = setup();
    fs.setJson(filePath, legacyAdvisorySession('alice-door'));
    await coordinator.initialize();

    const listed = await store.list();
    expect(listed.sessions.map((entry) => entry.sessionId)).toEqual(['alice-door']);
    expect(logLines.filter((line) => line.includes('Skipped'))).toEqual([]);

    await coordinator.openNamed('alice-door');
    const opened = session.getWidgetConfig('wc-1');
    expect(opened?.widgetId).toBe('creative-variations');
    expect((opened?.draft as WorkshopCreativeVariationsDraft).selections).toEqual([{ position: 1, carryMode: 'direction' }]);

    const normalizedLines = logLines.filter((line) => line.includes('Development checkpoint normalized'));
    expect(normalizedLines).toEqual([
      '[WorkshopSessionPersistence] Development checkpoint normalized '
      + '(normalizations=dropped-creative-variations-advisory-acceptance)'
    ]);
    // Names only: none of the writer's text, ids or paths reach the log.
    for (const fragment of ['Alice', 'Rabbit', ADVISORY_ID, WORKUP_ID, 'wonderland', 'alice-door']) {
      expect(normalizedLines.join('\n')).not.toContain(fragment);
    }

    await coordinator.saveNamed('Alice at the little door', 'alice-door');
    await coordinator.flush();
    const written = JSON.stringify(fs.json(filePath));
    expect(written).not.toContain('acceptedAdvisoryRiskIds');
    expect(JSON.stringify(fs.json(`${directory}/current.json`))).not.toContain('acceptedAdvisoryRiskIds');

    const reread = await store.readNamedWithRecovery('alice-door');
    expect(reread?.normalizations).toEqual([]);
    expect(reread?.session.workshop.widgetConfigs?.[0].draft).toEqual(aliceDraft());
  });

  it('still refuses any other unknown key on the same selection', async () => {
    const { fs, store, logLines } = setup();
    const value = legacyAdvisorySession('alice-door');
    const selection = (value.workshop.widgetConfigs![0].draft as WorkshopCreativeVariationsDraft).selections[0] as unknown as Record<string, unknown>;
    selection.acceptedTeaTime = true;
    fs.setJson(filePath, value);

    await expect(store.list()).resolves.toMatchObject({ sessions: [] });
    expect(logLines).toEqual(expect.arrayContaining([
      expect.stringContaining('selections[0] contains unknown field acceptedTeaTime')
    ]));
  });
});

describe('CreativeVariationsCheckpointNormalization', () => {
  const legacyDraft = (acceptance: unknown): unknown => {
    const draft = aliceDraft() as unknown as { selections: Record<string, unknown>[] };
    draft.selections[0].acceptedAdvisoryRiskIds = acceptance;
    return draft;
  };

  it('accepts the legacy key only at the checkpoint boundary, and drops it by name', () => {
    const value = legacyDraft([ADVISORY_ID]);
    expect(() => assertCreativeVariationsDraftShape(value, 'draft')).toThrow(/acceptedAdvisoryRiskIds/);
    expect(() => assertCreativeVariationsDraftCheckpointShape(value, 'draft')).not.toThrow();
    expect(normalizeCreativeVariationsDraftForHydration(value)).toEqual({
      draft: aliceDraft(),
      normalizations: ['dropped-creative-variations-advisory-acceptance'],
      notices: []
    });
    // The input is not mutated.
    expect((value as { selections: Record<string, unknown>[] }).selections[0])
      .toHaveProperty('acceptedAdvisoryRiskIds');
  });

  it('accepts the empty list the old shape allowed', () => {
    expect(normalizeCreativeVariationsDraftForHydration(legacyDraft([])).normalizations)
      .toEqual(['dropped-creative-variations-advisory-acceptance']);
  });

  it.each([
    ['a string', 'ids'],
    ['a list holding a number', [7]],
    ['null', null]
  ])('refuses the legacy key when it is %s', (_label, acceptance) => {
    expect(() => assertCreativeVariationsDraftCheckpointShape(legacyDraft(acceptance), 'draft'))
      .toThrow(/selections\[0\]\.acceptedAdvisoryRiskIds/);
  });

  it('refuses the legacy key anywhere but a selection', () => {
    const draft = aliceDraft() as unknown as Record<string, unknown>;
    draft.acceptedAdvisoryRiskIds = [ADVISORY_ID];
    expect(() => assertCreativeVariationsDraftCheckpointShape(draft, 'draft'))
      .toThrow(/unknown field acceptedAdvisoryRiskIds/);
  });

  it('hydrates a current draft with no normalization', () => {
    expect(normalizeCreativeVariationsDraftForHydration(aliceDraft())).toEqual({
      draft: aliceDraft(),
      normalizations: [],
      notices: []
    });
  });
});
