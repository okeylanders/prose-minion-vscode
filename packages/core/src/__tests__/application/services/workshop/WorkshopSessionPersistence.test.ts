import {
  parseWorkshopSessionStateV1,
  WorkshopSessionActiveRunPersistenceError,
  WorkshopSessionService,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopConversationBehavior } from '@messages';

const currentBehavior: WorkshopConversationBehavior = {
  interactionMode: 'conversational',
  expressionLevel: 'subtle',
  relationalDepth: 'reserved',
  carryCuesThroughSession: false
};

const buildCompleteState = (): WorkshopSessionStateV1 => {
  let now = 1_000;
  const session = new WorkshopSessionService(() => ++now);
  session.setExcerpt({
    text: 'The first cup waits.',
    source: {
      kind: 'file',
      sourceUri: 'file:///workspace/chapters/one.md',
      relativePath: 'chapters/one.md',
      configuredResource: { group: 'chapters', path: 'chapters/one.md' }
    },
    sourceFingerprint: 'sha256:first',
    truncation: { pinnedWords: 4, totalWords: 40 }
  });
  session.recordSessionMarker('start', 'Session started at 10:00 AM.');
  session.beginPersonaMessage('host-open', 'Begin.');
  session.completeRun('host-open', 'I am here.', undefined, false, 'host-runtime-before-save');

  session.replaceExcerpt({
    text: 'The second cup breaks.',
    source: {
      kind: 'editor-selection',
      sourceUri: 'file:///workspace/chapters/two.md',
      relativePath: 'chapters/two.md',
      startLine: 10,
      endLine: 12
    },
    sourceFingerprint: 'sha256:second'
  });

  session.addContextAttachment({
    kind: 'file',
    origin: 'writer',
    label: 'raven.md',
    words: 4,
    content: 'Raven remembers the cup.',
    sourceUri: 'file:///workspace/Characters/raven.md',
    relativePath: 'Characters/raven.md',
    configuredResource: { group: 'characters', path: 'Characters/raven.md' },
    truncation: { keptWords: 4, totalWords: 80 }
  });
  session.addContextAttachment({
    kind: 'text',
    origin: 'wizard',
    label: 'Continuity note…',
    words: 3,
    content: 'The cup was blue.'
  });
  session.removeContextAttachment('ctx-1');

  session.addMessageAttachment({
    label: 'discarded.md',
    words: 1,
    content: 'Discarded.',
    sourceUri: 'file:///workspace/discarded.md',
    relativePath: 'discarded.md'
  });
  session.removeMessageAttachment('ta-1');
  session.addMessageAttachment({
    label: 'pending.md',
    words: 3,
    content: 'Pending exact content.',
    sourceUri: 'file:///workspace/pending.md',
    relativePath: 'pending.md',
    truncation: { keptWords: 3, totalWords: 9 }
  });

  session.beginToolRun('prose', 'prose-report');
  const report = session.completeToolReport(
    'prose-report',
    '1. Tighten the second sentence.',
    'tool-runtime-before-save',
    undefined,
    false,
    [{ key: 'finding-1', text: 'Tighten the second sentence.', ordinal: 1, priority: 'high' }]
  )!.turn;
  session.addTodoFromFinding(report.id, 'finding-1');
  session.adoptPersonaGuest('margot', 'guest-runtime-before-save');
  session.setChatTarget({ kind: 'personaGuest', personaId: 'margot' });
  session.beginPersonaGuestMessage('margot', 'guest-message', 'How does the voice sound?');
  session.completeRun('guest-message', 'Close and controlled.');
  session.recordSessionMarker('resume', 'Session resumed at 11:30 AM.');

  return session.exportCommittedState();
};

