/**
 * Model stamps in the persisted session (ADR 2026-11-03 D7, D9): additive and
 * optional. A stamped turn round-trips; a malformed stamp is refused on load
 * and save; a turn without one reads and writes exactly as before.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { MODEL_SCOPES, WorkshopTurnModel } from '@messages';

const STAMP: WorkshopTurnModel = {
  scope: 'assistant',
  requestedModelId: 'anthropic/claude-sonnet-5',
  servedModelIds: ['anthropic/claude-sonnet-5-20261001', 'openai/gpt-5']
};

/** A saved room with a writer turn and a host reply, stamped or not, recorded by the real aggregate. */
const savedRoom = (model?: WorkshopTurnModel): WorkshopPersistedSessionV2 => {
  const workshop = new WorkshopSessionService(() => Date.parse('2026-11-03T14:00:00.000Z'));
  workshop.setExcerpt({ text: 'She lifted the lantern.', source: { kind: 'manual' } });
  workshop.beginPersonaMessage('host-request', 'Look at the lantern beat.');
  workshop.completeRun(
    'host-request', 'It lands late.', undefined, false, 'runtime-host',
    [], undefined, undefined, model
  );
  const state = workshop.exportCommittedState();
  const temporal = new WorkshopSessionTimeService({
    now: () => new Date('2026-11-03T13:00:00.000Z'),
    timezone: 'America/Chicago'
  });
  return {
    schemaVersion: 2,
    sessionId: 'session-1',
    title: 'Lantern',
    createdAt: '2026-11-03T13:00:00.000Z',
    updatedAt: '2026-11-03T14:00:00.000Z',
    temporal: temporal.exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: state.turns.length, excerptWordCount: 4 },
    workshop: state,
    conversations: []
  };
};

type MutableTurn = Record<string, unknown> & { role: string; model?: Record<string, unknown> };

const editedRoom = (edit: (reply: MutableTurn, writer: MutableTurn) => void): unknown => {
  const raw = JSON.parse(JSON.stringify(savedRoom(STAMP))) as { workshop: { turns: MutableTurn[] } };
  const writer = raw.workshop.turns.find((turn) => turn.role === 'user')!;
  const reply = raw.workshop.turns.find((turn) => turn.role === 'assistant')!;
  edit(reply, writer);
  return raw;
};

const replyOf = (session: WorkshopPersistedSessionV2) =>
  session.workshop.turns.find((turn) => turn.role === 'assistant')!;

describe('Workshop turn model stamps in the session codec', () => {
  it('round-trips a stamped reply through save and reopen', () => {
    const saved = parseWorkshopPersistedSession(JSON.parse(JSON.stringify(savedRoom(STAMP))));
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(saved))).session;

    expect(replyOf(saved).model).toEqual(STAMP);
    expect(replyOf(reopened).model).toEqual(STAMP);
  });

  it('accepts a stamp with no served models', () => {
    const raw = editedRoom((reply) => { reply.model!.servedModelIds = []; });

    expect(replyOf(parseWorkshopPersistedSession(raw)).model?.servedModelIds).toEqual([]);
    expect(replyOf(decodeWorkshopPersistedSessionCheckpoint(raw).session).model?.servedModelIds).toEqual([]);
  });

  it.each(MODEL_SCOPES)('accepts the model scope %s', (scope) => {
    const raw = editedRoom((reply) => { reply.model!.scope = scope; });

    expect(() => parseWorkshopPersistedSession(raw)).not.toThrow();
    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).not.toThrow();
  });

  it('reads and writes a room without stamps exactly as before', () => {
    const unstamped = JSON.parse(JSON.stringify(savedRoom())) as WorkshopPersistedSessionV2;
    const text = JSON.stringify(unstamped);

    const saved = parseWorkshopPersistedSession(JSON.parse(text));
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session;

    expect(unstamped.workshop.turns.every((turn) => !('model' in turn))).toBe(true);
    expect(JSON.stringify(saved)).toBe(text);
    expect(reopened.workshop.turns).toEqual(unstamped.workshop.turns);
    expect(reopened.workshop.turns.every((turn) => !('model' in turn))).toBe(true);
  });

  it('reads the released V1 fixture, which predates stamps, with none added', () => {
    const releasedV1 = require('../../../fixtures/workshop-session-v1-released.json') as unknown;

    const { session } = decodeWorkshopPersistedSessionCheckpoint(releasedV1);

    expect(session.workshop.turns.every((turn) => turn.model === undefined)).toBe(true);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(JSON.stringify(session))))).not.toContain('"model"');
  });

  it.each([
    ['an unknown scope', (reply: MutableTurn) => { reply.model!.scope = 'workshop'; }, /model\.scope must be known model scope/],
    ['an empty requested model', (reply: MutableTurn) => { reply.model!.requestedModelId = ''; }, /model\.requestedModelId must be non-empty string/],
    ['a missing requested model', (reply: MutableTurn) => { delete reply.model!.requestedModelId; }, /missing required field requestedModelId/],
    ['served models that are not a list', (reply: MutableTurn) => { reply.model!.servedModelIds = 'openai/gpt-5'; }, /model\.servedModelIds must be array/],
    ['an empty served model', (reply: MutableTurn) => { reply.model!.servedModelIds = ['']; }, /servedModelIds\[0\] must be non-empty string/],
    ['a served model listed twice', (reply: MutableTurn) => { reply.model!.servedModelIds = ['openai/gpt-5', 'openai/gpt-5']; }, /servedModelIds\[1\] must be a served model id not already listed/],
    ['an unknown stamp field', (reply: MutableTurn) => { reply.model!.costUsd = 0.01; }, /contains unknown field costUsd/],
    ['a stamp on a writer turn', (_reply: MutableTurn, writer: MutableTurn) => { writer.model = { ...STAMP }; }, /model must be a stamp on an assistant turn/]
  ])('rejects %s on load and save', (_label, edit, message) => {
    const raw = editedRoom(edit);

    expect(() => parseWorkshopPersistedSession(raw)).toThrow(message);
    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(message);
  });
});
