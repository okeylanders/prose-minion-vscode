# U1 measurement: saved-session size and cold-search cost

**Date:** 2026-10-05
**Question:** Can recall project saved sessions on demand, or does it need a
persisted visible-transcript index first? ([ADR](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md) §5,
[runway](../../../docs/architecture/2026-10-05-workshop-session-recall-runway.md) U1)
**Decision rule:** add the index before enabling the prompts if a cold search
over the bounded corpus takes more than about 2 s, or if the 90th-percentile
named session exceeds 5 MB.

## Okey's workspace (real files)

The ten largest named sessions, from `du -h prose-minion/sessions/*.json | sort -h | tail`:

| Size | File |
|---|---|
| 2.2M | `20260911-181104-chapter-6-5-bridge-and-leveling-9-11.json` |
| 1.8M | `20261003-190442-chapter-6-8-bridge-leveling.json` |
| 1.6M | `20260814-175611-chapter-5-8-rewrite-md-jill-jul-23-copy.json` |
| 1.3M | `20260922-173206-chapter-6-7-leveling-9-22.json` |
| 1.3M | `20260904-195401-chapter-6-2-bridge-leveling-9-3.json` |
| 1.2M | `20260929-205412-chapter-6-7-stock-signature-speech-sol-6-1-9-29.json` |
| 1.2M | `20260825-003218-chapter-5-8-fresh-analysis-and-work.json` |
| 1.1M | `20261005-013538-chapter-6-8-stock-and-signature-10-4.json` |
| 1.1M | `20261002-024024-chapter-6-7-stock-signature-sonnet-5-5-9-30-branch.json` |
| 1.1M | `20260928-213955-chapter-6-7-fresh-9-28-muse.json` |

"There's a lot more sessions too" — the total count is not yet known. The
largest file is 2.2 MB, so **the 5 MB prong passes** for any count.

The filenames also show **lineage**: a `-copy` and a `-branch`, and five
sessions on chapter 6-7. Duplicate spreads `...source.session`
(`WorkshopSessionPersistenceCoordinator.ts`, `duplicateNamed`) and Branch builds
from the cut room with "No lineage is recorded in v1" (`WorkshopSessionBranch.ts`),
so copies and branches share turns and turn ids with their sources. See the
ADR's de-duplication rule (§4).

## Synthetic benchmark (real codec, cloud container)

Sessions built through the real `WorkshopSessionService` so they pass the real
codec: a chapter-length excerpt, three attached context files, persona replies
of about 800 words, a ~30 KB `resource.read` artifact every third exchange, and a
host conversation archive that repeats all of it, as real archives do. Each
measurement is the median of 7 runs of the store's exact-read pipeline: UTF-8
decode, `assertPersistedJsonNestingDepth`, `JSON.parse`,
`decodeWorkshopPersistedSessionCheckpoint`, then `projectWorkshopTranscript`.
Environment: 4 vCPUs, Node 22.22.

| File | Turns | Visible text | UTF-8 | Depth scan | Parse | Decode | Project | Per session | 40 sessions cold |
|---|---|---|---|---|---|---|---|---|---|
| 0.78 MiB | 26 | 68 KiB (8.5%) | 3.7 ms | 4.9 ms | 1.7 ms | 2.2 ms | 0.05 ms | 12.5 ms | 0.50 s |
| 1.56 MiB | 52 | 136 KiB (8.5%) | 7.4 ms | 8.1 ms | 3.3 ms | 2.2 ms | 0.08 ms | 21.1 ms | 0.85 s |
| 3.04 MiB | 103 | 271 KiB (8.7%) | 5.8 ms | 17.0 ms | 8.1 ms | 3.9 ms | 0.12 ms | 35.0 ms | 1.40 s |

Without artifacts or the UTF-8 and depth steps, a 2.20 MiB session cost 7.4 ms
and visible text was 16.3% of the file.

### What it shows

- **Visible text is 8–16% of a session file.** Recall's payload is roughly a
  tenth of the file — the "too thick" instinct, quantified.
- **Cost is about 11–13 ms per MiB**, dominated by the store's safety steps:
  the nesting-depth scan (38–49%) and UTF-8 decoding (20–35%). Both stay; the
  depth scan guards against hostile JSON.
- **Projection is effectively free** (under 0.2 ms), so the cache saves file
  reading and decoding, not projection.
- At Okey's sizes, a cold search over 40–60 sessions should cost roughly
  0.5–1 s of CPU, and the 64 MiB per-call budget likely covers the whole corpus.

### Caveats

- Synthetic text is ASCII and uniform; real sessions carry more structure
  (citations, widget configs, metadata) and non-ASCII punctuation.
- Disk and `workspace.fs` overhead are excluded; a remote workspace pays more.
- The container CPU is not Okey's machine.

## Verdict

**U1 resolved for v1: keep on-demand projection; no persisted index.** The
size prong passes outright, and the time prong is under the trigger by about
2×. Slice 5 still records wall-clock cold and warm search times in the
Extension Development Host on the real corpus, with the session count.

## Rerunning

Copy the script below to `packages/core/src/__tests__/zz-recall-benchmark.test.ts`,
run `npx jest packages/core/src/__tests__/zz-recall-benchmark.test.ts`, and
delete it afterwards: it prints timings and is not a regression test. After
Slice 1 moves the projection, update its import to
`@/application/services/workshop/transcript/WorkshopTranscript`.

