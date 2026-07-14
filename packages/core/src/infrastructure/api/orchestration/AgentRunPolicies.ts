import { RunPolicy } from './AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const policy = (value: RunPolicy): RunPolicy => value;

/** One source of truth for the caller-to-policy matrix. */
export const AGENT_RUN_POLICIES = {
  assistant: policy({
    id: 'assistant', capabilityCatalog: 'guides', retention: 'discard',
    maxCapabilityRounds: 2, maxCorrectionTurns: 1,
    onCapabilityLimit: 'forceFinalResponse', visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  assistantWithoutResources: policy({
    id: 'assistant-no-resources', capabilityCatalog: 'none', retention: 'discard',
    maxCapabilityRounds: 0, maxCorrectionTurns: 0,
    onCapabilityLimit: 'returnLastResponse', visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  workshopTool: policy({
    id: 'workshop-tool', capabilityCatalog: 'guides', retention: 'retain',
    maxCapabilityRounds: 2, maxCorrectionTurns: 1,
    onCapabilityLimit: 'forceFinalResponse', visibleArtifact: 'final-response', cleanupOwner: 'workshop-session'
  }),
  workshopToolWithoutResources: policy({
    id: 'workshop-tool-no-resources', capabilityCatalog: 'none', retention: 'retain',
    maxCapabilityRounds: 0, maxCorrectionTurns: 0,
    onCapabilityLimit: 'returnLastResponse', visibleArtifact: 'final-response', cleanupOwner: 'workshop-session'
  }),
  workshopHost: policy({
    id: 'workshop-host', capabilityCatalog: 'workshopPersona', retention: 'retain',
    maxCapabilityRounds: PROMPT_BUDGETS.workshopCapability.callsPerTurn,
    maxCorrectionTurns: 1,
    onCapabilityLimit: 'forceFinalResponse', visibleArtifact: 'final-response', cleanupOwner: 'workshop-session'
  }),
  dictionary: policy({
    id: 'dictionary', capabilityCatalog: 'none', retention: 'discard',
    maxCapabilityRounds: 0, maxCorrectionTurns: 0,
    onCapabilityLimit: 'returnLastResponse', visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  categorySearch: policy({
    id: 'category-search', capabilityCatalog: 'none', retention: 'discard',
    maxCapabilityRounds: 0, maxCorrectionTurns: 0,
    onCapabilityLimit: 'returnLastResponse', visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  context: policy({
    id: 'context', capabilityCatalog: 'projectContext', retention: 'discard',
    maxCapabilityRounds: 2, maxCorrectionTurns: 1,
    onCapabilityLimit: 'forceFinalResponse', visibleArtifact: 'final-response', cleanupOwner: 'engine'
  })
} as const;

export const AGENT_RUN_ROUTE_MATRIX = [
  { caller: 'AssistantToolService dialogue/prose/writing sidebar', policy: AGENT_RUN_POLICIES.assistant },
  { caller: 'WorkshopHandler tool runs', policy: AGENT_RUN_POLICIES.workshopTool },
  { caller: 'WorkshopHandler persona host turns', policy: AGENT_RUN_POLICIES.workshopHost },
  { caller: 'WorkshopHandler persona guest sidecars', policy: AGENT_RUN_POLICIES.workshopToolWithoutResources },
  { caller: 'DictionaryService standard and parallel blocks', policy: AGENT_RUN_POLICIES.dictionary },
  { caller: 'CategorySearchService batches', policy: AGENT_RUN_POLICIES.categorySearch },
  { caller: 'ContextAssistantService', policy: AGENT_RUN_POLICIES.context }
] as const;
