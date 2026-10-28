/**
 * The Craft Flags prompts and their worked examples (ADR 2026-10-21,
 * Amendment 2026-10-26: Slice 3c): cliché's vocabulary shared with the
 * Lightbox, register shift's own (part 2), gesture strain's own and the
 * host's beat counts (part 3), continuity's pairs (part 4), the fence's words
 * in the prompt, and examples that read through the production frame, codec,
 * anchoring and placement.
 */
import * as fs from 'fs';
import * as path from 'path';
import { FAMILIAR_PHRASE_DEFINITIONS, FAMILIAR_PHRASE_KINDS } from '@shared/constants/familiarPhrasing';
import {
  CONTINUITY_DEFINITIONS,
  CONTINUITY_KINDS,
  CRAFT_FLAG_KINDS,
  GESTURE_STRAIN_DEFINITIONS,
  GESTURE_STRAIN_KINDS,
  REGISTER_SHIFT_DEFINITIONS,
  REGISTER_SHIFT_KINDS,
  type CraftFlagIssue
} from '@/domain/models/CraftFlag';
import { decodeCraftFlagsReply, readCraftFlagsFrame } from '@services/craftFlags/CraftFlagsResponseCodec';
import { CRAFT_FLAGS_SHARED_PROMPT, CRAFT_FLAG_PROMPTS } from '@services/craftFlags/CraftFlagsService';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import { findSpeechSpans } from '@/utils/draftEdit/speechSpans';
import { phraseRepeats } from '@/utils/craftFlags/phraseRepeats';
import { CRAFT_FLAG_FORBIDDEN_PHRASES, craftFlagPhrasingFault } from '@/utils/craftFlags/craftFlagPhrasing';
import { craftFlagAnnotation, craftFlagMessage, withRepeats } from '@/application/services/draftEdit/craftFlagsPlacement';
import { chapterSectionStarts } from '@/utils/chapterSections';

const PROMPTS = path.resolve(__dirname, '../../../../../../resources/system-prompts');
const readPrompt = (file: string) => fs.readFileSync(path.join(PROMPTS, file), 'utf8');
const shared = readPrompt(CRAFT_FLAGS_SHARED_PROMPT);
const [category, example] = CRAFT_FLAG_PROMPTS.cliche.map(readPrompt);
const section = (text: string, heading: string, next: string) => text.slice(text.indexOf(heading), text.indexOf(next));

describe('The Craft Flags prompts', () => {
  it('load the shared rules, then each category\'s section and worked example', () => {
    expect(CRAFT_FLAGS_SHARED_PROMPT).toBe('craft-flags/00-craft-flags.md');
    expect(CRAFT_FLAG_PROMPTS).toEqual({
      cliche: ['craft-flags/10-cliche.md', 'craft-flags/11-cliche-example.md'],
      register: ['craft-flags/20-register.md', 'craft-flags/21-register-example.md'],
      gesture: ['craft-flags/30-gesture.md', 'craft-flags/31-gesture-example.md'],
      continuity: ['craft-flags/40-continuity.md', 'craft-flags/41-continuity-example.md']
    });
  });

  it('define the familiar kinds in the shared words, verbatim, and flag only the cliché category\'s two', () => {
    for (const kind of FAMILIAR_PHRASE_KINDS) {
      expect(category).toContain(`- \`${kind}\`: ${FAMILIAR_PHRASE_DEFINITIONS[kind]}.`);
    }
    const flagged = [...section(category, 'Flag only these two kinds', '## What to leave alone').matchAll(/^- `([a-z]+)`:/gm)].map((match) => match[1]);
    expect(flagged).toEqual([...CRAFT_FLAG_KINDS.cliche]);
  });

  it('hold the Lightbox\'s familiar phrasing to the same four kinds, and its weighted tier to the same words', () => {
    const lightbox = readPrompt('lightbox/50-stock-signature.md');
    expect(lightbox).toContain('`kind`: `idiom`, `cliche`, `stock` (a stock phrase), or `weighted`');
    expect(lightbox).toContain(`\`weighted\`: ${FAMILIAR_PHRASE_DEFINITIONS.weighted};`);
  });

  it('teach every word the phrasing fence withholds, and the other rules it holds a note to', () => {
    const phrasing = section(shared, '## How a note is phrased', '## Response format');
    for (const word of ['should', 'must', 'fix', 'cut', 'delete', 'remove', 'replace', 'rewrite', 'wrong', 'bad']) {
      expect(phrasing).toMatch(new RegExp(`\\b${word}\\b`));
    }
    // The fence's two-word orders, as the prompt names them (each with its other forms in the fence).
    for (const phrase of ['need to', 'have to']) {
      expect(CRAFT_FLAG_FORBIDDEN_PHRASES).toContain(phrase);
      expect(phrasing).toContain(phrase);
    }
    expect(phrasing).toMatch(/double quotation marks/);
    expect(phrasing).toMatch(/digit/);
  });
});

