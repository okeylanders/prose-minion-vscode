import { RunPolicy } from './AgentRunContracts';

const policy = (value: RunPolicy): RunPolicy => value;

/**
 * One source of truth for the caller-to-policy matrix. Route names are stable
 * test handles rather than UI labels.
 */
export const AGENT_RUN_POLICIES = {
  assistant: policy({
    id: 'assistant', resourceCatalog: 'guides', retention: 'discard',
    maxCapabilityRounds: 2, onCapabilityLimit: 'returnLastResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  assistantWithoutResources: policy({
    id: 'assistant-no-resources', resourceCatalog: 'none', retention: 'discard',
    maxCapabilityRounds: 0, onCapabilityLimit: 'returnLastResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  workshopTool: policy({
    id: 'workshop-tool', resourceCatalog: 'guides', retention: 'retain',
    maxCapabilityRounds: 2, onCapabilityLimit: 'returnLastResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'workshop-session'
  }),
  workshopToolWithoutResources: policy({
    id: 'workshop-tool-no-resources', resourceCatalog: 'none', retention: 'retain',
    maxCapabilityRounds: 0, onCapabilityLimit: 'returnLastResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'workshop-session'
  }),
  workshopHost: policy({
    id: 'workshop-host', resourceCatalog: 'none', retention: 'retain',
    maxCapabilityRounds: 0, onCapabilityLimit: 'returnLastResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'workshop-session'
  }),
  dictionary: policy({
    id: 'dictionary', resourceCatalog: 'none', retention: 'discard',
    maxCapabilityRounds: 0, onCapabilityLimit: 'returnLastResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  categorySearch: policy({
    id: 'category-search', resourceCatalog: 'none', retention: 'discard',
    maxCapabilityRounds: 0, onCapabilityLimit: 'returnLastResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'engine'
  }),
  context: policy({
    id: 'context', resourceCatalog: 'projectContext', retention: 'discard',
    maxCapabilityRounds: 2, onCapabilityLimit: 'forceFinalResponse',
    visibleArtifact: 'final-response', cleanupOwner: 'engine'
  })
} as const;

export const AGENT_RUN_ROUTE_MATRIX = [
  { caller: 'AssistantToolService dialogue/prose/writing sidebar', policy: AGENT_RUN_POLICIES.assistant },
  { caller: 'WorkshopHandler tool runs', policy: AGENT_RUN_POLICIES.workshopTool },
  { caller: 'WorkshopHandler persona host start', policy: AGENT_RUN_POLICIES.workshopHost },
  { caller: 'DictionaryService standard and parallel blocks', policy: AGENT_RUN_POLICIES.dictionary },
  { caller: 'CategorySearchService batches', policy: AGENT_RUN_POLICIES.categorySearch },
  { caller: 'ContextAssistantService', policy: AGENT_RUN_POLICIES.context }
] as const;