```ts
/** Session-recall U1 benchmark. Run on demand; never commit to __tests__. */
import { performance } from 'perf_hooks';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { projectWorkshopTranscript } from '@/application/services/workshop/export/WorkshopTranscript';
import { assertPersistedJsonNestingDepth } from '@/application/services/workshop/persistedJson';

const VOCAB = ('lighthouse mother absence tide keeper lantern salt rope harbor ' +
  'gull stair window letter promise silence weather stone signal brother ' +
  'chapter scene beat rhythm image echo pressure reveal motive cadence').split(' ');
let seed = 7;
const words = (n: number): string => {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out.push(VOCAB[seed % VOCAB.length]);
    if (i % 14 === 13) out.push('.\n');
  }
  return out.join(' ');
};

function buildSession(scale: number): { text: string; visibleChars: number; turns: number } {
  let clock = Date.parse('2026-09-28T20:00:00.000Z');
  const workshop = new WorkshopSessionService(() => (clock += 60_000));
  const excerpt = words(Math.round(12_000 * scale));
  workshop.setExcerpt({ text: excerpt, source: { kind: 'manual' } });
  const contextBodies: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const body = words(Math.round(13_000 * scale));
    contextBodies.push(body);
    workshop.addContextAttachment({
      kind: 'file', origin: 'wizard', label: `chapter-${i}.md`, content: body,
      words: Math.round(13_000 * scale), sourceUri: `file:///novel/chapter-${i}.md`, relativePath: `chapter-${i}.md`
    });
  }
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: [excerpt, ...contextBodies].join('\n\n') }
  ];
  const exchanges = Math.round(22 * scale);
  for (let i = 0; i < exchanges; i += 1) {
    const ask = words(80);
    const reply = words(800);
    workshop.beginPersonaMessage(`r-${i}`, ask);
    if (i % 3 === 0) {
      const evidence = words(5_000); // ~30 KB resource read, persisted in the artifact turn
      workshop.recordCapabilityArtifact({
        requestId: `r-${i}`, excerptVersion: workshop.getExcerptVersion(),
        details: { operation: 'resource.read', status: 'success', requestSummary: `chapter-${i}.md`,
          requestedByPersonaId: 'jill', invokedBy: { kind: 'host' }, metadata: { path: `chapter-${i}.md` } },
        result: { capability: 'resource.read', status: 'success', requestSummary: `chapter-${i}.md`, content: evidence }
      });
      messages.push({ role: 'user', content: ask }, { role: 'assistant', content: '<call/>' });
      messages.push({ role: 'user', content: evidence });
    } else {
      messages.push({ role: 'user', content: ask });
    }
    workshop.completeRun(`r-${i}`, reply, undefined, false, 'runtime-host');
    messages.push({ role: 'assistant', content: reply });
  }
  const temporal = new WorkshopSessionTimeService({
    now: () => new Date('2026-09-28T20:00:00.000Z'), timezone: 'America/Chicago'
  });
  const state = workshop.exportCommittedState();
  const session: WorkshopPersistedSessionV2 = {
    schemaVersion: 2,
    sessionId: 'bench-session',
    title: 'chapter 6-7 bench',
    createdAt: '2026-09-28T20:00:00.000Z',
    updatedAt: '2026-09-28T23:00:00.000Z',
    temporal: temporal.exportState(),
    summary: {
      hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: state.turns.length,
      excerptWordCount: 12_000
    },
    workshop: state,
    conversations: [{
      key: 'host', toolName: 'workshop-persona', messages, lastActivity: clock,
      contextSources: [], nextArtifactNumber: 1
    }] as WorkshopPersistedSessionV2['conversations']
  };
  const text = JSON.stringify(session, undefined, 2);
  const projected = projectWorkshopTranscript(state.turns, { title: 't', exportedAt: 0 });
  const visibleChars = projected.entries.reduce((n, e) => n + (e.kind === 'event' ? e.text.length : e.content.length), 0);
  return { text, visibleChars, turns: state.turns.length };
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe('recall benchmark (throwaway)', () => {
  it.each([0.5, 1, 2])('scale %p', (scale) => {
    const { text, visibleChars, turns } = buildSession(scale);
    const parse: number[] = []; const decode: number[] = []; const project: number[] = []; const textDecode: number[] = []; const depth: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const bytes = new TextEncoder().encode(text);
      let t = performance.now();
      const decodedText = new TextDecoder().decode(bytes);
      textDecode.push(performance.now() - t);
      t = performance.now();
      assertPersistedJsonNestingDepth(decodedText, 'bench');
      depth.push(performance.now() - t);
      t = performance.now();
      const raw = JSON.parse(decodedText);
      parse.push(performance.now() - t);
      t = performance.now();
      const decoded = decodeWorkshopPersistedSessionCheckpoint(raw).session;
      decode.push(performance.now() - t);
      t = performance.now();
      projectWorkshopTranscript(decoded.workshop.turns, { title: 't', exportedAt: 0 });
      project.push(performance.now() - t);
    }
    const mb = text.length / (1024 * 1024);
    const perSession = median(textDecode) + median(depth) + median(parse) + median(decode) + median(project);
    // eslint-disable-next-line no-console
    console.log(
      `scale=${scale} file=${mb.toFixed(2)}MiB turns=${turns} visible=${(visibleChars / 1024).toFixed(0)}KiB ` +
      `(${((visibleChars / text.length) * 100).toFixed(1)}%) utf8=${median(textDecode).toFixed(1)}ms depth=${median(depth).toFixed(1)}ms parse=${median(parse).toFixed(1)}ms ` +
      `decode=${median(decode).toFixed(1)}ms project=${median(project).toFixed(2)}ms ` +
      `perSession=${perSession.toFixed(1)}ms cold40=${(perSession * 40 / 1000).toFixed(2)}s`
    );
  });
});
```
