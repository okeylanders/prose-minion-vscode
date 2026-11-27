import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { getWorkshopPersona, WORKSHOP_HIGHLIGHTS_PROMPT_PATH } from '@shared/constants/workshopPersonas';
import { createFakeFileSystem } from '@/__tests__/mocks/platform';
import { placeWorkshopHighlights } from '@/application/services/workshop/highlights/placeWorkshopHighlights';
import { assembleWorkshopPersonaSystemPrompt } from '@/infrastructure/api/services/analysis/WorkshopPersonaSystemPrompt';
import { PromptLoader } from '@/tools/shared/prompts';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { WORKSHOP_HIGHLIGHTS_TAG } from '@/utils/workshopReplyHighlights';

const coreRoot = path.resolve(__dirname, '../../..');
const prompt = fs.readFileSync(path.join(coreRoot, 'resources/system-prompts', WORKSHOP_HIGHLIGHTS_PROMPT_PATH), 'utf8');

describe('Workshop highlights prompt', () => {
  it('teaches the codec budgets as written', () => {
    const prose = prompt.replace(/```[\s\S]*?```/g, '');
    const bounds = PROMPT_BUDGETS.workshopHighlights;
    const limits: ReadonlyArray<readonly [RegExp, readonly number[]]> = [
      [/title` of at most (\d+) characters/, [bounds.titleCharacters]],
      [/places` array of (\d+) to (\d+) entries/, [1, bounds.placesPerSet]],
      [/note` of at most (\d+) characters/, [bounds.noteCharacters]],
      [/Each of `quote`, `before` and `after` is at most (\d+) characters/, [bounds.quoteCharacters]]
    ];

    for (const [pattern, expected] of limits) {
      expect(prose.match(pattern)?.slice(1).map(Number)).toEqual(expected);
    }
    const unpinned = limits.reduce((remaining, [pattern]) => remaining.replace(pattern, ''), prose);
    expect(unpinned).not.toMatch(/\d/);
    expect(prose).toContain('When you find more matching places than the set can hold, tell the writer you found more and wait for them to ask for another set.');
  });

  it('decodes and places the worked example as written', () => {
    const examples = [...prompt.matchAll(/```xml\n([\s\S]*?)```/g)];
    expect(examples).toHaveLength(1);
    const trailer = examples[0][1].trim();
    expect(trailer.startsWith(`<${WORKSHOP_HIGHLIGHTS_TAG}>`)).toBe(true);
    expect(trailer.endsWith(`</${WORKSHOP_HIGHLIGHTS_TAG}>`)).toBe(true);

    const reply = 'I found where Mara puts on the blue sweater and where she slips away.';
    const controls = extractWorkshopReplyControls(`${reply}\n\n${trailer}`, { memoryOpen: false });
    expect(controls.rest).toBe(reply);
    expect(controls.highlights?.rejections).toEqual([]);
    const set = controls.highlights?.set;
    expect(set?.title).toBe("Mara's sweater and exit");
    expect(set?.places).toHaveLength(2);

    const source = prompt.match(/^> (.+)$/m)?.[1];
    if (!source || !set) {
      throw new Error('Missing example excerpt or highlights set');
    }
    const result = placeWorkshopHighlights(source, 'markdown', set);
    expect(result.placed.map(({ start, end, note }) => ({ start, quote: source.slice(start, end), note }))).toEqual([
      { start: source.lastIndexOf('wool sweater'), quote: 'wool sweater', note: 'This is the blue sweater Mara puts on.' },
      {
        start: source.indexOf('She pressed'),
        quote: 'She pressed an ear to the door. The stairwell was quiet. She slipped out.',
        note: 'Listening at the door leads into her quiet exit.'
      }
    ]);
    expect(Object.values(result.dropped)).toEqual([0, 0, 0, 0]);
  });

  it.each(['host', 'guest'] as const)('reaches the %s through the production prompt assembler and loader', async role => {
    const loader = new PromptLoader(coreRoot, createFakeFileSystem({ readFile: fs.promises.readFile }));
    const assembled = await assembleWorkshopPersonaSystemPrompt(loader, {
      role,
      persona: getWorkshopPersona(role === 'host' ? 'jill' : 'wren')!,
      behavior: DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
      writerProfile: DEFAULT_WORKSHOP_WRITER_PROFILE,
      grammars: { projectMemory: false, memorySuggestions: 'sparingly', fileEdits: false, personaReactions: false },
      widgetRecommendationInstruction: 'Widget instructions.'
    });
    expect(assembled.text.split(prompt)).toHaveLength(2);
    expect(assembled.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Workshop highlights', part: 'tool-use' })
    ]));
    expect(prompt).toContain('only when the writer asks you to mark passages in the file or accepts your offer');
    expect(prompt).toContain('Take the request from the writer\'s current message.');
    expect(prompt).toContain('Workshop saves a set with the reply only after the writer chooses **Keep highlights**.');
    expect(prompt).toContain('`Kind: file` and `Kind: editor-selection` both qualify.');
    expect(prompt).toContain('If there is no source frame for the current excerpt');
  });
});
