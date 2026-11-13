/**
 * Resolving and settling a reply's edit offers (ADR 2026-11-10 D1, D2; epic
 * Slice 1), through a fake `FileEditStaging`:
 * - each offer the reply reader kept is resolved once, by `resolve` (never
 *   `stage`: no baseline is read), and carries the host's identity;
 * - an offer whose file does not resolve, or resolves to an identity a
 *   session can't hold, is dropped with the reason's name;
 * - with the setting off nothing is resolved; a reply with no offer tag
 *   resolves nothing;
 * - at completion, a reply with no prose of its own, or prose too long to
 *   quote, keeps none; a reply that is no persona's keeps none;
 * - logs carry kinds, counts and fault names only.
 * Made-up text: Alice.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopEditOffer } from '@messages';
import {
  reportWorkshopEditOffers,
  resolveWorkshopReplyEditOffers,
  resolveWorkshopReplyEdits,
  settleWorkshopReplyEditOffers
} from '@/application/services/workshop/fileEdits/WorkshopReplyEditOffers';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { editOfferFrame, fakeFileEditStaging, fileEditFrame, URI_SENTINEL } from './fileEditFixtures';

const SECRET_PATH = 'chapters/zzq-secret-path.md';
const SAID = 'Three slips: ZZQ-PROSE "begining" is the first.';
const SENTINELS = [URI_SENTINEL, 'zzq-secret-path', 'ZZQ-PROSE', 'begining', '.md', 'file:'];
const expectNoText = (logs: readonly string[]) => {
  const text = logs.join('\n');
  for (const sentinel of SENTINELS) {
    expect(text).not.toContain(sentinel);
  }
};
const FIXES = editOfferFrame({ path: SECRET_PATH, count: 3 });
const REWRITES = editOfferFrame({ kind: 'rewrites', excerpt: true });
const uri = (path: string) => `file:///ws/${URI_SENTINEL}/${path}`;

describe('resolveWorkshopReplyEditOffers', () => {
  it('resolves each kept offer once, to the host\'s identity, and never stages it', async () => {
    const staging = fakeFileEditStaging();
    const context = await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${FIXES}\n${REWRITES}`, open: true, staging });
    expect(staging.resolutions).toEqual([{ kind: 'resource', group: 'chapters', path: SECRET_PATH }, { kind: 'excerpt' }]);
    expect(staging.calls).toEqual([]);
    expect(context).toEqual({
      offers: [
        { kind: 'fixes', target: { kind: 'file', documentUri: uri(SECRET_PATH), relativePath: SECRET_PATH }, count: 3 },
        { kind: 'rewrites', target: { kind: 'excerpt', documentUri: uri('chapters/chapter-1.md'), relativePath: 'chapters/chapter-1.md' } }
      ],
      logs: []
    });
    // An offer stores no state, no class and no baseline.
    expect(Object.keys(context!.offers[0]).sort()).toEqual(['count', 'kind', 'target']);
    expect(Object.keys(context!.offers[1]).sort()).toEqual(['kind', 'target']);
  });

  it('drops an offer whose file did not resolve, by the refusal\'s name, and keeps the other', async () => {
    const staging = fakeFileEditStaging({ refuse: (target) => target.kind === 'excerpt' ? 'excerpt-not-a-file' : undefined });
    const context = await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${FIXES}\n${REWRITES}`, open: true, staging });
    expect(context?.offers.map((offer) => offer.kind)).toEqual(['fixes']);
    expect(context?.logs).toEqual(['Edit offer dropped (reason=unresolved:excerpt-not-a-file)']);
    for (const reason of ['ambiguous-target', 'not-configured', 'outside-workspace'] as const) {
      const refused = await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${FIXES}`, open: true, staging: fakeFileEditStaging({ refuse: () => reason }) });
      expect(refused).toEqual({ offers: [], logs: [`Edit offer dropped (reason=unresolved:${reason})`] });
    }
  });

  it('a port that rejects reads as unreadable; an identity a session can\'t hold is no offer', async () => {
    const rejected = await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${FIXES}`, open: true, staging: fakeFileEditStaging({ reject: true }) });
    expect(rejected).toEqual({ offers: [], logs: ['Edit offer dropped (reason=unresolved:unreadable)'] });
    const unholdable = fakeFileEditStaging();
    unholdable.resolve = async () => ({ kind: 'resolved', target: { kind: 'file', documentUri: uri('a.md'), relativePath: `two\nlines-${URI_SENTINEL}.md` } });
    const context = await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${FIXES}`, open: true, staging: unholdable });
    expect(context).toEqual({ offers: [], logs: ['Edit offer dropped (reason=unresolved:identity-unpersistable)'] });
    expectNoText([...rejected!.logs, ...context!.logs]);
  });

  it('with the setting off, nothing is resolved, and each frame is counted', async () => {
    const staging = fakeFileEditStaging();
    const context = await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${FIXES}\n${REWRITES}`, open: false, staging });
    expect(staging.resolutions).toEqual([]);
    expect(context).toEqual({ offers: [], logs: ['Edit offer dropped (reason=file-edits-off)', 'Edit offer dropped (reason=file-edits-off)'] });
  });

  it('resolves nothing for a frame the reply reader dropped, and names each drop', async () => {
    const staging = fakeFileEditStaging();
    const reply = [SAID, editOfferFrame({ kind: 'polish', path: SECRET_PATH }), FIXES, editOfferFrame({ path: SECRET_PATH }),
      editOfferFrame({ kind: 'rewrites', path: `../${SECRET_PATH}` })].join('\n\n');
    const context = await resolveWorkshopReplyEditOffers({ reply, open: true, staging });
    expect(staging.resolutions).toHaveLength(1);
    expect(context?.offers.map((offer) => offer.kind)).toEqual(['fixes']);
    expect(context?.logs).toEqual([
      'Edit offer dropped (reason=unknown-kind)',
      'Edit offer dropped (reason=duplicate-kind)',
      'Edit offer dropped (reason=malformed:invalid-path)'
    ]);
    expectNoText(context!.logs);
  });

  it('a reply with no offer tag resolves nothing; an aborted run resolves nothing and counts each', async () => {
    const staging = fakeFileEditStaging();
    expect(await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${fileEditFrame()}`, open: true, staging })).toBeUndefined();
    const controller = new AbortController();
    controller.abort();
    const aborted = await resolveWorkshopReplyEditOffers({ reply: `${SAID}\n\n${FIXES}`, open: true, staging, signal: controller.signal });
    expect(aborted).toEqual({ offers: [], logs: ['Edit offer dropped (reason=not-resolved)'] });
    expect(staging.resolutions).toEqual([]);
  });
});

describe('resolveWorkshopReplyEdits', () => {
  it('a reply with neither tag is undefined; proposals alone are as before', async () => {
    const staging = fakeFileEditStaging();
    expect(await resolveWorkshopReplyEdits({ reply: SAID, open: true, staging })).toBeUndefined();
    const context = await resolveWorkshopReplyEdits({ reply: `${SAID}\n\n${fileEditFrame()}`, open: true, staging });
    expect(context?.proposals).toHaveLength(1);
    expect(context).not.toHaveProperty('editOffers');
  });

  it('offers alone carry the reply they were resolved from, and no card', async () => {
    const reply = `${SAID}\n\n${FIXES}`;
    const context = await resolveWorkshopReplyEdits({ reply, open: true, staging: fakeFileEditStaging() });
    expect(context).toMatchObject({ reply, proposals: [], logs: [] });
    expect(context?.editOffers?.offers).toHaveLength(1);
  });

  it('a reply that proposes outright stages its card and resolves no offer', async () => {
    const staging = fakeFileEditStaging();
    const context = await resolveWorkshopReplyEdits({ reply: `${SAID}\n\n${fileEditFrame()}\n${FIXES}`, open: true, staging });
    expect(context?.proposals).toHaveLength(1);
    expect(staging.resolutions).toEqual([]);
    expect(context?.editOffers).toEqual({ offers: [], logs: ['Edit offer dropped (reason=has-file-edit-proposal)'] });
  });
});

describe('settleWorkshopReplyEditOffers', () => {
  const offer: WorkshopEditOffer = { kind: 'fixes', target: { kind: 'file', documentUri: uri(SECRET_PATH), relativePath: SECRET_PATH }, count: 3 };
  const control = extractWorkshopReplyControls(`${SAID}\n\n${FIXES}`, { memoryOpen: false, fileEditsOpen: true }).editOffers;
  const RESOLVED = { offers: [offer], logs: [] as string[] };
  const settle = (display: { content: string; hostWritten: boolean }, context: { offers: WorkshopEditOffer[]; logs: string[] } | null = RESOLVED) => {
    const logs: string[] = [];
    return { kept: settleWorkshopReplyEditOffers(control, context ?? undefined, display, (line) => logs.push(line)), logs };
  };

  it('keeps the resolved offers of a reply with prose of its own', () => {
    expect(settle({ content: SAID, hostWritten: false })).toEqual({ kept: [offer], logs: [] });
  });

  it('a reply with no offer frame settles to nothing, silently', () => {
    const logs: string[] = [];
    expect(settleWorkshopReplyEditOffers(undefined, { offers: [offer], logs: ['x'] }, { content: SAID, hostWritten: false }, (line) => logs.push(line))).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('nothing resolved for this reply: each frame is counted as not resolved', () => {
    expect(settle({ content: SAID, hostWritten: false }, null)).toEqual({ kept: [], logs: ['Edit offer dropped (reason=not-resolved)'] });
  });

  it('a reply whose line the host wrote, or with nothing left, offers nothing', () => {
    expect(settle({ content: 'Jill returned a widget setup without an accompanying note.', hostWritten: true }))
      .toEqual({ kept: [], logs: ['Edit offer dropped (reason=no-prose)'] });
    expect(settle({ content: ' \n', hostWritten: false })).toEqual({ kept: [], logs: ['Edit offer dropped (reason=no-prose)'] });
  });

  it('a reply over sourceReplyCharacters keeps no offers; one at the bound keeps them', () => {
    const bound = PROMPT_BUDGETS.workshopEditOffers.sourceReplyCharacters;
    expect(settle({ content: 'a'.repeat(bound), hostWritten: false }).kept).toEqual([offer]);
    expect(settle({ content: 'a'.repeat(bound + 1), hostWritten: false }))
      .toEqual({ kept: [], logs: ['Edit offer dropped (reason=source-reply-too-long)'] });
  });

  it('passes the earlier drops\' lines through, once each', () => {
    expect(settle({ content: SAID, hostWritten: false }, { offers: [offer], logs: ['Edit offer dropped (reason=unknown-kind)'] }).logs)
      .toEqual(['Edit offer dropped (reason=unknown-kind)']);
  });

  it('reports what the adopted turn kept: kind, target kind and count, or that the reply is no persona\'s', () => {
    const kept: string[] = [];
    reportWorkshopEditOffers([offer, { kind: 'rewrites', target: offer.target }], { editOffers: [offer] }, (line) => kept.push(line));
    expect(kept).toEqual(['Edit offer kept (kind=fixes; target=file; count=3)', 'Edit offer kept (kind=rewrites; target=file; count=none)']);
    const droppedLines: string[] = [];
    reportWorkshopEditOffers([offer], {}, (line) => droppedLines.push(line));
    expect(droppedLines).toEqual(['Edit offer dropped (reason=not-a-persona)']);
    expectNoText([...kept, ...droppedLines]);
  });
});
