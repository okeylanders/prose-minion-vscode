/**
 * The Proofread prompt and its worked example (ADR 2026-10-21 D6; Slice 3b):
 * the prompt names exactly the closed categories, and the example's response
 * reads through the production frame reader and codec, every quote anchoring
 * in the example's passage and every verdict the guard's.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DRAFT_EDIT_PASS_POLICIES } from '@/domain/models/DraftEdit';
import { PROOFREAD_CATEGORIES, proofreadCategoryDisposition } from '@/domain/models/ProofreadIssue';
import { decodeProofreadReply } from '@services/proofread/ProofreadResponseCodec';
import { readProofreadFrame } from '@services/proofread/ProofreadResponseFrame';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import { judgeProofreadFinding } from '@/utils/proofread/proofreadGuard';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../../../resources/system-prompts/proofread');
const prompt = fs.readFileSync(path.join(PROMPT_ROOT, '00-proofread.md'), 'utf8');
const example = fs.readFileSync(path.join(PROMPT_ROOT, '01-proofread-example.md'), 'utf8');

const section = (text: string, heading: string, next: string) => text.slice(text.indexOf(heading), text.indexOf(next));

describe('The Proofread prompt', () => {
  it('names exactly the closed categories, each once', () => {
    const listed = [...section(prompt, '## What to report', '## What never to report').matchAll(/^- `([a-z-]+)`:/gm)].map((match) => match[1]);
    expect(listed).toHaveLength(PROOFREAD_CATEGORIES.length);
    expect(new Set(listed)).toEqual(new Set(PROOFREAD_CATEGORIES));
  });

  it('teaches the narration a request can carry (Slice 3b)', () => {
    const narration = section(prompt, '## The document\'s narration', '## How to report an issue');
    for (const term of ['`narration`', '`tense`', '`past`', '`present`', '`person`', '`first`', '`third`']) {
      expect(narration).toContain(term);
    }
  });
});

describe('The worked example', () => {
  const passage = section(example, '## Passage', '## Response').replace('## Passage', '').trim();
  const frame = section(example, '## Response', 'Nothing else is reported').match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
  const reply = decodeProofreadReply(readProofreadFrame(frame).root);

  it('reads through the production frame reader and codec, whole', () => {
    expect(reply.malformed).toBe(0);
    expect(reply.ignoredFields).toBe(0);
    expect(reply.findings.length).toBeGreaterThan(0);
  });

  it('shows every category Slice 3b added', () => {
    const shown = new Set(reply.findings.map((finding) => finding.category));
    for (const category of ['wrong-word', 'missing-word', 'extra-word', 'person'] as const) {
      expect(shown).toContain(category);
    }
  });

  it('quotes text that anchors once in its passage, with a verdict the guard gives its category', () => {
    for (const finding of reply.findings) {
      const anchored = anchorQuote(passage, finding.anchor);
      expect({ quote: finding.anchor.quote, kind: anchored.kind }).toEqual({ quote: finding.anchor.quote, kind: 'anchored' });
      const original = anchored.kind === 'anchored' ? passage.slice(anchored.start, anchored.end) : '';
      expect(judgeProofreadFinding({ category: finding.category, original, replacement: finding.replacement }, DRAFT_EDIT_PASS_POLICIES.proofread))
        .toEqual({ kind: 'keep', disposition: proofreadCategoryDisposition(finding.category) });
    }
  });
});
