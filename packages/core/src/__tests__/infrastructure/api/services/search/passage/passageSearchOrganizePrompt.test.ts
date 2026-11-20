/**
 * The organizing pass's prompt and its worked example (ADR 2026-11-20 D12,
 * D13): the numbers the prompt states are `PROMPT_BUDGETS`', the example's
 * request is byte for byte what the request builder produces over the read
 * example's own checked instances, and its response reads through the
 * production codec and passes every host check with nothing dropped.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { anchorPassageSearchInstances, mergePassageSearchInstances } from '@services/search/passage/PassageSearchInstances';
import { PASSAGE_SEARCH_PROMPTS, PASSAGE_SEARCH_QUESTION_FRAME } from '@services/search/passage/PassageSearchMessages';
import { checkPassageSearchOrganizeReply, passageSearchQuotedSpans } from '@services/search/passage/PassageSearchOrganizeChecks';
import { readPassageSearchOrganizeReply } from '@services/search/passage/PassageSearchOrganizeReplyCodec';
import {
  PASSAGE_SEARCH_INSTANCES_FRAME,
  PASSAGE_SEARCH_LABELS_FRAME,
  PASSAGE_SEARCH_ORGANIZE_PROMPTS,
  buildPassageSearchOrganizeMessage
} from '@services/search/passage/PassageSearchOrganizeRequest';
import { readPassageSearchReply } from '@services/search/passage/PassageSearchReplyCodec';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../../../../resources/system-prompts');
const load = (file: string): string => fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8');
const [prompt, example] = PASSAGE_SEARCH_ORGANIZE_PROMPTS.map(load);
const bounds = PROMPT_BUDGETS.passageSearch;
const organize = bounds.organize;

const fenced = (text: string, heading: string, language: string): string => {
  const section = text.slice(text.indexOf(heading));
  const match = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``).exec(section);
  if (!match) {
    throw new Error(`no ${language} block under ${heading}`);
  }
  return match[1];
};
const framedIn = (message: string, frame: string): string =>
  message.slice(message.indexOf(`<${frame}>\n`) + frame.length + 3, message.indexOf(`\n</${frame}>`));

/** The read example's instances, checked and merged as a run would: what the pass is given. */
function readExampleResult() {
  const readExample = load(PASSAGE_SEARCH_PROMPTS[1]);
  const request = fenced(readExample, '## Request', 'text');
  const passage = framedIn(request, 'passage-search-passage');
  const file = { key: 'f1', identity: 'example', displayPath: 'chapters/1.md', text: passage, sha256: '', lineOffset: 0, lines: 'document' as const };
  const reply = readPassageSearchReply(fenced(readExample, '## Response', 'json'), false);
  const anchored = anchorPassageSearchInstances(file, { file: 0, start: 0, bodyStart: 0, end: passage.length }, reply.instances);
  const merged = mergePassageSearchInstances([file], anchored.found, bounds.instances, bounds.contextCharacters);
  return { question: framedIn(request, PASSAGE_SEARCH_QUESTION_FRAME), labels: merged.labels, instances: merged.instances };
}

