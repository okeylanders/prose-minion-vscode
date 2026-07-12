/**
 * Result tool-name contracts for copy/save flows.
 *
 * These strings are wire values sent by webviews and interpreted by
 * FileOperationsHandler. Keep the mapping here so Workshop variation actions
 * and host-side file naming cannot drift independently.
 */

import { WorkshopToolId } from '../types/messages/workshop';
import { WORKSHOP_TOOL_CATALOG } from './workshopTools';

export const PROSE_RESULT_TOOL_NAME = 'prose_analysis';
export const DIALOGUE_RESULT_TOOL_NAME = 'dialogue_analysis';
export const WORKSHOP_PERSONA_RESULT_TOOL_NAME = 'workshop_persona';

export const WORKSHOP_RESULT_TOOL_NAMES: Readonly<Record<WorkshopToolId, string>> =
  WORKSHOP_TOOL_CATALOG.reduce((toolNames, tool) => {
    toolNames[tool.id] =
      tool.id === 'dialogue'
        ? DIALOGUE_RESULT_TOOL_NAME
        : tool.id === 'prose'
          ? PROSE_RESULT_TOOL_NAME
          : `writing_tools_${tool.id}`;
    return toolNames;
  }, {} as Record<WorkshopToolId, string>);

export const ASSISTANT_RESULT_FILE_PREFIXES: Readonly<Record<string, string>> = {
  [PROSE_RESULT_TOOL_NAME]: 'excerpt-assistant-prose-',
  [DIALOGUE_RESULT_TOOL_NAME]: 'excerpt-assistant-dialog-beats-',
  [WORKSHOP_RESULT_TOOL_NAMES.cliche]: 'cliche-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES.choreography]: 'choreography-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES.continuity]: 'continuity-check-',
  [WORKSHOP_RESULT_TOOL_NAMES['decision-points']]: 'decision-points-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES.editor]: 'editor-',
  [WORKSHOP_RESULT_TOOL_NAMES.fresh]: 'engagement-check-',
  [WORKSHOP_RESULT_TOOL_NAMES.gestures]: 'gesture-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES.placeholders]: 'placeholder-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES.repetition]: 'repetition-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES['show-and-tell']]: 'show-and-tell-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES['stock-and-signature']]: 'stock-signature-analysis-',
  [WORKSHOP_RESULT_TOOL_NAMES.style]: 'style-consistency-',
  [WORKSHOP_PERSONA_RESULT_TOOL_NAME]: 'workshop-persona-'
};

export function resultToolNameForWorkshopTool(toolId: WorkshopToolId): string {
  return WORKSHOP_RESULT_TOOL_NAMES[toolId];
}

export function assistantResultFilePrefix(toolName: string): string | undefined {
  return ASSISTANT_RESULT_FILE_PREFIXES[toolName];
}
