/**
 * Deterministic Workshop quick actions, ported from the approved Direction B
 * prototype (`docs/design/pm-direction-b.js` ASSIST table). Labels are UI
 * copy, prompts are the follow-up text sent into the retained conversation.
 */

import { WorkshopToolId } from '../types/messages/workshop';
import { WORKSHOP_TOOL_CATALOG, workshopToolLabel } from './workshopTools';

export interface WorkshopQuickAction {
  label: string;
  prompt: string;
  primary?: boolean;
}

const variationPrompt = (toolId: WorkshopToolId, label: string): string =>
  `${label}. Return exactly three options in this markdown format:

### Variation 1 - [short label]
[the rewritten passage only]

### Variation 2 - [short label]
[the rewritten passage only]

### Variation 3 - [short label]
[the rewritten passage only]

Keep the variations focused on the ${workshopToolLabel(toolId)} lens.`;

const keepAsIsPrompt = (toolId: WorkshopToolId): string =>
  `Keep this excerpt as-is for now. Briefly name what is already working through the ${workshopToolLabel(toolId)} lens, then stop.`;

const makeActions = (
  toolId: WorkshopToolId,
  labels: readonly string[],
  prompts: Partial<Record<string, string>> = {}
): readonly WorkshopQuickAction[] =>
  labels.map((label, index) => ({
    label,
    primary: index === 0,
    prompt:
      prompts[label] ??
      (label.toLowerCase().includes('variation')
        ? variationPrompt(toolId, label)
        : label.toLowerCase() === 'keep as-is'
          ? keepAsIsPrompt(toolId)
          : `${label}. Stay in the ${workshopToolLabel(toolId)} lens and answer as a practical follow-up on the pinned excerpt.`)
  }));