describe('The organizing pass\'s prompt', () => {
  it('states the asks as PROMPT_BUDGETS has them', () => {
    const flat = prompt.replace(/\s+/g, ' ');
    expect(flat).toContain(`\`headline\`: one sentence, at most ${organize.headlineCharacters} characters`);
    expect(flat).toContain(`\`sections\`: at most ${organize.sections}, each`);
    expect(flat).toContain(`a short name for the pattern, at most ${organize.titleCharacters} characters`);
    expect(flat).toContain(`\`claims\`: at most ${organize.claims} statements, each one sentence or two, at most ${organize.claimCharacters} characters`);
    // Every figure the prompt states is one of those asks: no bound, ceiling or token count of the host's.
    const stated = [...prompt.matchAll(/\b\d+\b/g)].map((match) => Number(match[0]));
    const asks = [organize.headlineCharacters, organize.sections, organize.titleCharacters, organize.claims, organize.claimCharacters];
    expect(stated.filter((figure) => !asks.includes(figure))).toEqual([]);
    expect(stated).toHaveLength(asks.length);
  });

  it('names the frames the request builder writes, the entry\'s lines, and the reply\'s fields', () => {
    for (const frame of [PASSAGE_SEARCH_QUESTION_FRAME, PASSAGE_SEARCH_LABELS_FRAME, PASSAGE_SEARCH_INSTANCES_FRAME]) {
      expect(prompt).toContain(`<${frame}>`);
    }
    expect(prompt).toContain('`quote:`');
    expect(prompt).toContain('`note:`');
    for (const field of ['headline', 'sections', 'title', 'claims', 'text', 'cites']) {
      expect(prompt).toContain(`"${field}"`);
    }
  });

  it('teaches the quotation rule the host checks: double marks, copied exactly, from a cited instance', () => {
    const flat = prompt.replace(/\s+/g, ' ');
    expect(flat).toContain('Put words in double quotation marks only when you copy them from the `quote:` line of an instance');
    expect(flat).toContain('In a claim, quote only from an instance that claim cites.');
    expect(flat).toContain('A claim with no cite is thrown away.');
  });
});

describe('The organizing pass\'s worked example', () => {
  const result = readExampleResult();
  const request = fenced(example, '## Request', 'text');
  const reply = readPassageSearchOrganizeReply(fenced(example, '## Response', 'json'), false);

  it('shows a request byte for byte as the request builder produces it over the read example\'s instances', () => {
    expect(result.instances.length).toBeGreaterThan(2);
    expect(request).toBe(buildPassageSearchOrganizeMessage(result, result.instances, result.instances.length));
  });

  it('answers with a reply that reads whole through the production codec, within every ask', () => {
    expect(reply).toMatchObject({ malformedClaims: 0, malformedSections: 0, ignoredFields: 0, repairs: [] });
    expect(reply.headline?.length).toBeLessThanOrEqual(organize.headlineCharacters);
    expect(reply.sections.length).toBeGreaterThan(1);
    expect(reply.sections.length).toBeLessThanOrEqual(organize.sections);
    for (const section of reply.sections) {
      expect(section.title?.length).toBeLessThanOrEqual(organize.titleCharacters);
      expect(section.claims.length).toBeGreaterThan(0);
      expect(section.claims.length).toBeLessThanOrEqual(organize.claims);
      for (const claim of section.claims) {
        expect(claim.text.length).toBeLessThanOrEqual(organize.claimCharacters);
        expect(claim).toMatchObject({ badCites: 0 });
      }
    }
  });

  it('passes every host check with nothing dropped, replaced or clipped', () => {
    const analysis = checkPassageSearchOrganizeReply(reply, result.instances, result.instances.map((instance) => instance.number));
    expect(analysis.dropped).toEqual({ claims: 0, uncited: 0, misquoted: 0, malformed: 0, sections: 0, cites: 0 });
    expect(analysis.replaced).toEqual({ headline: false, titles: 0 });
    expect(analysis.clipped).toBe(0);
    expect(analysis.read).toEqual({ instances: result.instances.length, of: result.instances.length });
    expect(analysis.headline).toBe(reply.headline);
    expect(analysis.sections.map((section) => section.title)).toEqual(reply.sections.map((section) => section.title));
    // It teaches the rule by using it: some claim quotes, and every instance is cited somewhere.
    const claims = analysis.sections.flatMap((section) => section.claims);
    expect(claims.some((claim) => (passageSearchQuotedSpans(claim.text) ?? []).length > 0)).toBe(true);
    expect([...new Set(claims.flatMap((claim) => claim.cites))].sort()).toEqual(result.instances.map((instance) => instance.number));
  });
});
