import { AGENT_RUN_POLICIES, AGENT_RUN_ROUTE_MATRIX } from '@orchestration/AgentRunPolicies';

describe('agent-run caller-to-policy matrix', () => {
  it('keeps every migrated route on one explicit catalog, retention, visibility, and cleanup policy', () => {
    expect(AGENT_RUN_ROUTE_MATRIX.map(route => route.caller)).toEqual([
      'AssistantToolService dialogue/prose/writing sidebar',
      'WorkshopHandler tool runs',
      'WorkshopHandler persona host start',
      'DictionaryService standard and parallel blocks',
      'CategorySearchService batches',
      'ContextAssistantService'
    ]);
    expect(AGENT_RUN_POLICIES.assistant).toMatchObject({ resourceCatalog: 'guides', retention: 'discard', cleanupOwner: 'engine' });
    expect(AGENT_RUN_POLICIES.workshopTool).toMatchObject({ resourceCatalog: 'guides', retention: 'retain', cleanupOwner: 'workshop-session' });
    expect(AGENT_RUN_POLICIES.workshopHost).toMatchObject({ resourceCatalog: 'none', retention: 'retain', cleanupOwner: 'workshop-session' });
    expect(AGENT_RUN_POLICIES.dictionary).toMatchObject({ resourceCatalog: 'none', retention: 'discard' });
    expect(AGENT_RUN_POLICIES.categorySearch).toMatchObject({ resourceCatalog: 'none', retention: 'discard' });
    expect(AGENT_RUN_POLICIES.context).toMatchObject({ resourceCatalog: 'projectContext', retention: 'discard', onCapabilityLimit: 'forceFinalResponse' });
    for (const route of AGENT_RUN_ROUTE_MATRIX) {
      expect(route.policy.visibleArtifact).toBe('final-response');
    }
  });
});
