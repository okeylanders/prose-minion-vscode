/**
 * The Workshop persona system prompt, assembled and measured by section
 * (ADR 2026-11-18 D4). Moved from `AssistantToolService` unchanged in what it
 * writes: `workshopPersonaSystemPromptPaths` is still the one chain, loaded
 * through `PromptLoader.loadPrompts`, then the writer profile, standing
 * directives and the widget-recommendation contract.
 *
 * Measuring: each path is loaded again on its own and the parts are kept
 * only when, joined exactly as `loadPrompts` joins them, they rebuild the
 * text that was sent. A loader that cannot load one path at a time, or any
 * mismatch, yields no sections: the panel then shows the total alone, never
 * a breakdown of something other than the prompt.
 *
 * Display-safe: a section is a host name, its part and a token estimate.
 */

import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import {
  WORKSHOP_ANALYSIS_CAPABILITY_PROMPT_PATH,
  WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HELP_CAPABILITY_PROMPT_PATH,
  WORKSHOP_HIGHLIGHTS_PROMPT_PATH,
  WORKSHOP_HISTORY_CAPABILITY_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
  WORKSHOP_INTERACTION_MODE_PROMPT_PATHS,
  WORKSHOP_LENS_CAPABILITY_PROMPT_PATH,
  WORKSHOP_LOCATIONS_CAPABILITY_PROMPT_PATH,
  WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH,
  WORKSHOP_PROJECT_MEMORY_CAPABILITY_PROMPT_PATH,
  WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS,
  WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS,
  WORKSHOP_REACTIONS_PROMPT_PATH,
  WORKSHOP_RELATIONAL_CONTRACT_PROMPT_PATH,
  WORKSHOP_RELATIONAL_DEPTH_PROMPT_PATHS,
  WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH,
  WORKSHOP_TRANSCRIPT_RECALL_CAPABILITY_PROMPT_PATH,
  WORKSHOP_TODO_STATUS_PROMPT_PATH,
  WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH,
  WorkshopPersonaDescriptor,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';
import type { WorkshopConversationBehavior, WorkshopWriterProfile } from '@messages';
import type { WorkshopMemorySuggestionLevel } from '@shared/constants/workshopMemorySuggestions';
import { buildWorkshopWriterProfileFrame } from '@/utils/workshopWriterProfile';

/** The two lines the system prompt shows as (D1, D4). */
export type WorkshopSystemPromptPart = 'persona' | 'tool-use';

export interface WorkshopSystemPromptSection {
  part: WorkshopSystemPromptPart;
  name: string;
  tokens: number;
}

export interface WorkshopPersonaSystemPrompt {
  text: string;
  /** Absent when the parts could not be shown to rebuild `text` exactly. */
  sections?: WorkshopSystemPromptSection[];
}

/**
 * The prompt files that teach a capability, a trailer or its grammar. Every
 * other path is Persona and behavior: a new section is measured with no
 * further work, and moves to Tool-use instructions once it is listed here.
 */
export const WORKSHOP_TOOL_USE_PROMPT_PATHS: ReadonlySet<string> = new Set([
  WORKSHOP_ANALYSIS_CAPABILITY_PROMPT_PATH,
  WORKSHOP_TRANSCRIPT_RECALL_CAPABILITY_PROMPT_PATH,
  WORKSHOP_PROJECT_MEMORY_CAPABILITY_PROMPT_PATH,
  ...Object.values(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS),
  WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH,
  WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH,
  WORKSHOP_HELP_CAPABILITY_PROMPT_PATH,
  WORKSHOP_HISTORY_CAPABILITY_PROMPT_PATH,
  WORKSHOP_LENS_CAPABILITY_PROMPT_PATH,
  WORKSHOP_TODO_STATUS_PROMPT_PATH,
  WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH,
  WORKSHOP_HIGHLIGHTS_PROMPT_PATH,
  WORKSHOP_LOCATIONS_CAPABILITY_PROMPT_PATH
]);

const capitalized = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const keyed = (
  paths: Readonly<Record<string, string>>,
  lead: string
): Array<readonly [string, string]> =>
  Object.entries(paths).map(([key, path]) => [path, `${lead}: ${capitalized(key)}`] as const);

const NAMED_PATHS: ReadonlyMap<string, string> = new Map<string, string>([
  [WORKSHOP_HOST_BASE_PROMPT_PATH, 'Host charter'],
  [WORKSHOP_GUEST_BASE_PROMPT_PATH, 'Guest charter'],
  [WORKSHOP_ANALYSIS_CAPABILITY_PROMPT_PATH, 'Analysis capability'],
  [WORKSHOP_TRANSCRIPT_RECALL_CAPABILITY_PROMPT_PATH, 'Session recall capability'],
  [WORKSHOP_PROJECT_MEMORY_CAPABILITY_PROMPT_PATH, 'Project memory capability'],
  ...keyed(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS, 'Memory suggestions'),
  [WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH, 'File edit proposals'],
  [WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH, 'Reply edit offers'],
  [WORKSHOP_HELP_CAPABILITY_PROMPT_PATH, 'Help capability'],
  [WORKSHOP_HISTORY_CAPABILITY_PROMPT_PATH, 'File history capability'],
  [WORKSHOP_LENS_CAPABILITY_PROMPT_PATH, 'Lens capability'],
  [WORKSHOP_LOCATIONS_CAPABILITY_PROMPT_PATH, 'Context paths capability'],
  [WORKSHOP_TODO_STATUS_PROMPT_PATH, 'To-do status'],
  [WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH, 'Passage search requests'],
  [WORKSHOP_HIGHLIGHTS_PROMPT_PATH, 'Workshop highlights'],
  [WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH, 'Interaction contract'],
  ...keyed(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS, 'Interaction mode'),
  [WORKSHOP_RELATIONAL_CONTRACT_PROMPT_PATH, 'Relational contract'],
  ...keyed(WORKSHOP_RELATIONAL_DEPTH_PROMPT_PATHS, 'Relational depth'),
  [WORKSHOP_REACTIONS_PROMPT_PATH, 'Reactions'],
  [WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH, 'Persona reactions'],
  ...keyed(WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS, 'Reaction frequency')
]);

/** The host's name for a section: a table, the persona's own files, then the file name. */
export function workshopSystemPromptSectionName(path: string, persona: WorkshopPersonaDescriptor): string {
  if (path === persona.promptPath) return `Persona: ${persona.label}`;
  if (path === persona.expressionProfilePath) return 'Expression profile';
  if (path === persona.expressionCalibrationPath) return 'Expression calibration';
  const named = NAMED_PATHS.get(path);
  if (named) return named;
  const file = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
  return capitalized(file.replace(/[-_]+/g, ' ').trim()) || 'Section';
}

export const workshopSystemPromptSectionPart = (path: string): WorkshopSystemPromptPart =>
  WORKSHOP_TOOL_USE_PROMPT_PATHS.has(path) ? 'tool-use' : 'persona';

export interface WorkshopPersonaSystemPromptInput {
  role: 'host' | 'guest';
  persona: WorkshopPersonaDescriptor;
  behavior: WorkshopConversationBehavior;
  writerProfile: WorkshopWriterProfile;
  standingDirectiveFrames?: readonly string[];
  grammars: {
    projectMemory: boolean;
    memorySuggestions: WorkshopMemorySuggestionLevel;
    fileEdits: boolean;
    personaReactions: boolean;
  };
  widgetRecommendationInstruction: string;
}

export interface WorkshopSystemPromptLoader {
  loadPrompts(paths: string[]): Promise<string>;
  loadPrompt?(path: string): Promise<string>;
}

const PROMPT_SEPARATOR = '\n\n---\n\n';

export async function assembleWorkshopPersonaSystemPrompt(
  loader: WorkshopSystemPromptLoader,
  input: WorkshopPersonaSystemPromptInput
): Promise<WorkshopPersonaSystemPrompt> {
  const paths = workshopPersonaSystemPromptPaths(
    input.role === 'host' ? WORKSHOP_HOST_BASE_PROMPT_PATH : WORKSHOP_GUEST_BASE_PROMPT_PATH,
    input.persona,
    input.behavior,
    input.grammars
  );
  const chain = await loader.loadPrompts(paths);
  const profile = buildWorkshopWriterProfileFrame(input.writerProfile, input.behavior.relationalDepth);
  const directives = (input.standingDirectiveFrames ?? []).map((frame) => frame.trim()).filter(Boolean);
  // Personas may recommend (never commit) Conversation Widgets: the
  // contract rides every persona system message (ADR 2026-07-22).
  const text = [
    profile ? `${chain}\n\n${profile}` : chain,
    ...directives,
    input.widgetRecommendationInstruction
  ].join('\n\n');
  const sections = await measureChain(loader, paths, chain, input.persona);
  return {
    text,
    ...(sections ? {
      sections: [
        ...sections,
        ...(profile ? [section('persona', 'Writer profile', profile)] : []),
        ...(directives.length > 0 ? [section('persona', `Standing directives (${directives.length})`, ...directives)] : []),
        section('tool-use', 'Widget recommendations', input.widgetRecommendationInstruction)
      ]
    } : {})
  };
}

function section(part: WorkshopSystemPromptPart, name: string, ...texts: string[]): WorkshopSystemPromptSection {
  return { part, name, tokens: texts.reduce((sum, text) => sum + estimateTextTokens(text), 0) };
}

async function measureChain(
  loader: WorkshopSystemPromptLoader,
  paths: readonly string[],
  chain: string,
  persona: WorkshopPersonaDescriptor
): Promise<WorkshopSystemPromptSection[] | undefined> {
  if (!loader.loadPrompt) return undefined;
  try {
    const parts = await Promise.all(paths.map((path) => loader.loadPrompt!(path)));
    if (parts.join(PROMPT_SEPARATOR) !== chain) return undefined;
    return paths.map((path, index) =>
      section(workshopSystemPromptSectionPart(path), workshopSystemPromptSectionName(path, persona), parts[index]));
  } catch {
    return undefined;
  }
}
