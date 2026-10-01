import {
  WORKSHOP_SNAPSHOT_TURN_WINDOW,
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopGesturePlaygroundDraft
} from '@messages';
import { runCanonicalScriptedRoom, ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';

const gestureDraft = (): WorkshopGesturePlaygroundDraft => ({
  targetPhrase: 'she smiled',
  writerInstructions: 'Keep the reaction private.',
  contextText: 'He set the mug down. She smiled.',
  characterNotes: 'Mara — guarded.',
  sourceReferences: [],
  dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
  menu: [
    { heading: 'Delay the answer', options: ['Her gaze snagged', 'The smile arrived late', 'The answer waited'] },
    { heading: 'Move it into the hands', options: ['She turned her mug', 'Her thumb found the seam', 'The spoon went still'] },
    { heading: 'Let the observer read it', options: ['He knew that quiet', 'He mistook it for ease', 'The delay told him enough'] },
    { heading: 'Use the room', options: ['The kettle clicked', 'Silence took the chair', 'The doorway stayed open'] }
  ],
  selections: ['She turned her mug'],
  note: 'keep it small',
  includeDictionaryInCommit: false
});

describe('per-turn rewindability on the snapshot (ADR 2026-09-30 §4)', () => {
  it('offers Rewind/Branch on replies and writer messages, never on cards or dividers', () => {
    const room = runCanonicalScriptedRoom();
    const snapshot = room.session.getSnapshot();
    const byId = new Map(snapshot.turns.map((turn) => [turn.id, turn]));

    for (const [turnId, verdict] of Object.entries(snapshot.turnRewindability)) {
      const turn = byId.get(turnId)!;
      const eligible = turn.capability === undefined && (
        (turn.role === 'assistant' && turn.participant !== 'session')
        || (turn.role === 'user' && turn.artifact !== 'tool_request')
      );
      expect({ turnId, artifact: turn.artifact, eligible }).toEqual({ turnId, artifact: turn.artifact, eligible: true });
      expect(verdict).toEqual({ available: true });
    }
    const withoutVerdict = snapshot.turns.filter((turn) => !(turn.id in snapshot.turnRewindability));
    expect(new Set(withoutVerdict.map((turn) =>
      turn.capability ? 'capability' : turn.artifact
    ))).toEqual(new Set([
      'capability',
      'tool_request',
      'session_start',
      'standing_directive_change',
      'excerpt_revision',
      'context_change'
    ]));
  });

  it('disables every verdict while a run is in flight', () => {
    const room = runCanonicalScriptedRoom();
    room.session.beginPersonaMessage('in-flight', 'Still thinking…');

    const verdicts = Object.values(room.session.getSnapshot().turnRewindability);
    expect(verdicts.length).toBeGreaterThan(0);
    expect(new Set(verdicts.map((verdict) => JSON.stringify(verdict))))
      .toEqual(new Set([JSON.stringify({ available: false, reason: 'busy' })]));
  });

  it('marks pre-baseline turns of a reopened legacy session with their reason', () => {
    const room = runCanonicalScriptedRoom();
    const legacy = room.session.exportCommittedState();
    delete legacy.retainedHistoryMarks;
    const reopened = new WorkshopSessionService(() => 9_000);
    const archive = room.archive();
    reopened.hydrateCommittedState(
      legacy,
      Object.fromEntries([['host', 'host-conv'], ['guest:margot', 'guest-conv']]),
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
      Object.fromEntries(archive.map((entry) => [entry.key, {
        messageCount: entry.messages.length,
        contextSourceCount: entry.contextSources.length
      }]))
    );
    const snapshot = reopened.getSnapshot();
    const head = snapshot.turns.at(-1)!;
    const firstHostReply = snapshot.turns.find((turn) => turn.participant === 'host')!;

    expect(snapshot.turnRewindability[head.id]).toEqual({ available: true });
    expect(snapshot.turnRewindability[firstHostReply.id])
      .toEqual({ available: false, reason: 'before-rewind-support' });
  });

  it('publishes verdicts for the snapshot window only', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setSessionScope('open');
    for (let run = 0; run < WORKSHOP_SNAPSHOT_TURN_WINDOW; run += 1) {
      session.beginPersonaMessage(`run-${run}`, `Message ${run}`);
      session.completeRun(`run-${run}`, `Reply ${run}`, undefined, false, 'host-conv');
    }
    const snapshot = session.getSnapshot();
    const windowIds = new Set(snapshot.turns.map((turn) => turn.id));

    expect(snapshot.truncatedTurns).toBeGreaterThan(0);
    expect(Object.keys(snapshot.turnRewindability).every((id) => windowIds.has(id))).toBe(true);
  });

  it('never lets a mark cross into the webview', () => {
    const snapshot = JSON.stringify(runCanonicalScriptedRoom().session.getSnapshot());
    for (const privateField of [
      'retainedHistoryMarks',
      'messageCount',
      'contextSourceCount',
      'writerSourceCount',
      'guest:margot',
      'tool:prose'
    ]) {
      expect(snapshot).not.toContain(privateField);
    }
  });
});

describe('participant state changes only at commits', () => {
  const widgetRoom = () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Set the scene.');
    const session = room.session;
    const config = session.createWidgetConfig({ widgetId: 'gesture-playground', draft: gestureDraft() });
    const artifactId = session.mintWidgetArtifactId();
    const turn = session.beginPersonaMessage('widget-run', 'For “she smiled”…', undefined, {
      widgetId: 'gesture-playground',
      widgetConfigId: config.id,
      rail: 'thread-artifact',
      artifactId,
      selectionCount: 1
    });
    // Exactly what the one-shot commit coordinator does on room acceptance.
    session.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });
    session.recordWidgetArtifactDelivery(artifactId, 'Gesture selection', 42, { kind: 'host' });
    return { session, config, artifactId, turn };
  };

  it('drops the provisional widget manifest row when the run is abandoned', () => {
    const { session, config, artifactId, turn } = widgetRoom();

    session.abandonRun('widget-run');

    const state = session.exportCommittedState();
    expect(state.writerSources.host.some((entry) => entry.artifactId === artifactId)).toBe(false);
    // The writer turn stays visible, so the config keeps its linkage.
    expect(session.getWidgetConfig(config.id)).toMatchObject({ committedTurnId: turn.id, artifactId });
    // The host's latest mark still describes the host exactly at this rest point.
    expect(state.retainedHistoryMarks!.at(-1)!.writerSourceCount).toBe(state.writerSources.host.length);
  });

  it('keeps the widget manifest row when the run commits', () => {
    const { session, artifactId } = widgetRoom();
    session.completeRun('widget-run', 'Took the beat again.', undefined, false, session.getHostConversationId());

    expect(session.exportCommittedState().writerSources.host.some((entry) => entry.artifactId === artifactId))
      .toBe(true);
  });

  it('drops marks for participants that hydration cannot rebind', () => {
    const room = runCanonicalScriptedRoom();
    const state = room.session.exportCommittedState();
    const reopened = new WorkshopSessionService(() => 9_000);

    const hydration = reopened.hydrateCommittedState(
      state,
      { host: 'host-conv' },
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );

    expect(hydration.degradedConversationKeys).toEqual(['guest:margot']);
    expect(new Set(reopened.exportCommittedState().retainedHistoryMarks!.map((mark) => mark.conversationKey)))
      .toEqual(new Set(['host']));
  });
});