describe('WorkshopSessionService committed persistence', () => {
  it('preflights a valid exported state into a deep defensive clone', () => {
    const state = buildCompleteState();
    const raw: unknown = JSON.parse(JSON.stringify(state));
    const parsed = parseWorkshopSessionStateV1(raw);

    expect(parsed).toEqual(state);
    parsed.excerpt!.text = 'Mutated parsed state.';
    parsed.turns[0].content = 'Mutated parsed turn.';
    parsed.writerSources.host[0].label = 'Mutated parsed source.';
    expect(state.excerpt!.text).toBe('The second cup breaks.');
    expect(state.turns[0].content).not.toBe('Mutated parsed turn.');
    expect(state.writerSources.host[0].label).not.toBe('Mutated parsed source.');
  });

  it.each([
    {
      label: 'a nested collection is not an array',
      mutate: (value: unknown) => {
        (value as { contextAttachments: unknown }).contextAttachments = {};
      },
      message: 'contextAttachments must be array'
    },
    {
      label: 'a nested discriminated union has an unknown variant',
      mutate: (value: unknown) => {
        (value as { excerpt: { source: { kind: unknown } } }).excerpt.source.kind = 'cloud';
      },
      message: 'source.kind must be manual, file, or editor-selection'
    },
    {
      label: 'a counter has the wrong primitive shape',
      mutate: (value: unknown) => {
        (value as { counters: { turn: unknown } }).counters.turn = 'twelve';
      },
      message: 'counters.turn must be finite number'
    },
    {
      label: 'a nested array field has the wrong shape',
      mutate: (value: unknown) => {
        const report = (value as { turns: Array<{ actionableFindings?: unknown }> }).turns
          .find((turn) => turn.actionableFindings !== undefined)!;
        report.actionableFindings = {};
      },
      message: 'actionableFindings must be array'
    },
    {
      label: 'a participant union contains an invalid liveness value',
      mutate: (value: unknown) => {
        (value as { participants: { personaGuests: Array<{ liveness: unknown }> } })
          .participants.personaGuests[0].liveness = 'sleeping';
      },
      message: 'liveness must be live | disposed'
    },
    {
      label: 'a nested object carries an unknown extension field',
      mutate: (value: unknown) => {
        (
          value as {
            contextAttachments: Array<Record<string, unknown>>;
          }
        ).contextAttachments[0].futureBag = {};
      },
      message: 'contains unknown field futureBag'
    },
    {
      label: 'a structurally valid counter trails a minted id',
      mutate: (value: unknown) => {
        (value as { counters: { turn: number } }).counters.turn = 0;
      },
      message: 'turn counter trails'
    }
  ])('rejects raw state when $label', ({ mutate, message }) => {
    const value: unknown = buildCompleteState();
    mutate(value);
    expect(() => parseWorkshopSessionStateV1(value)).toThrow(message);
  });

  it('rejects unknown top-level extension bags', () => {
    const value = buildCompleteState() as unknown as Record<string, unknown>;
    value.extensions = { someday: true };
    expect(() => parseWorkshopSessionStateV1(value))
      .toThrow('contains unknown field extensions');
  });

  it('round-trips the full host-private aggregate and injects current global behavior', () => {
    const state = buildCompleteState();
    expect(state.contextAttachments[0]).toMatchObject({
      id: 'ctx-2',
      content: 'The cup was blue.'
    });
    expect(state.pendingMessageAttachments[0]).toMatchObject({
      id: 'ta-2',
      content: 'Pending exact content.',
      sourceUri: 'file:///workspace/pending.md'
    });
    expect(state.excerpt).toMatchObject({
      sourceFingerprint: 'sha256:second',
      source: {
        kind: 'editor-selection',
        sourceUri: 'file:///workspace/chapters/two.md'
      }
    });
    expect(state.revisions).toMatchObject({
      excerpt: 2,
      pendingExcerpt: 2,
      pendingContext: 3
    });
    expect(state.participants).toMatchObject({
      host: { personaId: 'jill', conversationKey: 'host' },
      toolSidecars: [{
        toolId: 'prose',
        conversationKey: 'tool:prose'
      }],
      personaGuests: [{
        personaId: 'margot',
        conversationKey: 'guest:margot',
        liveness: 'live'
      }],
      chatTarget: { kind: 'personaGuest', personaId: 'margot' }
    });
    expect(state.turns.map((turn) => turn.artifact)).toEqual(expect.arrayContaining([
      'session_start',
      'session_resume',
      'excerpt_revision',
      'context_change',
      'tool_report',
      'persona_message'
    ]));
    expect(JSON.stringify(state)).not.toContain('runtime-before-save');

    const restored = new WorkshopSessionService(() => 50_000);
    const result = restored.hydrateCommittedState(
      state,
      {
        host: 'host-runtime-after-open',
        ['tool:prose']: 'tool-runtime-after-open',
        ['guest:margot']: 'guest-runtime-after-open'
      },
      currentBehavior
    );

    expect(result).toEqual({
      discardedConversationIds: [],
      degradedConversationKeys: []
    });
    expect(restored.getHostConversationId()).toBe('host-runtime-after-open');
    expect(restored.getToolSidecarConversationId('prose')).toBe('tool-runtime-after-open');
    expect(restored.getPersonaGuestConversationId('margot')).toBe('guest-runtime-after-open');
    expect(restored.getConversationBehavior()).toEqual(currentBehavior);
    expect(restored.exportCommittedState()).toEqual({
      ...state,
      // Current global behavior is deliberately absent from the durable state,
      // so exporting after hydrate reproduces the same product checkpoint.
      lastCommittedPersonaBehavior: state.lastCommittedPersonaBehavior
    });

    // activeHostPin must point into the restored host manifest, not a detached
    // clone: committing the pending pin stales the old row in place.
    restored.commitPendingHostUpdates(restored.collectPendingHostUpdates()!);
    expect(restored.collectWriterSources({ kind: 'host' }).filter((source) => source.kind === 'pin'))
      .toEqual([
        expect.objectContaining({ excerptVersion: 1, stale: true }),
        expect.objectContaining({ excerptVersion: 2 })
      ]);

    expect(restored.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: 'Next…',
      words: 1,
      content: 'Next.'
    })).toMatchObject({ ok: true, attachment: { id: 'ctx-3' } });
    expect(restored.addMessageAttachment({
      label: 'next.md',
      words: 1,
      content: 'Next.',
      relativePath: 'next.md'
    })).toMatchObject({ ok: true, attachment: { id: 'ta-3' } });
  });

  it('exports defensively and hydrates from defensive clones', () => {
    const source = buildCompleteState();
    const originalText = source.excerpt!.text;
    source.excerpt!.text = 'Mutated exported state.';
    source.writerSources.host[0].label = 'Mutated manifest.';

    const fresh = buildCompleteState();
    expect(fresh.excerpt!.text).toBe(originalText);
    expect(fresh.writerSources.host[0].label).not.toBe('Mutated manifest.');

    const restored = new WorkshopSessionService(() => 9);
    restored.hydrateCommittedState(
      fresh,
      {
        host: 'host-new',
        ['tool:prose']: 'tool-new',
        ['guest:margot']: 'guest-new'
      },
      currentBehavior
    );
    fresh.excerpt!.text = 'Mutated after hydrate.';
    fresh.contextAttachments[0].content = 'Mutated context.';
    fresh.turns[0].content = 'Mutated turn.';
    fresh.todos[0].source.findingText = 'Mutated task source.';

    const roundTrip = restored.exportCommittedState();
    expect(roundTrip.excerpt!.text).toBe(originalText);
    expect(roundTrip.contextAttachments[0].content).toBe('The cup was blue.');
    expect(roundTrip.turns[0].content).not.toBe('Mutated turn.');
    expect(roundTrip.todos[0].source.findingText).toBe('Tighten the second sentence.');
  });

  it('refuses an active run rather than exporting mismatched product and provider state', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Pinned.', source: { kind: 'manual' } });
    session.beginPersonaMessage('active', 'This provider turn has not committed.');

    expect(() => session.exportCommittedState())
      .toThrow(WorkshopSessionActiveRunPersistenceError);
  });

  it('degrades missing or duplicate bindings per participant and repairs the target', () => {
    const state = buildCompleteState();
    state.participants.chatTarget = { kind: 'tool', toolId: 'prose' };
    const restored = new WorkshopSessionService(() => 1);

    const result = restored.hydrateCommittedState(
      state,
      {
        // Duplicate runtime ids are not a valid logical remap; both
        // participants fail closed. The guest binding is missing outright.
        host: 'duplicate-runtime',
        ['tool:prose']: 'duplicate-runtime'
      },
      currentBehavior
    );

    expect(result.degradedConversationKeys).toEqual([
      'host',
      'tool:prose',
      'guest:margot'
    ]);
    expect(restored.getHostConversationId()).toBeUndefined();
    expect(restored.getToolSidecarConversationId('prose')).toBeUndefined();
    expect(restored.getPersonaGuestConversationId('margot')).toBeUndefined();
    expect(restored.getChatTarget()).toEqual({ kind: 'host' });
    expect(restored.getSnapshot().pendingHostUpdate).toBeUndefined();
    expect(restored.getSnapshot().participants.personaGuests).toEqual([
      expect.objectContaining({ personaId: 'margot', liveness: 'disposed', hasConversation: false })
    ]);
    expect(restored.collectWriterSources({ kind: 'host' })).toEqual([
      // Standing context is derived live even before a fresh host exists.
      expect.objectContaining({ kind: 'attachment', label: 'Continuity note…' })
    ]);
    expect(restored.collectWriterSources({ kind: 'tool', toolId: 'prose' })).toEqual([]);
    expect(restored.collectWriterSources({ kind: 'personaGuest', personaId: 'margot' })).toEqual([]);
  });

  it('validates completely before replacing the live aggregate', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Live state.', source: { kind: 'manual' } });
    session.recordSessionMarker('start', 'Live marker.');
    const before = session.exportCommittedState();
    const invalid = buildCompleteState();
    invalid.counters.turn = 0;

    expect(() => session.hydrateCommittedState(invalid, {}, currentBehavior))
      .toThrow('turn counter trails');
    expect(session.exportCommittedState()).toEqual(before);
  });

  it('preserves skipped monotonic counters instead of inferring them from surviving rows', () => {
    const state = buildCompleteState();
    state.counters = {
      attachment: 41,
      threadArtifact: 70,
      turn: 50,
      todo: 60
    };
    const report = state.turns.find((turn) => turn.artifact === 'tool_report')!;
    report.actionableFindings!.push({
      key: 'finding-2',
      text: 'Keep the cup visible.',
      ordinal: 2,
      priority: 'medium'
    });
    const restored = new WorkshopSessionService(() => 80_000);
    restored.hydrateCommittedState(
      state,
      {
        host: 'host-new',
        ['tool:prose']: 'tool-new',
        ['guest:margot']: 'guest-new'
      },
      currentBehavior
    );

    expect(restored.recordSessionMarker('resume', 'Later.').id)
      .toMatch(/^turn-51-system-/);
    expect(restored.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: 'Counter…',
      words: 1,
      content: 'Counter.'
    })).toMatchObject({ ok: true, attachment: { id: 'ctx-42' } });
    expect(restored.addMessageAttachment({
      label: 'counter.md',
      words: 1,
      content: 'Counter.',
      relativePath: 'counter.md'
    })).toMatchObject({ ok: true, attachment: { id: 'ta-71' } });
    expect(restored.addTodoFromFinding(report.id, 'finding-2').id)
      .toMatch(/^todo-61-/);
  });

  it('exports and restores the full ledger even when the webview projection is windowed', () => {
    const session = new WorkshopSessionService(() => 1);
    for (let index = 0; index < 105; index += 1) {
      session.recordSessionMarker(index === 0 ? 'start' : 'resume', `Marker ${index}.`);
    }

    expect(session.getSnapshot().turns).toHaveLength(100);
    const state = session.exportCommittedState();
    expect(state.turns).toHaveLength(105);
    const restored = new WorkshopSessionService(() => 2);
    restored.hydrateCommittedState(state, {}, currentBehavior);
    expect(restored.exportCommittedState().turns).toHaveLength(105);
    expect(restored.exportCommittedState().turns[0].content).toBe('Marker 0.');
  });

  it('rejects blank markers and persists deterministic start/resume dividers', () => {
    let now = 10;
    const session = new WorkshopSessionService(() => ++now);
    expect(() => session.recordSessionMarker('start', '  ')).toThrow('cannot be blank');

    const start = session.recordSessionMarker('start', 'Started.');
    const resume = session.recordSessionMarker('resume', 'Resumed.');
    expect([start, resume]).toEqual([
      expect.objectContaining({
        id: 'turn-1-system-11',
        kind: 'divider',
        participant: 'session',
        artifact: 'session_start',
        content: 'Started.',
        timestamp: 12
      }),
      expect.objectContaining({
        id: 'turn-2-system-13',
        kind: 'divider',
        participant: 'session',
        artifact: 'session_resume',
        content: 'Resumed.',
        timestamp: 14
      })
    ]);
    expect(session.exportCommittedState().turns).toEqual([start, resume]);
  });
});
