import {
  AGENT_RUN_POLICIES,
  AGENT_RUN_ROUTE_MATRIX,
  resolveWorkshopParticipantPolicy
} from '@orchestration/AgentRunPolicies';
import type { AnyAgentCapability } from '@orchestration/AgentRunContracts';

describe('agent-run caller-to-policy matrix', () => {
  it('keeps every migrated route on one explicit catalog, retention, visibility, and cleanup policy', () => {
    expect(AGENT_RUN_ROUTE_MATRIX.map(route => route.caller)).toEqual([
      'AssistantToolService dialogue/prose/writing sidebar',
      'WorkshopHandler tool runs',
      'WorkshopHandler persona host turns',
      'WorkshopHandler persona guest sidecars (resolveWorkshopParticipantPolicy)',
      'DictionaryService standard and parallel blocks',
      'CategorySearchService batches',
      'ContextAssistantService'
    ]);
    expect(AGENT_RUN_POLICIES.assistant).toMatchObject({ capabilityCatalog: 'guides', retention: 'discard', cleanupOwner: 'engine', onCapabilityLimit: 'forceFinalResponse' });
    expect(AGENT_RUN_POLICIES.workshopTool).toMatchObject({ capabilityCatalog: 'workshopToolContext', retention: 'retain', cleanupOwner: 'workshop-session', onCapabilityLimit: 'forceFinalResponse' });
    expect(AGENT_RUN_POLICIES.workshopHost).toMatchObject({
      capabilityCatalog: 'workshopPersona',
      retention: 'retain',
      maxCapabilityRounds: 5,
      maxCorrectionTurns: 1,
      onCapabilityLimit: 'forceFinalResponse',
      cleanupOwner: 'workshop-session'
    });
    expect(AGENT_RUN_POLICIES.dictionary).toMatchObject({ capabilityCatalog: 'none', retention: 'discard' });
    expect(AGENT_RUN_POLICIES.categorySearch).toMatchObject({ capabilityCatalog: 'none', retention: 'discard' });
    expect(AGENT_RUN_POLICIES.context).toMatchObject({ capabilityCatalog: 'projectContext', retention: 'discard', onCapabilityLimit: 'forceFinalResponse' });
    for (const route of AGENT_RUN_ROUTE_MATRIX) {
      expect(route.policy.visibleArtifact).toBe('final-response');
    }
  });

  // PR #89 review #3 (Marcus + Stan): the matrix went stale because nothing
  // exercised the RUNTIME branch. This pins the selection function the two
  // AssistantToolService participant call sites resolve through.
  it('resolves a capability-bearing participant turn to workshopHost and a bare sidecar to no-resources', () => {
    const capability = { catalog: 'workshopPersona' } as unknown as AnyAgentCapability;
    expect(resolveWorkshopParticipantPolicy(capability)).toBe(AGENT_RUN_POLICIES.workshopHost);
    expect(resolveWorkshopParticipantPolicy(undefined)).toBe(AGENT_RUN_POLICIES.workshopToolWithoutResources);
    // And the matrix's guest row must agree with the capability-bearing branch,
    // because every 13C guest turn carries a capability.
    const guestRow = AGENT_RUN_ROUTE_MATRIX.find((route) => route.caller.includes('guest sidecars'));
    expect(guestRow?.policy).toBe(AGENT_RUN_POLICIES.workshopHost);
  });
});