describe('The cliché worked example', () => {
  const passage = section(example, '## Passage', '## Response').replace('## Passage', '').trim();
  const frame = section(example, '## Response', 'Nothing else is flagged').match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
  const reply = decodeCraftFlagsReply(readCraftFlagsFrame(frame).root, 'cliche');

  it('reads through the production frame reader and codec, whole, every note shown as written', () => {
    expect(reply).toMatchObject({ malformed: 0, ignoredFields: 0, notesWithheld: 0 });
    expect(reply.findings.length).toBeGreaterThan(3);
    expect(new Set(reply.findings.map((finding) => finding.kind))).toEqual(new Set(['cliche', 'weighted']));
  });

  it('quotes phrases that anchor once in its passage, none in speech, each repeat counted by the host', () => {
    const speech = findSpeechSpans(passage);
    const repeats = phraseRepeats(passage, speech);
    const placed = reply.findings.map((finding) => {
      const anchored = anchorQuote(passage, finding.anchor);
      expect({ quote: finding.anchor.quote, kind: anchored.kind }).toEqual({ quote: finding.anchor.quote, kind: 'anchored' });
      const { start, end } = anchored.kind === 'anchored' ? anchored : { start: 0, end: 0 };
      expect(speech.some((span) => span.start < end && start < span.end)).toBe(false);
      return { text: passage.slice(start, end), repeats: repeats.count(passage.slice(start, end)) };
    });
    expect(placed.filter((each) => each.text === 'time stood still').map((each) => each.repeats)).toEqual([2, 2]);
  });

  it('leaves the Rabbit\'s cliché alone, inside its speech', () => {
    expect(passage).toContain('as busy as a bee');
    expect(reply.findings.some((finding) => /busy as a bee/.test(finding.anchor.quote))).toBe(false);
  });
});

