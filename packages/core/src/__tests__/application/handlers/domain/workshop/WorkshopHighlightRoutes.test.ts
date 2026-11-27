import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopHighlightProposal } from '@handlers/domain/workshop/WorkshopHighlightProposal';
import { WorkshopHighlightRestore } from '@handlers/domain/workshop/WorkshopHighlightRestore';
import { WorkshopHighlightHandler } from '@handlers/domain/workshop/WorkshopHighlightHandler';
import { WorkshopOpenRoomInstance } from '@/application/services/workshop/WorkshopOpenRoomInstance';
import type { WorkshopExcerptRereadAuthorization } from '@/application/services/workshop/WorkshopContextIntakeService';
import type { WorkshopHighlightEditor } from '@/application/services/workshop/highlights/WorkshopHighlightEditor';
import { MessageType, type WorkshopHighlightPromptAnswer, type WorkshopTurn, type WorkshopExcerpt } from '@messages';

const SHOW = MessageType.WORKSHOP_SHOW_HIGHLIGHTS;
const CLEAR = MessageType.WORKSHOP_CLEAR_HIGHLIGHTS;
const source = { sourceUri: 'file:///old/chapter.md', relativePath: 'chapter.md' };
const set = { title: 'Signature lines', places: [{ start: { quote: 'Alice' }, note: 'Recurring image.' }] };
const authorized = { kind: 'authorized', fsPath: '/current/chapter.md', source: { kind: 'file', ...source } } as const;
const reply: WorkshopTurn = {
  id: 'turn-2', kind: 'message', role: 'assistant', artifact: 'persona_message', participant: 'host',
  personaLabel: 'Jill', personaId: 'jill', content: 'I marked it.', timestamp: 1, excerptVersion: 1,
  highlights: { source, set }
};

function rig() {
  const tabCloseEvents: string[] = [];
  const disposeCapture = jest.fn();
  const room = new WorkshopOpenRoomInstance(jest.fn());
  const turns = new Map([[reply.id, reply], ['turn-3', { ...reply, id: 'turn-3' }]]);
  let revision = 9;
  const getExcerpt = jest.fn<WorkshopExcerpt | undefined, []>(() => ({ text: 'Alice', pinnedAt: 1, version: 1, source: { kind: 'file', ...source } }));
  const session = {
    getExcerpt, suppressHighlightPrompts: jest.fn(() => true),
    readRoomRevision: () => revision,
    readRoomTurn: (id: string) => turns.get(id),
    readHighlightTurnIds: () => new Set(turns.keys())
  };
  const editor = {
    captureTabClosures: jest.fn(() => {
      const start = tabCloseEvents.length;
      return { current: (fsPath: string) => !tabCloseEvents.includes(fsPath, start), dispose: disposeCapture };
    }),
    clearGeneration: 0, showOpen: jest.fn(), clear: jest.fn(), retain: jest.fn(),
    show: jest.fn<ReturnType<WorkshopHighlightEditor['show']>, Parameters<WorkshopHighlightEditor['show']>>()
      .mockResolvedValue({ placed: 1, dropped: { ambiguous: 0, unanchored: 0, unordered: 0, protected: 0 } })
  };
  const authorizeExcerptReread = jest.fn<Promise<WorkshopExcerptRereadAuthorization>, [typeof authorized.source]>()
    .mockResolvedValue(authorized);
  const status = jest.fn();
  const changed = jest.fn();
  const proposal = new WorkshopHighlightProposal(changed);
  type Opening = NonNullable<ReturnType<import('@/application/services/workshop/WorkshopSessionPersistenceCoordinator').WorkshopSessionPersistenceCoordinator['takeHighlightRestoreOpening']>>;
  const persistence = { takeHighlightRestoreOpening: jest.fn<Opening | undefined, []>(), markDirty: jest.fn() };
  const restore = new WorkshopHighlightRestore(session, persistence,
    { authorizeExcerptReread, toDisplayPath: () => 'chapter.md', workspaceRoots: () => [], openCatalog: jest.fn() }, changed);
  const handler = new WorkshopHighlightHandler(session, { onRoomReplaced: (listener) => room.subscribe(listener) },
    { authorizeExcerptReread }, editor, status, { proposal, restore });
  const router = new MessageRouter();
  handler.registerRoutes(router);
  const send = (type: typeof SHOW | typeof CLEAR, payload = { turnId: reply.id, roomRevision: revision }) =>
    router.route({ type, source: 'webview.workshop', payload, timestamp: 1 });
  const replace = (rewound: boolean) => {
    revision += 1;
    if (rewound) {
      room.rewound();
    } else {
      room.replaced();
    }
  };
  const startOpening = (candidates = [...turns.values()].map(t => ({ turnId: t.id, count: t.highlights!.set.places.length, source: t.highlights!.source }))) => {
    persistence.takeHighlightRestoreOpening.mockReturnValueOnce({ roomRevision: revision, excerptVersion: 1, candidates });
    return handler.highlightPrompt();
  };
  const answer = (payload: WorkshopHighlightPromptAnswer) => router.route({
    type: MessageType.WORKSHOP_ANSWER_HIGHLIGHT_PROMPT, source: 'webview.workshop', payload, timestamp: 1
  });
  return { editor, authorizeExcerptReread, handler, turns, status, send, replace, disposeCapture, tabCloseEvents,
    startOpening, answer, session, changed, persistence, proposal };
}

