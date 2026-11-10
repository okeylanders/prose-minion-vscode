/**
 * Edit offers on the turn (ADR 2026-11-10 D1, D2, D8; epic Slice 1): an
 * optional, additive turn field with no `schemaVersion` change, and no
 * state.
 *
 * - A host or guest persona's reply keeps its resolved offers, at most one
 *   per kind; the bubble shows only its prose. A reply that is no persona's,
 *   has no prose of its own, is too long to quote, or proposed outright,
 *   keeps none, and each drop is counted in the log by name.
 * - Offers round-trip through save and reopen, byte for byte; the codec
 *   refuses every malformed shape.
 * - The webview's view omits the host's `documentUri`.
 * - The transcript projection, export through it, recall and the turn
 *   preview show no offer at all: they are controls, not content.
 * - A reply's actionable findings are the same with and without an offer.
 * - No log line carries a path, a URI or any of the reply.
 * Made-up text: Alice.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { completeWorkshopRun, workshopMessageCompletionCopy } from '@/application/services/workshop/WorkshopRunCompletion';
import { projectWorkshopTranscript, projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { renderWorkshopTranscriptJson } from '@/application/services/workshop/export/WorkshopTranscriptJson';
import { renderWorkshopTranscriptHtml } from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { resolveWorkshopReplyEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyEditOffers';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, type WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE } from '@/utils/workshopReplyControls';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import {
  editOfferFrame,
  fakeFileEditStaging,
  fileEditFrame,
  URI_SENTINEL
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

const SECRET_PATH = 'chapters/zzq-secret-path.md';
const PROSE_SENTINEL = 'ZZQ-PROSE';
const SAID = `Three slips in the chapter ${PROSE_SENTINEL}: "begining" is the first.`;
const FIXES = editOfferFrame({ path: SECRET_PATH, count: 3 });
const REWRITES = editOfferFrame({ kind: 'rewrites', excerpt: true });
const B = PROMPT_BUDGETS.workshopEditOffers;
const uri = (path: string) => `file:///ws/${URI_SENTINEL}/${path}`;
const KEPT = [
  { kind: 'fixes', target: { kind: 'file', documentUri: uri(SECRET_PATH), relativePath: SECRET_PATH }, count: 3 },
  { kind: 'rewrites', target: { kind: 'excerpt', documentUri: uri('chapters/chapter-1.md'), relativePath: 'chapters/chapter-1.md' } }
];
const dropped = (room: { log: string[] }, reason: string) =>
  room.log.filter((line) => line.includes(`Edit offer dropped (reason=${reason})`)).length;
const expectNoText = (logs: readonly string[]) => {
  const text = logs.filter((line) => line.includes('Edit offer')).join('\n');
  expect(text).not.toBe('');
  for (const sentinel of [URI_SENTINEL, 'zzq-secret-path', PROSE_SENTINEL, 'begining', '.md', 'file:']) {
    expect(text).not.toContain(sentinel);
  }
};

async function resolve(room: ScriptedWorkshopRoom, content: string, open = true, refuse?: Parameters<typeof fakeFileEditStaging>[0]) {
  room.fileEdits = await resolveWorkshopReplyEdits({ reply: content, open, staging: fakeFileEditStaging(refuse) });
}

async function reply(room: ScriptedWorkshopRoom, content: string, open = true) {
  await resolve(room, content, open);
  return room.hostMessage('Any typos in the chapter?', { reply: content });
}

async function roomWithOffers() {
  const room = new ScriptedWorkshopRoom().start();
  room.hostMessage('Where is the cup?');
  const offering = await reply(room, `${SAID}\n\n${FIXES}\n${REWRITES}`);
  return { room, offering };
}

const WIDGET = [
  '### Try a widget',
  '<workshop-widget-recommendation version="1">',
  '<widget-id>', 'gesture-playground', '</widget-id>',
  '<target-phrase>', 'Her eyes stretched wide.', '</target-phrase>',
  '<writer-instructions>', 'Keep it as recognition, not shock.', '</writer-instructions>',
  '<surrounding-context>', 'Alice looked past the Rabbit.\nHer eyes stretched wide.', '</surrounding-context>',
  '<source-references>', 'none', '</source-references>',
  '<character-notes>', 'Alice hides her fear from her sister.', '</character-notes>',
  '</workshop-widget-recommendation>'
].join('\n');

describe('edit offers on a reply', () => {
  it('a host persona\'s reply keeps one offer per kind, resolved; the bubble shows only the prose', async () => {
    const { room, offering } = await roomWithOffers();
    expect(offering.content).toBe(SAID);
    expect(offering.content).not.toContain('prose-minion-edit-offer');
    expect(offering.editOffers).toEqual(KEPT);
    expect(offering.fileEditProposals).toBeUndefined();
    expect(room.log.filter((line) => line.includes('Edit offer kept'))).toEqual([
      'Edit offer kept (kind=fixes; target=file; count=3) (Jill)',
      'Edit offer kept (kind=rewrites; target=excerpt; count=none) (Jill)'
    ]);
    expectNoText(room.log);
  });

  it('a guest persona\'s reply keeps its offers too', async () => {
    const room = new ScriptedWorkshopRoom().start();
    room.inviteGuest('margot', 'Margot, read this with us.');
    const content = `${SAID}\n\n${FIXES}`;
    await resolve(room, content);
    const turn = room.guestMessage('margot', 'Any typos?', { reply: content });
    expect(turn.participant).toBe('guest');
    expect(turn.content).toBe(SAID);
    expect(turn.editOffers).toEqual([KEPT[0]]);
  });

  it('a reply that is no persona\'s keeps none, and each is counted', async () => {
    const session = new WorkshopSessionService(() => 1_000);
    session.setExcerpt({ text: 'Alice was begining to get very tired.', source: { kind: 'manual' } });
    session.beginToolRun('prose', 'tool-1');
    session.completeToolReport('tool-1', 'Initial report.', 'tool-conv');
    session.beginDirectToolMessage('prose', 'req-1', 'Any typos?');
    const content = `${SAID}\n\n${FIXES}\n${REWRITES}`;
    const log: string[] = [];
    const turn = completeWorkshopRun({
      session,
      requestId: 'req-1',
      label: 'Prose',
      result: { toolName: 'workshop-test', content, conversationId: 'tool-conv' } as AnalysisResult,
      aborted: false,
      createsRetainedConversation: false,
      copy: workshopMessageCompletionCopy('Prose'),
      discardConversation: () => undefined,
      readRetainedHistory: () => undefined,
      fileEdits: await resolveWorkshopReplyEdits({ reply: content, open: true, staging: fakeFileEditStaging() }),
      log: (line) => log.push(line),
      events: { streamCompleted: () => undefined, turnCompleted: () => undefined, status: () => undefined, error: () => undefined, widgetRecommendationRejected: () => undefined }
    })!;
    expect(turn.participant).toBe('tool');
    expect(turn.content).toBe(SAID);
    expect(turn.editOffers).toBeUndefined();
    expect(dropped({ log }, 'not-a-persona')).toBe(2);
    expectNoText(log);
  });

  it('a reply of offers alone earns no host line and keeps none', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = await reply(room, `${FIXES}\n${REWRITES}`);
    expect(turn.content).toBe('');
    expect(turn.editOffers).toBeUndefined();
    expect(dropped(room, 'no-prose')).toBe(2);
  });

  it('a reply whose only prose was a widget\'s setup keeps none: the host wrote its line', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = await reply(room, `${WIDGET}\n\n${FIXES}`);
    expect(turn.widgetRecommendation).toBeDefined();
    expect(turn.model).toBeUndefined();
    expect(turn.editOffers).toBeUndefined();
    expect(dropped(room, 'no-prose')).toBe(1);
    // With prose beside the widget, the offer stands.
    const said = await reply(room, `${SAID}\n\n${WIDGET}\n\n${FIXES}`);
    expect(said.widgetRecommendation).toBeDefined();
    expect(said.editOffers).toEqual([KEPT[0]]);
  });

  it('a reply too long to quote keeps none; one at the bound keeps them', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const long = 'a'.repeat(B.sourceReplyCharacters + 1);
    const over = await reply(room, `${long}\n\n${FIXES}`);
    expect(over.content).toBe(long);
    expect(over.editOffers).toBeUndefined();
    expect(dropped(room, 'source-reply-too-long')).toBe(1);
    const at = await reply(room, `${'a'.repeat(B.sourceReplyCharacters)}\n\n${FIXES}`);
    expect(at.editOffers).toEqual([KEPT[0]]);
  });

  it('a reply that proposes outright keeps its card and no offer; beside a card the host\'s line names only the card', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = await reply(room, `${SAID}\n\n${fileEditFrame()}\n${FIXES}`);
    expect(turn.fileEditProposals).toHaveLength(1);
    expect(turn.editOffers).toBeUndefined();
    expect(dropped(room, 'has-file-edit-proposal')).toBe(1);
    const only = await reply(room, `${fileEditFrame()}\n${FIXES}`);
    expect(only.content).toBe(WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE);
    expect(only.editOffers).toBeUndefined();
  });

  it('with file edits off, no offer: the frame is stripped, dropped and counted', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = await reply(room, `${SAID}\n\n${FIXES}`, false);
    expect(turn.content).toBe(SAID);
    expect(turn.editOffers).toBeUndefined();
    expect(dropped(room, 'file-edits-off')).toBe(1);
  });

  it('an offer whose file did not resolve is dropped; the other stands', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const content = `${SAID}\n\n${FIXES}\n${REWRITES}`;
    await resolve(room, content, true, { refuse: (target) => target.kind === 'resource' ? 'ambiguous-target' : undefined });
    const turn = room.hostMessage('Any typos?', { reply: content });
    expect(turn.editOffers).toEqual([KEPT[1]]);
    expect(dropped(room, 'unresolved:ambiguous-target')).toBe(1);
    expectNoText(room.log);
  });

  it('a reply nothing resolved still has its frames stripped, and counted as not resolved', () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = room.hostMessage('Any typos?', { reply: `${SAID}\n\n${FIXES}\n${editOfferFrame({ kind: 'polish' })}` });
    expect(turn.content).toBe(SAID);
    expect(turn.editOffers).toBeUndefined();
    expect(dropped(room, 'not-resolved')).toBe(2);
  });

  it('offers resolved for another reply are never used', async () => {
    const room = new ScriptedWorkshopRoom().start();
    await resolve(room, `${SAID}\n\n${FIXES}`);
    const turn = room.hostMessage('Any typos?', { reply: `Another reply.\n\n${FIXES}` });
    expect(turn.editOffers).toBeUndefined();
    expect(dropped(room, 'not-resolved')).toBe(1);
  });

  it('every dropped frame is logged by name only (the sentinel sweep)', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const frames = [
      editOfferFrame({ kind: `polish ${PROSE_SENTINEL}`, path: SECRET_PATH }),
      editOfferFrame({ path: `../${SECRET_PATH}` }),
      editOfferFrame({ path: SECRET_PATH, count: PROSE_SENTINEL }),
      editOfferFrame({ path: SECRET_PATH, extra: [`<why>${PROSE_SENTINEL}</why>`] }),
      `<prose-minion-edit-offer><kind>fixes</kind><path>${SECRET_PATH}</path>${'x'.repeat(B.frameCharacters)}</prose-minion-edit-offer>`,
      FIXES,
      editOfferFrame({ path: SECRET_PATH }),
      `<prose-minion-edit-offer><kind>rewrites</kind><path>${SECRET_PATH}</path>`
    ];
    const turn = await reply(room, `${SAID}\n\n${frames.join('\n')}`);
    expect(turn.content).toBe(SAID);
    expect(turn.editOffers).toEqual([KEPT[0]]);
    for (const reason of ['unknown-kind', 'malformed:invalid-path', 'malformed:invalid-count', 'malformed:unknown-element', 'oversized', 'duplicate-kind', 'malformed:unclosed']) {
      expect(dropped(room, reason)).toBe(1);
    }
    expectNoText(room.log);
    // The frames never reach a log, even in a diagnostic copy of the reply.
    expect(room.log.join('\n')).not.toContain('prose-minion-edit-offer');
  });
});

describe('a reply\'s actionable findings are untouched by an offer', () => {
  const ADVICE = [
    'The opening wants its first image sooner.',
    '',
    '### Next steps',
    '- [high] Move the Rabbit\'s watch into the first paragraph.',
    '- Fix "begining" in the first line.'
  ].join('\n');

  it('the same findings, content and to-do list with the offer as without it', async () => {
    const plain = new ScriptedWorkshopRoom().start();
    const without = await reply(plain, ADVICE);
    const offered = new ScriptedWorkshopRoom().start();
    const withOffer = await reply(offered, `${ADVICE}\n\n${FIXES}\n${REWRITES}`);
    expect(without.actionableFindings).toHaveLength(2);
    expect(withOffer.actionableFindings).toEqual(without.actionableFindings);
    expect(withOffer.content).toBe(without.content);
    expect(offered.session.getSnapshot().todos).toEqual(plain.session.getSnapshot().todos);
    expect(withOffer.editOffers).toEqual(KEPT);
    expect(without.editOffers).toBeUndefined();
  });

  it('a dropped offer changes them no more than a kept one', async () => {
    const plain = new ScriptedWorkshopRoom().start();
    const without = await reply(plain, ADVICE);
    const room = new ScriptedWorkshopRoom().start();
    const turn = await reply(room, `${ADVICE}\n\n${editOfferFrame({ kind: 'polish' })}`, false);
    expect(turn.actionableFindings).toEqual(without.actionableFindings);
    expect(turn.content).toBe(without.content);
  });
});

type Turns = Array<Record<string, unknown>>;
const checkpointWith = async (mutate: (turns: Turns) => void) => {
  const checkpoint = scriptedCheckpoint('offers', (await roomWithOffers()).room) as unknown as { workshop: { turns: Turns } };
  mutate(checkpoint.workshop.turns);
  return JSON.stringify(checkpoint);
};
const offering = (turns: Turns) => turns.find((turn) => turn.editOffers)!;
const offersOf = (turns: Turns) => offering(turns).editOffers as Array<Record<string, unknown>>;
const first = (turns: Turns) => offersOf(turns)[0];
const target = (turns: Turns) => first(turns).target as Record<string, unknown>;

describe('edit offers in the saved session', () => {
  it('round-trip through save and reopen, byte for byte, and hydrate as they were', async () => {
    const { room, offering: turn } = await roomWithOffers();
    const text = JSON.stringify(scriptedCheckpoint('offers', room));
    expect(text).toContain(URI_SENTINEL);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    // No development shape exists to repair.
    expect(reopened.normalizations).toEqual([]);
    const session = new WorkshopSessionService(() => 9_000);
    session.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(session.readRoomLedger().find((each) => each.id === turn.id)?.editOffers).toEqual(KEPT);
  });

  it('a session without the field reads and writes exactly as before', async () => {
    const text = await checkpointWith((turns) => { delete offering(turns).editOffers; });
    expect(text).not.toContain('editOffers');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
  });

  it('a single offer, with or without its count, round-trips', async () => {
    for (const mutate of [(turns: Turns) => { offersOf(turns).pop(); }, (turns: Turns) => { offersOf(turns).shift(); }, (turns: Turns) => { first(turns).count = B.count; }]) {
      const text = await checkpointWith(mutate);
      expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    }
  });

  describe('refused when malformed', () => {
    const writer = (turns: Turns) => turns.find((turn) => turn.participant === 'writer')!;
    it.each<[string, (turns: Turns) => void, RegExp]>([
      ['offers on a writer turn', (turns) => { writer(turns).editOffers = offersOf(turns); }, /editOffers must be a host or guest persona reply/],
      ['an empty list', (turns) => { offering(turns).editOffers = []; }, /editOffers must be an array of 1–2/],
      ['a third offer', (turns) => { offersOf(turns).push({ ...first(turns) }); }, /editOffers must be an array of 1–2/],
      ['two offers of one kind', (turns) => { offersOf(turns)[1].kind = 'fixes'; }, /\[1\]\.kind must be a kind no earlier offer has/],
      ['an unknown kind', (turns) => { first(turns).kind = 'polish'; }, /\[0\]\.kind must be fixes \| rewrites/],
      ['a stored state', (turns) => { first(turns).state = 'answered'; }, /unknown field state/],
      ['a stored status', (turns) => { first(turns).used = true; }, /unknown field used/],
      ['no target', (turns) => { delete first(turns).target; }, /target/],
      ['a requested target in place of an identity', (turns) => { first(turns).target = { kind: 'resource', group: 'chapters', path: SECRET_PATH }; }, /target/],
      ['a target with no documentUri', (turns) => { delete target(turns).documentUri; }, /documentUri/],
      ['an unknown target kind', (turns) => { target(turns).kind = 'resource'; }, /\[0\]\.target\.kind must be file \| excerpt/],
      ['a display path on two lines', (turns) => { target(turns).relativePath = 'chapters/a\nb.md'; }, /\[0\]\.target must be a host identity/],
      ['an empty display path', (turns) => { target(turns).relativePath = ''; }, /\[0\]\.target must be a host identity/],
      ['a URI past its bound', (turns) => { target(turns).documentUri = `file:///${'a'.repeat(8_192)}`; }, /\[0\]\.target must be a host identity/],
      ['an extra target field', (turns) => { target(turns).fsPath = '/ws/a.md'; }, /unknown field fsPath/],
      ['a count of zero', (turns) => { first(turns).count = 0; }, /\[0\]\.count must be a whole number from 1 to 99/],
      ['a count past the bound', (turns) => { first(turns).count = B.count + 1; }, /\[0\]\.count must be a whole number from 1 to 99/],
      ['a count that is no whole number', (turns) => { first(turns).count = 2.5; }, /\[0\]\.count must be a whole number from 1 to 99/],
      ['a count as text', (turns) => { first(turns).count = '3'; }, /\[0\]\.count must be a whole number from 1 to 99/],
      ['a null count', (turns) => { first(turns).count = null; }, /\[0\]\.count must be a whole number from 1 to 99/]
    ])('%s', async (_name, mutate, expected) => {
      const text = await checkpointWith(mutate);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(expected);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text))).toThrow(expected);
    });
  });
});

describe('what the webview sees of an offer', () => {
  it('the display path, kind and count, never the documentUri', async () => {
    const { offering: turn } = await roomWithOffers();
    const view = workshopTurnForWebview(turn);
    expect(view.editOffers).toEqual([
      { kind: 'fixes', target: { kind: 'file', relativePath: SECRET_PATH }, count: 3 },
      { kind: 'rewrites', target: { kind: 'excerpt', relativePath: 'chapters/chapter-1.md' } }
    ]);
    expect(JSON.stringify(view)).not.toContain(URI_SENTINEL);
    // The host's turn is untouched.
    expect(turn.editOffers).toEqual(KEPT);
  });

  it('a turn with neither cards nor offers is passed as it is', () => {
    const turn = { id: 't-1' } as WorkshopTurn;
    expect(workshopTurnForWebview(turn)).toBe(turn);
  });
});

describe('edit offers in the transcript (one projection): omitted, by decision', () => {
  const OFFER_TEXT = ['editOffers', 'edit-offer', 'fixes', 'rewrites', 'zzq-secret-path', URI_SENTINEL];
  // The reply's own prose says nothing an offer says, so any hit is the offer's.
  const room = async () => {
    const scripted = new ScriptedWorkshopRoom().start();
    const turn = await reply(scripted, `Alice has three slips.\n\n${FIXES}\n${REWRITES}`);
    return { scripted, turn };
  };

  it('the reply\'s entry is exactly the entry of the same reply without offers', async () => {
    const { scripted, turn } = await room();
    expect(turn.editOffers).toEqual(KEPT);
    const entry = projectWorkshopTranscriptTurn(turn)!;
    const { editOffers: _omitted, ...bare } = turn;
    expect(entry).toEqual(projectWorkshopTranscriptTurn(bare));
    expect(entry).toMatchObject({ kind: 'reply', content: 'Alice has three slips.' });
    const transcript = JSON.stringify(projectWorkshopTranscript(scripted.session.readRoomLedger(), { title: 'Offers', exportedAt: 0 }));
    for (const text of OFFER_TEXT) {
      expect(transcript).not.toContain(text);
    }
  });

  it.each([
    ['Markdown', renderWorkshopTranscriptMarkdown],
    ['JSON', renderWorkshopTranscriptJson],
    ['HTML', renderWorkshopTranscriptHtml]
  ] as const)('%s export shows no offer', async (_format, render) => {
    const { scripted } = await room();
    const out = render(projectWorkshopTranscript(scripted.session.readRoomLedger(), { title: 'Slips', exportedAt: 0 }));
    expect(out).toContain('Alice has three slips.');
    for (const text of OFFER_TEXT) {
      expect(out).not.toContain(text);
    }
  });

  it('recall and the turn preview see no offer', async () => {
    const { scripted, turn } = await room();
    const preview = JSON.stringify(workshopTurnPreview(turn));
    const document = JSON.stringify(buildWorkshopRecallDocument(scriptedCheckpoint('offers', scripted)));
    for (const text of OFFER_TEXT) {
      expect(preview).not.toContain(text);
      expect(document).not.toContain(text);
    }
  });
});
