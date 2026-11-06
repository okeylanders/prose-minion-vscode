/**
 * Staging a reply's file-edit frames (ADR 2026-11-05 D4, D10, D11, D13;
 * epic Slice 3), through a fake `FileEditStaging`:
 * - each frame that decodes is staged once, in parallel, at most
 *   `proposalsPerReply`; staged frames become pending cards carrying
 *   staging's identity, class and baseline; refused ones become refused
 *   cards with the refusal's kind; a port that rejects reads as `unreadable`;
 * - with the setting off, or no port bound, nothing is staged and no card is
 *   made;
 * - a reply with no file-edit tag stages nothing;
 * - logs carry kinds and counts only: never a path, URI, quote, why or
 *   passage, for malformed, oversized and disabled frames and refusals alike.
 * Made-up text: Alice.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import {
  fakeFileEditStaging,
  fileEditFrame,
  PASSAGE_SENTINEL,
  QUOTE_SENTINEL,
  sentinelFileEditFrame,
  URI_SENTINEL,
  WHY_SENTINEL,
  WITH_SENTINEL
} from './fileEditFixtures';

const SECRET_PATH = 'characters/zzq-secret-path.md';
const SENTINELS = [QUOTE_SENTINEL, WITH_SENTINEL, PASSAGE_SENTINEL, WHY_SENTINEL, URI_SENTINEL, 'zzq-secret-path'];
const expectNoText = (logs: readonly string[]) => {
  const text = logs.join('\n');
  for (const sentinel of SENTINELS) {
    expect(text).not.toContain(sentinel);
  }
};

describe('resolveWorkshopReplyFileEdits', () => {
  it('stages each frame and settles it: staged → pending with identity, class and baseline; refused → refused with its kind', async () => {
    const staging = fakeFileEditStaging({ refuse: (target) => target.kind === 'excerpt' ? 'excerpt-not-a-file' : undefined });
    const reply = `Yes.\n\n${sentinelFileEditFrame(SECRET_PATH)}\n${fileEditFrame({ excerpt: true })}`;
    const context = await resolveWorkshopReplyFileEdits({ reply, open: true, staging });
    expect(staging.calls).toEqual([{ kind: 'resource', group: 'characters', path: SECRET_PATH }, { kind: 'excerpt' }]);
    expect(context?.reply).toBe(reply);
    expect(context?.proposals).toEqual([{
      requested: { kind: 'resource', group: 'characters', path: SECRET_PATH },
      target: { kind: 'file', documentUri: `file:///ws/${URI_SENTINEL}/${SECRET_PATH}`, relativePath: SECRET_PATH },
      class: 'notes',
      operations: [
        { op: 'replace', find: `Alice ${QUOTE_SENTINEL}`, with: `Alice ${WITH_SENTINEL}` },
        { op: 'append', text: `More ${PASSAGE_SENTINEL}` }
      ],
      why: `Why ${WHY_SENTINEL}`,
      baseline: { sha256: 'a'.repeat(64), length: 42 },
      state: 'pending'
    }, {
      requested: { kind: 'excerpt' },
      operations: [{ op: 'replace', find: 'Alice is seven', with: 'Alice is ten' }],
      why: 'Alice is ten now.',
      state: 'refused',
      reason: 'excerpt-not-a-file'
    }]);
    expect(context?.logs).toEqual([
      'File edit proposal pending (target=file; class=notes; operations=replace,append)',
      'File edit proposal refused at staging (reason=excerpt-not-a-file; operations=replace)'
    ]);
    expectNoText(context!.logs);
  });

  it('a rewrite staged to prose is refused here, keeping its identity, class and baseline', async () => {
    const staging = fakeFileEditStaging();
    const reply = `Yes.\n\n${fileEditFrame({ group: 'chapters', path: 'chapters/one.md', body: ['<rewrite>All new.</rewrite>'] })}\n${fileEditFrame({ path: 'characters/alice.md', body: ['<rewrite>Alice, ten.</rewrite>'] })}`;
    const context = await resolveWorkshopReplyFileEdits({ reply, open: true, staging });
    expect(context?.proposals.map((proposal) => [proposal.class, proposal.state, proposal.reason ?? null, proposal.target?.relativePath])).toEqual([
      ['prose', 'refused', 'rewrite-on-prose', 'chapters/one.md'],
      ['notes', 'pending', null, 'characters/alice.md']
    ]);
    expect(context?.logs[0]).toBe('File edit proposal refused at staging (reason=rewrite-on-prose; operations=rewrite)');
  });

  it('two frames staged to one document keep only the first card', async () => {
    const staging = fakeFileEditStaging();
    // Two requests that stage to one identity (as two groups listing one file would).
    const sameFile: typeof staging = {
      calls: staging.calls,
      stage: async (target) => {
        const result = await staging.stage(target);
        return result.kind === 'staged' ? { ...result, target: { ...result.target, documentUri: 'file:///ws/one.md' } } : result;
      }
    };
    const reply = `Yes.\n\n${fileEditFrame({ path: 'characters/alice.md' })}\n${fileEditFrame({ group: 'general', path: 'general/alice.md' })}`;
    const context = await resolveWorkshopReplyFileEdits({ reply, open: true, staging: sameFile });
    expect(context?.proposals).toHaveLength(1);
    expect(context?.logs).toContain('File edit proposal dropped (reason=duplicate-identity)');
  });

  it('a port that rejects reads as an unreadable refusal, and its message never reaches a log', async () => {
    const context = await resolveWorkshopReplyFileEdits({ reply: `Yes.\n\n${sentinelFileEditFrame()}`, open: true, staging: fakeFileEditStaging({ reject: true }) });
    expect(context?.proposals).toEqual([expect.objectContaining({ state: 'refused', reason: 'unreadable' })]);
    expectNoText(context!.logs);
  });

  it('with the setting off, nothing is staged: every frame dropped and counted', async () => {
    const staging = fakeFileEditStaging();
    const context = await resolveWorkshopReplyFileEdits({ reply: `Yes.\n\n${sentinelFileEditFrame()}\n${fileEditFrame({ path: 'characters/b.md' })}`, open: false, staging });
    expect(staging.calls).toEqual([]);
    expect(context).toEqual({ reply: expect.any(String), proposals: [], logs: [
      'File edit proposal dropped (reason=file-edits-off)',
      'File edit proposal dropped (reason=file-edits-off)'
    ] });
  });

  it('a reply with no file-edit tag stages nothing and returns nothing', async () => {
    const staging = fakeFileEditStaging();
    await expect(resolveWorkshopReplyFileEdits({ reply: 'Just prose.', open: true, staging })).resolves.toBeUndefined();
    expect(staging.calls).toEqual([]);
  });

  it('stages at most the cap; malformed and oversized frames are never staged, and log only their kind', async () => {
    const staging = fakeFileEditStaging();
    const cap = PROMPT_BUDGETS.workshopFileEdits.proposalsPerReply;
    const frames = Array.from({ length: cap + 1 }, (_, index) => fileEditFrame({ path: `characters/p${index}.md` }));
    const malformed = fileEditFrame({ path: 'characters/zzq-secret-path.md', why: null, body: [`<find>${QUOTE_SENTINEL}</find>`] });
    const oversized = fileEditFrame({ path: 'characters/zzq-secret-path-2.md', body: [`<append>${PASSAGE_SENTINEL}${'a'.repeat(PROMPT_BUDGETS.workshopFileEdits.frameCharacters)}</append>`] });
    const context = await resolveWorkshopReplyFileEdits({ reply: `Yes.\n\n${[malformed, oversized, ...frames].join('\n')}`, open: true, staging });
    expect(staging.calls).toHaveLength(cap);
    expect(context?.proposals).toHaveLength(cap);
    expect(context?.logs.filter((line) => line.startsWith('File edit proposal dropped'))).toEqual([
      'File edit proposal dropped (reason=malformed:missing-why)',
      'File edit proposal dropped (reason=oversized)',
      'File edit proposal dropped (reason=over-cap)'
    ]);
    expectNoText(context!.logs);
  });

  it('an aborted run stages nothing', async () => {
    const staging = fakeFileEditStaging();
    const controller = new AbortController();
    controller.abort();
    const context = await resolveWorkshopReplyFileEdits({ reply: `Yes.\n\n${fileEditFrame()}`, open: true, staging, signal: controller.signal });
    expect(staging.calls).toEqual([]);
    expect(context?.proposals).toEqual([]);
  });
});
