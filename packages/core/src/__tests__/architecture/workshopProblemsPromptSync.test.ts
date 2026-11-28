import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { getWorkshopPersona, WORKSHOP_PROBLEMS_CAPABILITY_PROMPT_PATH } from '@shared/constants/workshopPersonas';
import { createFakeFileSystem } from '@/__tests__/mocks/platform';
import {
  createWorkshopCapabilityInstruction,
  createWorkshopCapabilityTurnReminder,
  WorkshopCapabilityXmlCodec
} from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { assembleWorkshopPersonaSystemPrompt } from '@/infrastructure/api/services/analysis/WorkshopPersonaSystemPrompt';
import { PromptLoader } from '@/tools/shared/prompts';

const coreRoot = path.resolve(__dirname, '../../..');
const prompt = fs.readFileSync(path.join(coreRoot, 'resources/system-prompts', WORKSHOP_PROBLEMS_CAPABILITY_PROMPT_PATH), 'utf8');
const bounds = PROMPT_BUDGETS.workshopProblems;
const codec = new WorkshopCapabilityXmlCodec();

describe('the File Problems prompt', () => {
  it('teaches the result and wire limits', () => {
    const prose = prompt.replace(/```[\s\S]*?```/g, '');
    expect(prose).toContain(`can have up to ${PROMPT_BUDGETS.workshopResource.pathCharacters} characters.`);
    expect(prose).toContain(`returns up to ${bounds.rowsPerPage} diagnostics`);
    expect(prose).toContain(`up to ${bounds.sourceCharacters} characters of source, ${bounds.messageCharacters} of message and ${bounds.quoteCharacters} of quoted text`);
    expect(prose).toContain(`in up to ${PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits} decimal digits`);
    expect(prose).toContain('“Continue with start” and you need more, repeat the same file selector');
  });

  it('decodes the excerpt, configured file and continuation examples through the production codec', () => {
    const examples = [...prompt.matchAll(/```xml\n([\s\S]*?)```/g)].map(match => codec.inspect(match[1]));
    expect(examples).toEqual([
      { kind: 'request', request: { capability: 'problems.read', file: { kind: 'excerpt' } } },
      { kind: 'request', request: {
        capability: 'problems.read',
        file: { kind: 'configured', group: 'chapters', path: 'Drafts/Through the Looking-Glass.md' }
      } },
      { kind: 'request', request: { capability: 'problems.read', file: { kind: 'excerpt' }, start: bounds.rowsPerPage + 1 } }
    ]);
  });

  it.each(['host', 'guest'] as const)('loads once in the %s tool-use instructions', async role => {
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
      expect.objectContaining({ name: 'File Problems capability', part: 'tool-use' })
    ]));
  });

  it('points initial and continuing turns at the current Problems read', () => {
    expect(createWorkshopCapabilityInstruction()).toContain('problems.read grammar for current editor highlights and Problems');
    expect(createWorkshopCapabilityTurnReminder()).toContain('use a fresh problems.read');
    expect(prompt).toContain('Read a fresh snapshot when the writer asks about the current state');
  });
});