describe('Workshop highlight gestures and room lifetime', () => {
  it('reauthorizes the retained source on every Show and opens the authorized path', async () => {
    const r = rig();
    await r.send(SHOW);
    await r.send(CLEAR);
    await r.send(SHOW);
    expect(r.authorizeExcerptReread.mock.calls).toEqual([[{ kind: 'file', ...source }], [{ kind: 'file', ...source }]]);
    expect(r.editor.show).toHaveBeenCalledTimes(2);
    expect(r.editor.show).toHaveBeenLastCalledWith(reply.id, authorized.fsPath, 'Jill', set, expect.any(Function));
    expect(r.editor.clear.mock.calls).toEqual([[reply.id]]);
  });

  it('ignores stale identities and injected fields; a refused read never opens a file', async () => {
    const r = rig();
    await r.send(SHOW, { turnId: reply.id, roomRevision: 8 });
    await r.send(SHOW, { turnId: 'unknown', roomRevision: 9 });
    const injected = { turnId: reply.id, roomRevision: 9, fsPath: '/elsewhere' };
    await r.send(SHOW, injected);
    await r.send(CLEAR, injected);
    r.authorizeExcerptReread.mockResolvedValueOnce({ kind: 'refused', message: 'private' });
    await r.send(SHOW);
    expect(r.authorizeExcerptReread).toHaveBeenCalledTimes(1);
    expect(r.editor.show).not.toHaveBeenCalled();
    expect(r.editor.clear).not.toHaveBeenCalled();
    expect(r.status.mock.calls.flat().join(' ')).not.toMatch(/private|chapter/);
    expect(r.disposeCapture).toHaveBeenCalledTimes(1);
  });

  it.each(['clear', 'clear all', 'rewind', 'remove', 'reopen', 'dispose'] as const)('%s supersedes a pending authorization', async (event) => {
    const r = rig();
    let resolve!: (answer: WorkshopExcerptRereadAuthorization) => void;
    r.authorizeExcerptReread.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const pending = r.send(SHOW);
    switch (event) {
      case 'clear': await r.send(CLEAR); break;
      case 'clear all': r.editor.clearGeneration++; break;
      case 'remove': r.turns.delete(reply.id); break;
      case 'rewind': r.turns.delete(reply.id); r.replace(true); break;
      case 'reopen': r.replace(false); break;
      case 'dispose': r.handler.dispose(); break;
    }
    resolve(authorized);
    await pending;
    expect(r.editor.show).not.toHaveBeenCalled();
    expect(r.status).not.toHaveBeenCalled();
  });

  it('honors the last tab close during authorization, including when the saved source moved', async () => {
    const r = rig();
    let authorize!: (answer: WorkshopExcerptRereadAuthorization) => void;
    r.authorizeExcerptReread.mockImplementationOnce(() => new Promise((done) => { authorize = done; }));
    const pending = r.send(SHOW);
    expect(r.editor.captureTabClosures).toHaveBeenCalledTimes(1);
    // The current host resolves /current/chapter.md, although the saved URI names /old/chapter.md.
    r.tabCloseEvents.push(authorized.fsPath);
    authorize(authorized);
    await pending;
    expect(r.editor.show).not.toHaveBeenCalled();
    expect(r.status).not.toHaveBeenCalled();
    expect(r.disposeCapture).toHaveBeenCalledTimes(1);

    // A later explicit Show can open the source even though it started closed.
    await r.send(SHOW);
    expect(r.editor.show).toHaveBeenCalledTimes(1);
    expect(r.disposeCapture).toHaveBeenCalledTimes(2);
  });

  it('keeps monitoring the authorized path through Show and ignores unrelated tab closes', async () => {
    const r = rig();
    r.editor.show.mockImplementationOnce(async (_id, fsPath, _persona, _set, current) => {
      r.tabCloseEvents.push('/other.md');
      expect(current()).toBe(true);
      r.tabCloseEvents.push(fsPath);
      expect(current()).toBe(false);
      return undefined;
    });
    await r.send(SHOW);
    expect(r.status).not.toHaveBeenCalled();
    expect(r.disposeCapture).toHaveBeenCalledTimes(1);
  });

  it('checks membership again after opening, and withdraws only removed sets on rewind', async () => {
    const r = rig();
    r.editor.show.mockImplementationOnce(async (_id, _path, _persona, _set, current) => {
      expect(current()).toBe(true);
      r.turns.delete(reply.id);
      r.replace(true);
      expect(current()).toBe(false);
      return undefined;
    });
    await r.send(SHOW);
    expect(r.status).not.toHaveBeenCalled();
    expect(r.editor.retain.mock.calls).toEqual([[new Set(['turn-3'])]]);
    // Loading another room with the same IDs withdraws every drawing from the previous room.
    r.replace(false);
    expect(r.editor.retain).toHaveBeenLastCalledWith(new Set());
    r.handler.dispose();
    expect(r.editor.retain.mock.calls).toHaveLength(3);
    r.replace(true);
    expect(r.editor.retain.mock.calls).toHaveLength(3);
  });
});