describe('The register shift prompt (Slice 3c part 2)', () => {
  const [register] = CRAFT_FLAG_PROMPTS.register.map(readPrompt);

  it('defines its kinds in the domain\'s words, verbatim, and no others', () => {
    for (const kind of REGISTER_SHIFT_KINDS) {
      expect(register).toContain(`- \`${kind}\`: ${REGISTER_SHIFT_DEFINITIONS[kind]}.`);
    }
    const named = [...section(register, '## The kinds', '## What to leave alone').matchAll(/^- `([a-z]+)`:/gm)].map((match) => match[1]);
    expect(named).toEqual([...CRAFT_FLAG_KINDS.register]);
  });

  it('asks for the register line before any flag, with years allowed, and a period only when the narration sets one', () => {
    // Read as prose: the prompt's line breaks are not the rules'.
    const first = section(register, '## First, the chapter\'s register', '## The kinds').replace(/\s+/g, ' ');
    expect(first).toContain('`register`, at the root of your reply');
    expect(first).toContain('a reply with flags always carries it');
    expect(first).toContain('You may name it by its years.');
    expect(register.replace(/\s+/g, ' ')).toContain('Flag `period` only when the narration sets a period and your `register` names it.');
  });

  it('leaves dialogue and a character\'s marked thought alone', () => {
    const alone = section(register, '## What to leave alone', '## The note');
    expect(alone).toMatch(/\*\*Dialogue\.\*\*/);
    expect(alone).toMatch(/A character's own thought/);
  });
});

describe('The register shift worked example (Slice 3c part 2)', () => {
  const [, registerExample] = CRAFT_FLAG_PROMPTS.register.map(readPrompt);
  const passage = section(registerExample, '## Passage', '## Response').replace('## Passage', '').trim();
  const frame = section(registerExample, '## Response', 'Nothing else is flagged').match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
  const root = readCraftFlagsFrame(frame).root;
  const reply = decodeCraftFlagsReply(root, 'register');

  it('reads through the production frame reader and codec, whole, every note and its register line shown as written', () => {
    expect(reply).toMatchObject({ malformed: 0, ignoredFields: 0, notesWithheld: 0 });
    expect(reply.findings.map((finding) => finding.kind)).toEqual(['ornate', 'jargon', 'slang', 'period']);
    expect(typeof root.register).toBe('string');
    // The register line names the period its period flag is read against, by its years, which only a register line may carry.
    expect(craftFlagPhrasingFault(root.register as string)).toBe('figure');
    expect(root.register).toMatch(/Victorian English of the 1860s/);
    for (const finding of reply.findings) {
      expect(finding.register).toBe(root.register);
    }
  });

  it('quotes words that anchor once in its passage, none in speech', () => {
    const speech = findSpeechSpans(passage);
    for (const finding of reply.findings) {
      const anchored = anchorQuote(passage, finding.anchor);
      expect({ quote: finding.anchor.quote, kind: anchored.kind }).toEqual({ quote: finding.anchor.quote, kind: 'anchored' });
      const { start, end } = anchored.kind === 'anchored' ? anchored : { start: 0, end: 0 };
      expect(speech.some((span) => span.start < end && start < span.end)).toBe(false);
    }
  });

  it('leaves the Rabbit\'s okay alone, inside its speech, and flags the narration\'s as slang, not as out of its period (PR #178 N-01)', () => {
    const speech = findSpeechSpans(passage);
    const okays = [...passage.matchAll(/\bokay\b/g)].map((match) => match.index ?? 0);
    expect(okays).toHaveLength(2);
    expect(okays.map((at) => speech.some((span) => span.start <= at && at < span.end))).toEqual([true, false]);
    const startOf = (kind: string) => {
      const finding = reply.findings.find((each) => each.kind === kind);
      const anchored = finding ? anchorQuote(passage, finding.anchor) : undefined;
      return anchored?.kind === 'anchored' ? anchored.start : -1;
    };
    expect(startOf('slang')).toBe(okays[1]);
    expect(startOf('period')).toBe(passage.indexOf('on autopilot'));
  });

  it('flags a word for its date only against a period the narration itself sets (PR #178 N-01)', () => {
    // The passage names its own summer; the period flag is read against it, not against the example's source.
    expect(passage).toContain('in the summer of 1862');
    expect(reply.findings.find((finding) => finding.kind === 'period')?.anchor.quote).toBe('on autopilot');
  });
});

describe('The gesture strain prompt (Slice 3c part 3)', () => {
  const [gesture] = CRAFT_FLAG_PROMPTS.gesture.map(readPrompt);
  const prose = gesture.replace(/\s+/g, ' ');

  it('defines its kinds in the domain\'s words, verbatim, and no others', () => {
    for (const kind of GESTURE_STRAIN_KINDS) {
      expect(gesture).toContain(`- \`${kind}\`: ${GESTURE_STRAIN_DEFINITIONS[kind]}.`);
    }
    const named = [...section(gesture, '## The kinds', '## What to leave alone').matchAll(/^- `([a-z]+)`:/gm)].map((match) => match[1]);
    expect(named).toEqual([...CRAFT_FLAG_KINDS.gesture]);
  });

  it('draws the line between an impossible gesture and an accepted figure of speech, with examples on both sides', () => {
    const impossible = section(gesture, '### Impossible', '### Complicated').replace(/\s+/g, ' ');
    expect(impossible).toContain('his eyes flew across the room');
    expect(impossible).toContain('Accepted figures of speech are not strain, and you never flag them');
    expect(impossible).toContain('her eyes dropped');
    expect(impossible).toContain('his gaze followed her');
  });

  it('flags a thin beat only where the chapter leans on it or it alone carries a turn, and leaves the counting to the host', () => {
    const thin = section(gesture, '### Thin', '### Redundant').replace(/\s+/g, ' ');
    expect(thin).toContain('a stock beat is never flagged for being one');
    expect(thin).toContain('where the chapter leans on it');
    expect(thin).toContain('where it alone carries the feeling at a turn in the scene');
    expect(thin).toContain('Never count beats yourself.');
  });

  it('reads a gesture in a dialogue beat, never words inside quotation marks, and leaves a gesture that contradicts its line', () => {
    const alone = section(gesture, '## What to leave alone', '## The note').replace(/\s+/g, ' ');
    expect(alone).toContain('Words inside quotation marks, double or single, are a character\'s own');
    expect(alone).toContain('A gesture in a dialogue beat or a speech tag, outside the quotation marks, is narration: read it.');
    expect(alone).toContain('A gesture that contradicts its line');
    // The shared rules defer to a category that says which uses to flag.
    expect(shared.replace(/\s+/g, ' ')).toContain('Flag each use you find, unless the category\'s own section says which uses to flag.');
    expect(prose).not.toContain('Flag each use');
  });
});

describe('The gesture strain worked example (Slice 3c part 3)', () => {
  const [, gestureExample] = CRAFT_FLAG_PROMPTS.gesture.map(readPrompt);
  const passage = section(gestureExample, '## Passage', '## Response').replace('## Passage', '').trim();
  const frame = section(gestureExample, '## Response', 'Nothing else is flagged').match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
  const reply = decodeCraftFlagsReply(readCraftFlagsFrame(frame).root, 'gesture');
  const speech = findSpeechSpans(passage);
  const issues: CraftFlagIssue[] = reply.findings.map((finding, index) => {
    const anchored = anchorQuote(passage, finding.anchor);
    const { start, end } = anchored.kind === 'anchored' ? anchored : { start: 0, end: 0 };
    return { id: `g${index}`, category: 'gesture', kind: finding.kind, start, end, original: passage.slice(start, end), why: finding.why };
  });

  it('reads through the production frame reader and codec, whole, every note shown as written, one flag of each kind', () => {
    expect(reply).toMatchObject({ malformed: 0, ignoredFields: 0, notesWithheld: 0 });
    expect(reply.findings.map((finding) => finding.kind)).toEqual(['redundant', 'impossible', 'complicated', 'thin']);
    for (const finding of reply.findings) {
      expect(finding.anchor.quote.length).toBeLessThanOrEqual(160);
    }
  });

  it('quotes words that anchor once in its passage, none in speech', () => {
    for (const finding of reply.findings) {
      const anchored = anchorQuote(passage, finding.anchor);
      expect({ quote: finding.anchor.quote, kind: anchored.kind }).toEqual({ quote: finding.anchor.quote, kind: 'anchored' });
    }
    for (const issue of issues) {
      expect(speech.some((span) => span.start < issue.end && issue.start < span.end)).toBe(false);
    }
  });

  it('flags the last of the sister\'s nods, and the host counts every nod in the narration beside each note that names one', () => {
    const thin = issues.find((issue) => issue.kind === 'thin');
    expect(thin?.start).toBe(passage.lastIndexOf('Her sister nodded'));
    const counted = withRepeats(issues, passage, speech);
    expect(counted.filter((issue) => issue.beats !== undefined).map((issue) => [issue.kind, issue.beats])).toEqual([
      ['redundant', [{ beat: 'nods', count: 4 }]],
      ['thin', [{ beat: 'nods', count: 4 }]]
    ]);
    expect(craftFlagMessage(counted.find((issue) => issue.kind === 'thin') ?? counted[0])).toMatch(/ Nods appear 4 times in this document\.$/);
  });

  it('leaves the sister\'s spoken shrug and the accepted figure alone', () => {
    const shrug = passage.indexOf('shrugging your shoulders');
    expect(speech.some((span) => span.start <= shrug && shrug < span.end)).toBe(true);
    expect(passage).toContain('Her eyes fell on its waistcoat');
    expect(reply.findings.some((finding) => /shrugging|fell on/.test(finding.anchor.quote))).toBe(false);
  });
});

describe('The continuity prompt (Slice 3c part 4)', () => {
  const [continuity] = CRAFT_FLAG_PROMPTS.continuity.map(readPrompt);
  const prose = continuity.replace(/\s+/g, ' ');

  it('defines its kinds in the domain\'s words, verbatim, and no others', () => {
    for (const kind of CONTINUITY_KINDS) {
      expect(continuity).toContain(`- \`${kind}\`: ${CONTINUITY_DEFINITIONS[kind]}.`);
    }
    const named = [...section(continuity, '## The kinds', '## What to leave alone').matchAll(/^- `([a-z]+)`:/gm)].map((match) => match[1]);
    expect(named).toEqual([...CRAFT_FLAG_KINDS.continuity]);
  });

  it('asks for both places quoted, the two facts side by side, which version the chapter keeps, and no suggestion', () => {
    const pair = section(continuity, '## The pair', '## The reply').replace(/\s+/g, ' ');
    expect(pair).toContain('`earlier`: the earlier place');
    expect(pair).toContain('Never say which one is right.');
    expect(pair).toContain('`holds`: which version the rest of the chapter keeps, when it keeps one: `earlier`, `later` or `neither`.');
    expect(pair).toContain('A continuity flag has no `suggestion`');
  });

  it('leaves alone a change the text explains, anything across a break it is told of, and dialogue on either side', () => {
    const alone = section(continuity, '## What to leave alone', '## The pair').replace(/\s+/g, ' ');
    expect(alone).toContain('`breaks` lists, in order, the lines that open each section of the chapter after the first');
    expect(alone).toContain('Never pair two places on different sides of one');
    expect(alone).toContain('never set a narration fact against a spoken one');
    expect(prose).toContain('A change the text explains');
  });
});

describe('The continuity worked example (Slice 3c part 4)', () => {
  const [, continuityExample] = CRAFT_FLAG_PROMPTS.continuity.map(readPrompt);
  const passage = section(continuityExample, '## Passage', '## Response').replace('## Passage', '').trim();
  const frame = section(continuityExample, '## Response', 'Nothing else is flagged').match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
  const reply = decodeCraftFlagsReply(readCraftFlagsFrame(frame).root, 'continuity');
  const speech = findSpeechSpans(passage);
  const place = (anchor: Parameters<typeof anchorQuote>[1]) => {
    const anchored = anchorQuote(passage, anchor);
    expect({ quote: anchor.quote, kind: anchored.kind }).toEqual({ quote: anchor.quote, kind: 'anchored' });
    return anchored.kind === 'anchored' ? { start: anchored.start, end: anchored.end } : { start: 0, end: 0 };
  };

  it('reads through the production frame reader and codec, whole, every note shown as written', () => {
    expect(reply).toMatchObject({ malformed: 0, ignoredFields: 0, notesWithheld: 0 });
    expect(reply.findings.map((finding) => [finding.kind, finding.holds])).toEqual([['place', undefined], ['body', 'earlier']]);
    expect(reply.findings.every((finding) => finding.earlier !== undefined && finding.suggestion === undefined)).toBe(true);
  });

  it('quotes both sides of each pair once, in narration, the earlier first, within one section', () => {
    const starts = chapterSectionStarts(passage);
    expect(starts).toEqual([passage.indexOf('* * *')]);
    for (const finding of reply.findings) {
      const later = place(finding.anchor);
      const earlier = place(finding.earlier!);
      expect(earlier.end).toBeLessThanOrEqual(later.start);
      for (const side of [earlier, later]) {
        expect(speech.some((span) => span.start < side.end && side.start < span.end)).toBe(false);
      }
      expect(starts.some((start) => earlier.start < start && start <= later.start)).toBe(false);
    }
  });

  it('leaves the Rabbit\'s spoken waistcoat, and the change across the break, alone', () => {
    const red = passage.indexOf('red waistcoat');
    expect(speech.some((span) => span.start <= red && red < span.end)).toBe(true);
    expect(passage.indexOf('cool of the evening')).toBeGreaterThan(passage.indexOf('* * *'));
    expect(reply.findings.some((finding) => /waistcoat|evening|afternoon|well/.test(`${finding.anchor.quote} ${finding.earlier?.quote}`))).toBe(false);
  });

  it('says, beside the eyes, that the chapter keeps the earlier version, and links the other side', () => {
    const eyes = reply.findings.find((finding) => finding.kind === 'body')!;
    const later = place(eyes.anchor);
    const earlier = place(eyes.earlier!);
    const issue = {
      id: 'c1', category: 'continuity' as const, kind: eyes.kind, ...later, original: passage.slice(later.start, later.end), why: eyes.why,
      related: [{ ...earlier, original: passage.slice(earlier.start, earlier.end) }], holds: eyes.holds
    };
    expect(craftFlagMessage(issue)).toMatch(/ The rest of the chapter keeps the earlier version\.$/);
    expect(craftFlagAnnotation(issue).related).toEqual([{ ...earlier, message: 'The other side of this pair: “pink eyes”' }]);
  });
});
