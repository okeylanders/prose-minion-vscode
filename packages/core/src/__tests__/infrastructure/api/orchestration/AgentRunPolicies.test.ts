import { AGENT_RUN_POLICIES, AGENT_RUN_ROUTE_MATRIX } from '@orchestration/AgentRunPolicies';

describe('agent-run caller-to-policy matrix', () => {
  it('keeps every migrated route on one explicit catalog, retention, visibility, and cleanup policy', () => {
    expect(AGENT_RUN_ROUTE_MATRIX.map(route => route.caller)).toEqual([
      'AssistantToolService dialogue/prose/writing sidebar',
      'WorkshopHandler tool runs',
      'WorkshopHandler persona host turns',
      'WorkshopHandler persona guest sidecars',
      'DictionaryService standard and parallel blocks',
      'CategorySearchService batches',
      'ContextAssistantService'
    ]);
    expect(AGENT_RUN_POLICIES.assistant).toMatchObject({ capabilityCatalog: 'guides', retention: 'discard', cleanupOwner: 'engine', onCapabilityLimit: 'forceFinalResponse' });
    expect(AGENT_RUN_POLICIES.workshopTool).toMatchObject({ capabilityCatalog: 'guides', retention: 'retain', cleanupOwner: 'workshop-session', onCapabilityLimit: 'forceFinalResponse' });
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
});