describe('The restore offer belongs to the room opening', () => {
  const tick = () => new Promise<void>(resolve => setImmediate(resolve));
  const currentPrompt = (r: ReturnType<typeof rig>) => {
    const prompt = r.handler.highlightPrompt();
    if (prompt?.kind !== 'restore') { throw new Error('Expected restore prompt'); }
    return prompt;
  };

  it('matches moved source identities in ledger order, ignores unavailable/other files and replays the same offer', async () => {
    const r = rig();
    r.authorizeExcerptReread.mockImplementation(async ref => {
      if (ref.relativePath === 'unavailable') { throw new Error('missing file'); }
      return ref.relativePath === 'other' ? { ...authorized, fsPath: '/chapter-2.md' } : authorized;
    });
    const saved = (turnId: string, uri: string, relativePath = 'chapter.md') => ({ turnId, source: { sourceUri: uri, relativePath }, count: 1 });
    r.startOpening([saved(reply.id,source.sourceUri), saved('not-matched','file:///other','other'),
      saved('missing','file:///missing','unavailable'), saved('turn-3','file:///older/chapter.md')]);
    await tick();
    const prompt = currentPrompt(r);
    expect(prompt).toEqual({ promptId: expect.any(String), roomRevision: 9, displayPath: 'chapter.md', kind: 'restore', count: 2, setCount: 2 });
    expect(r.handler.highlightPrompt()).toEqual(prompt);
    expect(r.editor.show).not.toHaveBeenCalled();
    await r.answer({ promptId: prompt.promptId, roomRevision: 9, choice: 'suppress' });
    expect(r.session.suppressHighlightPrompts).toHaveBeenCalledWith(9, [reply.id, 'turn-3']);
    expect(r.persistence.markDirty).toHaveBeenCalledTimes(1);
    expect(r.handler.highlightPrompt()).toBeUndefined();
    await r.answer({ promptId: prompt.promptId, roomRevision: 9, choice: 'restore' });
    expect(r.editor.show).not.toHaveBeenCalled();
    await r.send(SHOW);
    expect(r.editor.show).toHaveBeenCalledTimes(1);
  });

  it('waits behind a real proposal; Not now is transient and a fresh opening rejects the prior answer', async () => {
    const r = rig();
    r.startOpening(); await tick();
    const restore = currentPrompt(r);
    const decision = r.proposal.ask({ persona: 'Jill', title: 'New set', count: 1, roomRevision: 9, displayPath: 'chapter.md' }, new AbortController().signal);
    const proposal = r.handler.highlightPrompt()!;
    expect(proposal.kind).toBe('proposal');
    await r.answer({ ...restore, choice: 'restore' }); // Extra fields are never accepted.
    await r.answer({ promptId: 'unrelated', roomRevision: 9, choice: 'restore' });
    expect(r.editor.show).not.toHaveBeenCalled();
    await r.answer({ promptId: proposal.promptId, roomRevision: 9, choice: 'skip' });
    expect(await decision).toBe(false);
    expect(currentPrompt(r).promptId).toBe(restore.promptId);
    await r.answer({ promptId: restore.promptId, roomRevision: 9, choice: 'not-now' });
    expect(r.handler.highlightPrompt()).toBeUndefined();
    expect(r.persistence.markDirty).not.toHaveBeenCalled();
    r.replace(false); r.startOpening(); await tick();
    const reopened = currentPrompt(r);
    expect(reopened.promptId).not.toBe(restore.promptId);
    await r.answer({ promptId: restore.promptId, roomRevision: reopened.roomRevision, choice: 'restore' });
    expect(currentPrompt(r).promptId).toBe(reopened.promptId);
  });

  it('accepts a restore answer already in flight when a new proposal takes the screen', async () => {
    const r = rig(); r.startOpening(); await tick();
    const { promptId, roomRevision } = currentPrompt(r);
    const decision = r.proposal.ask({ persona: 'Jill', title: 'New set', count: 1, roomRevision, displayPath: 'chapter.md' }, new AbortController().signal);
    const proposal = r.handler.highlightPrompt()!;
    await r.answer({ promptId, roomRevision, choice: 'restore' });
    expect(r.editor.show).toHaveBeenCalledTimes(2);
    expect(r.handler.highlightPrompt()).toEqual(proposal);
    await r.answer({ promptId: proposal.promptId, roomRevision, choice: 'apply' });
    expect(await decision).toBe(true);
    expect(r.handler.highlightPrompt()).toBeUndefined();
  });

  it('draws each offered turn only after fresh source checks and cancels a set cleared before its turn', async () => {
    const r = rig();
    r.startOpening(); await tick();
    const { promptId, roomRevision } = currentPrompt(r);
    let grant!: (value: typeof authorized) => void;
    r.authorizeExcerptReread.mockImplementationOnce(() => new Promise(done => { grant = done; }));
    const work = r.answer({ promptId, roomRevision, choice: 'restore' });
    await r.send(CLEAR, { roomRevision, turnId: 'turn-3' });
    grant(authorized); await work;
    expect(r.editor.show).toHaveBeenCalledTimes(1);
    expect(r.editor.show).toHaveBeenCalledWith(reply.id, authorized.fsPath, 'Jill', set, expect.any(Function));
    expect(r.status).toHaveBeenCalledWith('Shown 1 highlight.');
    expect(r.handler.highlightPrompt()).toBeUndefined();
  });

  it.each(['close', 'clear-all', 'room', 'excerpt', 'redirect'] as const)('cannot redraw after %s during the fresh excerpt authorization', async event => {
    const r = rig(); r.startOpening(); await tick();
    const { promptId, roomRevision } = currentPrompt(r);
    let grant!: (value: typeof authorized | { kind: 'authorized'; fsPath: string; source: typeof authorized.source }) => void;
    r.authorizeExcerptReread.mockImplementationOnce(() => new Promise(done => { grant = done; }));
    const work = r.answer({ promptId, roomRevision, choice: 'restore' });
    if (event === 'close') { r.tabCloseEvents.push(authorized.fsPath); }
    if (event === 'clear-all') { r.editor.clearGeneration++; }
    if (event === 'room') { r.replace(true); }
    if (event === 'excerpt') { r.session.getExcerpt.mockReturnValue(undefined); }
    grant({ ...authorized, fsPath: event === 'redirect' ? '/other.md' : authorized.fsPath });
    await work;
    expect(r.editor.show).not.toHaveBeenCalled();
    expect(r.disposeCapture).toHaveBeenCalled();
  });

  it('does not create a question for a pasted excerpt, empty candidates, or a disposed pending check', async () => {
    const r = rig();
    r.startOpening([]); await tick();
    expect(r.authorizeExcerptReread).not.toHaveBeenCalled();
    r.session.getExcerpt.mockReturnValueOnce({ text: 'pasted', version: 1, pinnedAt: 0, source: { kind: 'manual' } });
    r.startOpening(); await tick();
    expect(r.handler.highlightPrompt()).toBeUndefined();
    let grant!: (value: typeof authorized) => void;
    r.authorizeExcerptReread.mockImplementationOnce(() => new Promise(done => { grant = done; }));
    r.startOpening(); r.handler.dispose(); grant(authorized); await tick();
    expect(r.handler.highlightPrompt()).toBeUndefined();
    expect(r.changed).not.toHaveBeenCalled();
  });
});
