import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopHighlightHandler } from '@handlers/domain/workshop/WorkshopHighlightHandler';
import { WorkshopOpenRoomInstance } from '@/application/services/workshop/WorkshopOpenRoomInstance';
import type { WorkshopExcerptRereadAuthorization } from '@/application/services/workshop/WorkshopContextIntakeService';
import type { WorkshopHighlightEditor } from '@/application/services/workshop/highlights/WorkshopHighlightEditor';
import { MessageType, type WorkshopTurn } from '@messages';

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
  const room = new WorkshopOpenRoomInstance(jest.fn());
  const turns = new Map([[reply.id, reply], ['turn-3', { ...reply, id: 'turn-3' }]]);
  let revision = 9;
  const session = {
    readRoomRevision: () => revision,
    readRoomTurn: (id: string) => turns.get(id),
    readHighlightTurnIds: () => new Set(turns.keys())
  };
  const editor = {
    clearGeneration: 0, showOpen: jest.fn(), clear: jest.fn(), retain: jest.fn(),
    show: jest.fn<ReturnType<WorkshopHighlightEditor['show']>, Parameters<WorkshopHighlightEditor['show']>>()
      .mockResolvedValue({ placed: 1, dropped: { ambiguous: 0, unanchored: 0, unordered: 0, protected: 0 } })
  };
  const authorizeExcerptReread = jest.fn<Promise<WorkshopExcerptRereadAuthorization>, [typeof authorized.source]>()
    .mockResolvedValue(authorized);
  const status = jest.fn();
  const handler = new WorkshopHighlightHandler(session, { onRoomReplaced: (listener) => room.subscribe(listener) },
    { authorizeExcerptReread }, editor, status);
  const router = new MessageRouter();
  handler.registerRoutes(router);
  const send = (type: typeof SHOW | typeof CLEAR, payload = { turnId: reply.id, roomRevision: revision }) =>
    router.route({ type, source: 'webview.workshop', payload, timestamp: 1 });
  const replace = (rewound: boolean) => {
    revision += 1;
    if (rewound) room.rewound(); else room.replaced();
  };
  return { editor, authorizeExcerptReread, handler, turns, status, send, replace };
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
