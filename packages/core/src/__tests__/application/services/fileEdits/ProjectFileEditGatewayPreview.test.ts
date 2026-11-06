/**
 * A rewrite card's preview (ADR 2026-11-05 D6, D9): the gateway's own
 * resolution, the live content's before and the rewrite's after, only while
 * the baseline holds; otherwise stale. It writes nothing, and its log line
 * carries counts and kinds only. *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { ProjectFileEditGateway } from '@/application/services/fileEdits/ProjectFileEditGateway';
import type { StagedFileEdit } from '@/domain/models/FileEdit';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { FakeDocuments } from '../draftEdit/fakeDocuments';
import { candidate, expectNoLeaks, hostFakes, ports, ROOT, uriOf, type HostFakes } from './fileEditFixtures';

const NOTE = `${ROOT}/characters/alice.md`;
const NOTE_TEXT = '---\ntitle: Alice\n---\n\nAlice is curious.\n';

function fixture(text = NOTE_TEXT, fakes: Partial<HostFakes> = {}) {
  const documents = new FakeDocuments(text, uriOf(NOTE));
  const host = hostFakes({ candidates: [candidate('characters', 'characters/alice.md')], ...fakes });
  const gateway = new ProjectFileEditGateway({ ...ports(host), documents, applier: new DraftEditApplier(documents), epoch: { current: () => 0 } });
  return { gateway, documents, host };
}

const staged = (...operations: TextEditOperation[]): StagedFileEdit => ({
  target: { kind: 'file', documentUri: uriOf(NOTE), relativePath: 'characters/alice.md' },
  class: 'notes',
  baseline: fileEditBaseline(NOTE_TEXT, NOTE),
  operations,
  source: { kind: 'proposal', turnId: 'turn-3', index: 0 }
});

describe('ProjectFileEditGateway.preview', () => {
  it('answers the live content after front matter, and the rewrite, while the baseline holds', async () => {
    const { gateway, documents, host } = fixture();
    expect(await gateway.preview(staged({ op: 'rewrite', text: 'Alice is brave.' }))).toEqual({ kind: 'rewrite', before: 'Alice is curious.', after: 'Alice is brave.' });
    expect(documents.applyCalls).toEqual([]);
    expect(host.log).toEqual(['[FileEdit] preview turn=turn-3 index=0 target=file result=rewrite']);
    expectNoLeaks(host.log, 'curious', 'brave');
  });

  it('answers stale once the note changed, with no text', async () => {
    const { gateway } = fixture(NOTE_TEXT.replace('curious', 'bold'));
    expect(await gateway.preview(staged({ op: 'rewrite', text: 'Alice is brave.' }))).toEqual({ kind: 'stale', reason: 'baseline-changed' });
  });

  it('re-authorizes the identity as Apply does', async () => {
    const { gateway } = fixture(NOTE_TEXT, { candidates: [] });
    expect(await gateway.preview(staged({ op: 'rewrite', text: 'Alice.' }))).toEqual({ kind: 'refused', reason: 'no-longer-configured' });
  });

  it('refuses a card that is not a rewrite: its operations are its diff', async () => {
    const { gateway, documents } = fixture();
    expect(await gateway.preview(staged({ op: 'replace', find: 'curious', with: 'brave' }))).toEqual({ kind: 'refused', reason: 'not-a-rewrite' });
    expect(documents.opened).toEqual([]);
  });
});