const SPECIFIC_ACTIONS: Partial<Record<WorkshopToolId, readonly WorkshopQuickAction[]>> = {
  dialogue: makeActions('dialogue', [
    'Generate 3 tighter variations',
    'Add a gesture beat',
    'Show & Tell pass',
    'Flag clichés',
    'Keep as-is'
  ], {
    'Generate 3 tighter variations': variationPrompt('dialogue', 'Generate 3 tighter variations'),
    'Add a gesture beat':
      'Add one gesture beat that can replace or deepen the weakest dialogue beat. Keep it specific to the pinned excerpt.',
    'Show & Tell pass':
      'Run a Show & Tell pass on this same excerpt. Point out where the passage summarizes, where it dramatizes, and what one line-level change would improve the balance.',
    'Flag clichés':
      'Flag any cliches, stock gestures, or overfamiliar phrasing in this excerpt. Suggest fresher alternatives without flattening the voice.'
  }),
  prose: makeActions('prose', [
    'Rewrite for flow',
    'Strengthen the verbs',
    '3 line-level variations',
    'Tighten by 20%',
    'Keep as-is'
  ], {
    '3 line-level variations': variationPrompt('prose', '3 line-level variations'),
    'Rewrite for flow':
      'Rewrite the excerpt for smoother sentence flow while preserving meaning, voice, and point of view.',
    'Strengthen the verbs':
      'Identify the softest verbs in the excerpt and suggest stronger replacements. Include a revised version using the best choices.',
    'Tighten by 20%':
      'Tighten the excerpt by roughly 20% while preserving the essential beat and character intent.'
  }),
  gestures: makeActions('gestures', [
    'Vary the gesture',
    'Make it subtler',
    'Tie to voice guide',
    '3 variations',
    'Keep as-is'
  ], {
    '3 variations': variationPrompt('gestures', '3 variations'),
    'Vary the gesture':
      'Replace the weakest or most repeated gesture with a fresher physical beat. Explain why the new gesture carries the subtext better.',
    'Make it subtler':
      'Make the gesture work subtler and less explanatory while preserving the emotional signal.',
    'Tie to voice guide':
      'Reframe the gesture so it feels specific to the character voice implied by this excerpt, not a generic reaction.'
  }),
  choreography: makeActions('choreography', [
    'Map the blocking',
    'Fix the spatial jump',
    'Slow the motion down',
    '3 variations',
    'Keep as-is'
  ], {
    '3 variations': variationPrompt('choreography', '3 variations'),
    'Map the blocking':
      'Map the physical blocking in the excerpt. Name where each person seems to be, what movement is implied, and what is unclear.',
    'Fix the spatial jump':
      'Revise the excerpt to fix any spatial jump or teleporting movement while keeping the scene momentum.',
    'Slow the motion down':
      'Slow the movement by one beat so the choreography reads clearly without overexplaining it.'
  }),
  cliche: makeActions('cliche', [
    'Replace each flag',
    'Suggest fresh images',
    'Show only flagged lines',
    'Keep voice intact',
    'Keep as-is'
  ], {
    'Replace each flag':
      'For each cliche, stock phrase, or overfamiliar beat you flagged, provide a fresher replacement and explain the improvement in one sentence.',
    'Suggest fresh images':
      'Suggest fresher images or physical details for this excerpt while preserving the intended mood and genre register.',
    'Show only flagged lines':
      'Show only the lines or phrases that deserve attention, with a concise reason beside each.',
    'Keep voice intact':
      'Revise the flagged phrasing while keeping the authorial voice intact. Avoid polishing away personality.'
  }),
  repetition: makeActions('repetition', [
    'List all echoes',
    'Rewrite to vary',
    'Keep intentional repeats',
    '3 variations',
    'Keep as-is'
  ], {
    '3 variations': variationPrompt('repetition', '3 variations'),
    'List all echoes':
      'List repeated words, sentence structures, gestures, and rhythmic echoes in the excerpt. Separate intentional from accidental repetition.',
    'Rewrite to vary':
      'Rewrite the excerpt to reduce accidental repetition while preserving any repetition that feels intentional.',
    'Keep intentional repeats':
      'Name which repetitions are worth keeping and why, then suggest changes only for the accidental ones.'
  }),
  'show-and-tell': makeActions('show-and-tell', [
    'Dramatize the summary',
    'Find more tell',
    'Balance the ratio',
    '3 variations',
    'Keep as-is'
  ], {
    '3 variations': variationPrompt('show-and-tell', '3 variations'),
    'Dramatize the summary':
      'Choose the most summarized beat in the excerpt and dramatize it on the page. Keep the rewrite compact.',
    'Find more tell':
      'Find any telling in the excerpt that might deserve dramatization. If telling is the right choice, say why.',
    'Balance the ratio':
      'Assess the show-versus-tell balance in the excerpt and recommend one targeted line-level adjustment.'
  })
};

const FALLBACK_LABELS = ['Generate 3 variations', 'Go deeper', 'Try another angle', 'Keep as-is'] as const;

export const WORKSHOP_QUICK_ACTIONS_BY_TOOL: Readonly<Record<WorkshopToolId, readonly WorkshopQuickAction[]>> =
  WORKSHOP_TOOL_CATALOG.reduce((actionsByTool, tool) => {
    actionsByTool[tool.id] = SPECIFIC_ACTIONS[tool.id] ?? makeActions(tool.id, FALLBACK_LABELS);
    return actionsByTool;
  }, {} as Record<WorkshopToolId, readonly WorkshopQuickAction[]>);

export function workshopQuickActionsForTool(toolId: WorkshopToolId): readonly WorkshopQuickAction[] {
  return WORKSHOP_QUICK_ACTIONS_BY_TOOL[toolId];
}

export function workshopQuickActionPrompt(
  toolId: WorkshopToolId,
  label: string
): string | undefined {
  return WORKSHOP_QUICK_ACTIONS_BY_TOOL[toolId].find((action) => action.label === label)?.prompt;
}
