import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import { hasSameWorkshopRecoveryContent } from '@/application/services/workshop/WorkshopSessionRecoveryEquality';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const routingKey = '3b38f9b1-0adc-4a2a-9aba-a30000000001';
const model = 'anthropic/claude-sonnet';

describe('durable Workshop archive cache metadata', () => {
  it('rehydrates authentic pre-key host and guest histories with independent keys and no spurious unsaved work', async () => {
    const raw = JSON.parse(readFileSync(path.resolve(__dirname,
      '../../../../fixtures/workshop-session-v2-before-context-tally.json'), 'utf8'));
    const { session: legacy } = decodeWorkshopPersistedSessionCheckpoint(raw);
    expect(legacy.conversations.map(entry => entry.key)).toEqual(['host', 'guest:margot']);
    expect(legacy.conversations.every(entry => entry.routingKey === undefined)).toBe(true);
    const { store, coordinator } = setupCoordinator();
    await store.saveNamed(legacy);
    await coordinator.initialize();
    await coordinator.openNamed(legacy.sessionId);
    expect(await coordinator.unsavedRoomStatus()).toBe('saved');
    const refreshed = await coordinator.saveNamed('Resaved');
    const saved = (await store.readNamed(refreshed.sessionId))!;
    expect(saved.conversations.map(entry => entry.messages)).toEqual(legacy.conversations.map(entry => entry.messages));
    expect(new Set(saved.conversations.map(entry => entry.routingKey)).size).toBe(2);
    expect(saved.conversations.every(entry => entry.routingKey?.length === 36)).toBe(true);
    const reexported = { ...legacy, conversations: saved.conversations };
    expect(hasSameWorkshopRecoveryContent(legacy, reexported)).toBe(true);
    expect(hasSameWorkshopCheckpoint(legacy, reexported)).toBe(false);
    const edited = { ...reexported, conversations: reexported.conversations.map(entry => ({
      ...entry, messages: entry.messages.map((msg, index) => index ? msg : { ...msg, content: msg.content + 'An edit.' })
    })) };
    expect(hasSameWorkshopRecoveryContent(legacy, edited)).toBe(false);
  });

  it.each(['rewind', 'branch'] as const)('keeps the key and clock on the retained prefix after %s', async action => {
    const scripted = new ScriptedWorkshopRoom().start();
    const first = scripted.hostMessage('Who folded the map?');
    scripted.hostMessage('Where did they go?');
    const original = scriptedCheckpoint('source', scripted);
    const clock = { estimatedCacheExpiresAt: Date.now() + 60_000, cacheRequestModelId: model };
    Object.assign(original.conversations[0], { routingKey, ...clock });
    const source = setupCoordinator();
    const { session, store, coordinator } = source;
    let destination = source;
    await store.saveNamed(original);
    await coordinator.initialize();
    await coordinator.openNamed('source');
    const oldRuntimeId = session.getHostConversationId();
    const cut = { kind: 'afterTurn' as const, turnId: first.id };
    if (action === 'branch') {
      const result = await coordinator.branchFrom(cut);
      expect((await store.readNamed(result.branch.sessionId))!.conversations[0]).toMatchObject({ routingKey, ...clock });
      expect((await store.readNamed('source'))!.conversations[0].messages).toHaveLength(4);
      expect(session.getHostConversationId()).toBe(oldRuntimeId);
      destination = setupCoordinator({ fileSystem: source.fs, roomId: '733461ab-3483-4b3b-976f-a12345678901' });
      await destination.coordinator.initialize();
      await destination.coordinator.openNamed(result.branch.sessionId);
    } else {
      await coordinator.rewindTo(cut, { origin: 'writer' });
      expect((await store.readNamed('source'))!.conversations[0]).toMatchObject({ routingKey, ...clock });
    }
    const restored = destination.session.getHostConversationId()!;
    expect(restored).not.toBe(oldRuntimeId);
    const [kept] = destination.manager.exportConversations([{ conversationId: restored, key: 'host' }]);
    expect(kept).toMatchObject({ routingKey, ...clock, messages: original.conversations[0].messages.slice(0, 2) });
  });

  it('retains an expired timestamp on disk for exact compare while dropping it from the restored countdown', async () => {
    const scripted = new ScriptedWorkshopRoom().start();
    scripted.hostMessage('Where is the workshop?');
    const original = scriptedCheckpoint('expired', scripted);
    Object.assign(original.conversations[0], { routingKey, estimatedCacheExpiresAt: 1, cacheRequestModelId: model });
    const { manager, session, store, coordinator } = setupCoordinator();
    await store.saveNamed(original);
    const persisted = (await store.readNamed('expired'))!;
    expect(persisted.conversations[0].estimatedCacheExpiresAt).toBe(1);
    await coordinator.initialize();
    await coordinator.openNamed('expired');
    const [restored] = manager.exportConversations([{ conversationId: session.getHostConversationId()!, key: 'host' }]);
    expect(restored.routingKey).toBe(routingKey);
    expect(restored).not.toHaveProperty('estimatedCacheExpiresAt');
    expect(restored).not.toHaveProperty('cacheRequestModelId');
    expect(await coordinator.unsavedRoomStatus()).toBe('saved');
  });

  it('does not let content equivalence authorize overwriting a newer named checkpoint', async () => {
    const scripted = new ScriptedWorkshopRoom().start();
    scripted.hostMessage('Keep this line.');
    const original = scriptedCheckpoint('contended', scripted);
    const { store } = setupCoordinator();
    await store.saveNamed(original);
    const fromOtherWindow = { ...original, conversations: original.conversations.map(entry => ({ ...entry,
      routingKey, estimatedCacheExpiresAt: 1_000, cacheRequestModelId: model
    })) };
    await store.updateNamed(original.sessionId, fromOtherWindow, original);
    expect(hasSameWorkshopRecoveryContent(original, fromOtherWindow)).toBe(true);
    await expect(store.updateNamed(original.sessionId, { ...original, title: 'Late update' }, original)).rejects.toThrow();
    expect((await store.readNamed(original.sessionId))!.conversations[0].routingKey).toBe(routingKey);
  });

  it('retains history while dropping malformed hints, and rejects invalid new writes without echoing private values', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Which gate is open?');
    const valid = scriptedCheckpoint('validated', room);
    const [entry] = valid.conversations;
    const clock = { estimatedCacheExpiresAt: 1_000, cacheRequestModelId: model };
    for (const [bad, remaining] of [
      [{ routingKey: 'writer-controlled/private-path', ...clock }, {}],
      [{ routingKey: undefined, ...clock }, {}],
      [{ routingKey, estimatedCacheExpiresAt: 1_000 }, { routingKey }],
      [{ routingKey, ...clock, cacheRequestModelId: ['invalid'] }, { routingKey }]
    ] as const) {
      const raw = { ...valid, conversations: [{ ...entry, ...bad }] };
      const [read] = decodeWorkshopPersistedSessionCheckpoint(raw).session.conversations;
      const { routingKey: parsedKey, estimatedCacheExpiresAt, cacheRequestModelId } = read;
      expect(JSON.parse(JSON.stringify({ routingKey: parsedKey, estimatedCacheExpiresAt, cacheRequestModelId }))).toEqual(remaining);
      expect(read.messages).toEqual(entry.messages);
      expect(() => parseWorkshopPersistedSession(raw)).toThrow('Invalid conversation cache metadata in Workshop checkpoint.');
    }
  });

  it('keeps archive-only history searchable while private routing hints and timing never match', async () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('A weathered key lay on the sill.');
    const saved = scriptedCheckpoint('search', room);
    const clock = { estimatedCacheExpiresAt: 4037777820000, cacheRequestModelId: 'private/cache-model-sentinel' };
    Object.assign(saved.conversations[0], { routingKey, ...clock });
    saved.conversations[0].messages[0].content += ' Hidden history sentinel.';
    const { store } = setupCoordinator();
    await store.saveNamed(saved);
    expect((await store.list('Hidden history sentinel')).sessions).toHaveLength(1);
    for (const hint of [routingKey, String(clock.estimatedCacheExpiresAt), clock.cacheRequestModelId]) {
      expect((await store.list(hint)).sessions).toEqual([]);
    }
    const ui = JSON.stringify(await store.list());
    expect(ui).not.toContain(routingKey);
    expect(ui).not.toContain(clock.cacheRequestModelId);
  });
});
