import { AnyAgentCapability, RunPolicy } from './AgentRunContracts';
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
    id: 'workshop-tool', capabilityCatalog: 'workshopToolContext', retention: 'retain',
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

/**
 * The ONE place that decides which policy a Workshop persona participant run
 * takes (Sprint 13C; PR #89 review #3/#12). A capability-bearing turn — host
 * or persona guest — runs under `workshopHost`; a capability-free retained
 * sidecar turn stays on the inert no-resources policy. Both
 * `AssistantToolService` participant call sites resolve through this function
 * so the route matrix below cannot silently drift from the runtime branch.
 */
export function resolveWorkshopParticipantPolicy(
  capability: AnyAgentCapability | undefined
): RunPolicy {
  return capability
    ? AGENT_RUN_POLICIES.workshopHost
    : AGENT_RUN_POLICIES.workshopToolWithoutResources;
}

export const AGENT_RUN_ROUTE_MATRIX = [
  { caller: 'AssistantToolService dialogue/prose/writing sidebar', policy: AGENT_RUN_POLICIES.assistant },
  { caller: 'WorkshopRoomHandler tool runs', policy: AGENT_RUN_POLICIES.workshopTool },
  { caller: 'WorkshopRoomHandler persona host turns', policy: AGENT_RUN_POLICIES.workshopHost },
  // Sprint 13C: guests are capability-bearing participants — the handler
  // mints a capability for every guest turn, so guest sidecars resolve to
  // `workshopHost` via resolveWorkshopParticipantPolicy. The no-resources
  // policy remains only as that function's capability-free fallback.
  { caller: 'WorkshopRoomHandler persona guest sidecars (resolveWorkshopParticipantPolicy)', policy: AGENT_RUN_POLICIES.workshopHost },
  { caller: 'DictionaryService standard and parallel blocks', policy: AGENT_RUN_POLICIES.dictionary },
  { caller: 'CategorySearchService batches', policy: AGENT_RUN_POLICIES.categorySearch },
  { caller: 'ContextAssistantService', policy: AGENT_RUN_POLICIES.context }
] as const;
