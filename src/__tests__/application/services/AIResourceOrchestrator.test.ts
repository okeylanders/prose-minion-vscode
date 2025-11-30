import { AIResourceOrchestrator } from '@orchestration/AIResourceOrchestrator';
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { ConversationManager } from '@orchestration/ConversationManager';
import { GuideRegistry } from '@/infrastructure/guides/GuideRegistry';
import { GuideLoader } from '@/tools/shared/guides';

// Mock dependencies
jest.mock('@providers/OpenRouterClient');
jest.mock('@orchestration/ConversationManager');
jest.mock('@/infrastructure/guides/GuideRegistry');
jest.mock('@/tools/shared/guides');

describe('AIResourceOrchestrator', () => {
  let orchestrator: AIResourceOrchestrator;
  let mockOpenRouterClient: jest.Mocked<OpenRouterClient>;
  let mockConversationManager: jest.Mocked<ConversationManager>;
  let mockGuideRegistry: jest.Mocked<GuideRegistry>;
  let mockGuideLoader: jest.Mocked<GuideLoader>;
  let mockOutputChannel: { appendLine: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockOpenRouterClient = {
      getModel: jest.fn().mockReturnValue('test-model'),
      createChatCompletion: jest.fn()
    } as unknown as jest.Mocked<OpenRouterClient>;

    mockConversationManager = {
      startConversation: jest.fn().mockReturnValue('conv-123'),
      addMessage: jest.fn(),
      getMessages: jest.fn().mockReturnValue([]),
      deleteConversation: jest.fn(),
      clearOldConversations: jest.fn()
    } as unknown as jest.Mocked<ConversationManager>;

    mockGuideRegistry = {
      listAvailableGuides: jest.fn().mockResolvedValue([
        { path: 'guide1.md', name: 'Guide 1' },
        { path: 'guide2.md', name: 'Guide 2' }
      ]),
      formatGuideListForPrompt: jest.fn().mockReturnValue('## Available Guides\n- guide1.md\n- guide2.md')
    } as unknown as jest.Mocked<GuideRegistry>;

    mockGuideLoader = {
      loadGuide: jest.fn()
    } as unknown as jest.Mocked<GuideLoader>;

    mockOutputChannel = {
      appendLine: jest.fn()
    };

    orchestrator = new AIResourceOrchestrator(
      mockOpenRouterClient,
      mockConversationManager,
      mockGuideRegistry,
      mockGuideLoader,
      undefined, // statusCallback
      mockOutputChannel as any
    );
  });

  afterEach(() => {
    orchestrator.dispose();
  });

  describe('executeWithAgentCapabilities - 3-Turn Guide Request Flow', () => {
    it('should handle 3 turns: user → guide request → fulfill → guide request → fulfill → final response', async () => {
      // Turn 1: AI requests first guide (note: array format required)
      const turn1Response = {
        content: 'I need more context. <guide-request path=["dialogue-tags.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.001 }
      };

      // Turn 2: AI requests second guide
      const turn2Response = {
        content: 'Thanks for that guide. I also need: <guide-request path=["action-beats.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 200, completionTokens: 75, totalTokens: 275, costUsd: 0.002 }
      };

      // Turn 3: AI provides final response (no more guide requests)
      const turn3Response = {
        content: '## Analysis\n\nBased on the guides, here is my analysis of the dialogue...',
        finishReason: 'stop',
        usage: { promptTokens: 300, completionTokens: 100, totalTokens: 400, costUsd: 0.003 }
      };

      // Setup mock responses in sequence
      mockOpenRouterClient.createChatCompletion
        .mockResolvedValueOnce(turn1Response)
        .mockResolvedValueOnce(turn2Response)
        .mockResolvedValueOnce(turn3Response);

      // Setup guide loader to return guide content
      mockGuideLoader.loadGuide
        .mockResolvedValueOnce('# Dialogue Tags Guide\n\nContent about dialogue tags...')
        .mockResolvedValueOnce('# Action Beats Guide\n\nContent about action beats...');

      // Execute
      const result = await orchestrator.executeWithAgentCapabilities(
        'dialogue-analysis',
        'You are a prose assistant.',
        'Analyze this dialogue: "Hello," she said.',
        { includeCraftGuides: true }
      );

      // Verify 3 API calls were made
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(3);

      // Verify conversation flow
      expect(mockConversationManager.startConversation).toHaveBeenCalledWith(
        'dialogue-analysis',
        'You are a prose assistant.'
      );

      // Verify messages were added (user message + 2 assistant responses + 2 guide fulfillments)
      // Initial user message + guide list
      expect(mockConversationManager.addMessage).toHaveBeenCalledTimes(5);

      // Verify guides were loaded
      expect(mockGuideLoader.loadGuide).toHaveBeenCalledTimes(2);
      expect(mockGuideLoader.loadGuide).toHaveBeenCalledWith('dialogue-tags.md');
      expect(mockGuideLoader.loadGuide).toHaveBeenCalledWith('action-beats.md');

      // Verify final result
      expect(result.content).toBe('## Analysis\n\nBased on the guides, here is my analysis of the dialogue...');
      expect(result.usedGuides).toEqual(['dialogue-tags.md', 'action-beats.md']);

      // Verify token usage was aggregated across all turns
      expect(result.usage).toEqual({
        promptTokens: 600, // 100 + 200 + 300
        completionTokens: 225, // 50 + 75 + 100
        totalTokens: 825, // 150 + 275 + 400
        costUsd: 0.006 // 0.001 + 0.002 + 0.003
      });

      // Verify conversation was cleaned up
      expect(mockConversationManager.deleteConversation).toHaveBeenCalledWith('conv-123');

      // Verify output channel logging
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Turn 1: Sending initial request')
      );
    });

    it('should stop at MAX_TURNS (3) even if AI keeps requesting guides', async () => {
      // All 3 turns request guides
      const guideRequestResponse = {
        content: '<guide-request path=["endless-guide.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValue(guideRequestResponse);
      mockGuideLoader.loadGuide.mockResolvedValue('# Guide Content');

      const result = await orchestrator.executeWithAgentCapabilities(
        'test-tool',
        'System message',
        'User message',
        { includeCraftGuides: true }
      );

      // Should stop at 3 turns (MAX_TURNS)
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(3);

      // Result should have the guide request stripped (empty after stripping)
      expect(result.content).toBe('');

      // Should have logged max turns warning
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('reached max turns (3)')
      );
    });

    it('should complete in 1 turn if no guide is requested', async () => {
      const immediateResponse = {
        content: '## Analysis\n\nHere is my immediate analysis without needing guides.',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValueOnce(immediateResponse);

      const result = await orchestrator.executeWithAgentCapabilities(
        'test-tool',
        'System message',
        'User message',
        { includeCraftGuides: true }
      );

      // Only 1 API call
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(1);

      // No guides loaded
      expect(mockGuideLoader.loadGuide).not.toHaveBeenCalled();

      // Result should be the immediate response
      expect(result.content).toBe('## Analysis\n\nHere is my immediate analysis without needing guides.');
      expect(result.usedGuides).toEqual([]);

      // Should have logged "conversation complete"
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('No guide request found, conversation complete')
      );
    });

    it('should skip guide handling when includeCraftGuides is false', async () => {
      const responseWithGuideTag = {
        content: 'Response with <guide-request path=["ignored.md"] /> that should not be processed',
        finishReason: 'stop'
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValueOnce(responseWithGuideTag);

      const result = await orchestrator.executeWithAgentCapabilities(
        'test-tool',
        'System message',
        'User message',
        { includeCraftGuides: false }
      );

      // Only 1 API call (no guide fulfillment loop)
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(1);

      // Guide registry should not be called
      expect(mockGuideRegistry.listAvailableGuides).not.toHaveBeenCalled();

      // Guide loader should not be called
      expect(mockGuideLoader.loadGuide).not.toHaveBeenCalled();

      // Response still has tag stripped (stripResourceTags is always called)
      expect(result.content).toBe('Response with  that should not be processed');
    });

    it('should handle guide loading failure gracefully', async () => {
      const turn1Response = {
        content: '<guide-request path=["missing-guide.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };

      const turn2Response = {
        content: '## Analysis\n\nI could not find the guide but here is my analysis.',
        finishReason: 'stop',
        usage: { promptTokens: 150, completionTokens: 100, totalTokens: 250 }
      };

      mockOpenRouterClient.createChatCompletion
        .mockResolvedValueOnce(turn1Response)
        .mockResolvedValueOnce(turn2Response);

      // Guide loader throws error
      mockGuideLoader.loadGuide.mockRejectedValueOnce(new Error('Guide not found'));

      const result = await orchestrator.executeWithAgentCapabilities(
        'test-tool',
        'System message',
        'User message',
        { includeCraftGuides: true }
      );

      // Should still complete with 2 API calls
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(2);

      // Guide should be tracked even though it failed
      expect(result.usedGuides).toEqual(['missing-guide.md']);

      // Should have logged the failure
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load: missing-guide.md')
      );
    });

    it('should append truncation note when finish_reason is length', async () => {
      const truncatedResponse = {
        content: 'This response was truncated...',
        finishReason: 'length',
        usage: { promptTokens: 100, completionTokens: 10000, totalTokens: 10100 }
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValueOnce(truncatedResponse);

      const result = await orchestrator.executeWithAgentCapabilities(
        'test-tool',
        'System message',
        'User message',
        { includeCraftGuides: true }
      );

      expect(result.content).toContain('This response was truncated...');
      expect(result.content).toContain('⚠️ Response truncated');
    });
  });

  describe('Message Flow Verification', () => {
    it('should add messages in correct order during 2-turn flow', async () => {
      const turn1Response = {
        content: '<guide-request path=["test-guide.md"] />',
        finishReason: 'stop'
      };

      const turn2Response = {
        content: 'Final analysis',
        finishReason: 'stop'
      };

      mockOpenRouterClient.createChatCompletion
        .mockResolvedValueOnce(turn1Response)
        .mockResolvedValueOnce(turn2Response);

      mockGuideLoader.loadGuide.mockResolvedValueOnce('Guide content');

      await orchestrator.executeWithAgentCapabilities(
        'test-tool',
        'System message',
        'User message',
        { includeCraftGuides: true }
      );

      // Verify message order:
      // 1. Initial user message (with guide list appended)
      // 2. Assistant response (guide request)
      // 3. User message (guide content)
      const addMessageCalls = mockConversationManager.addMessage.mock.calls;

      expect(addMessageCalls[0][1].role).toBe('user');
      expect(addMessageCalls[0][1].content).toContain('User message');
      expect(addMessageCalls[0][1].content).toContain('Available Guides');

      expect(addMessageCalls[1][1].role).toBe('assistant');
      expect(addMessageCalls[1][1].content).toContain('guide-request');

      expect(addMessageCalls[2][1].role).toBe('user');
      expect(addMessageCalls[2][1].content).toContain('Guide content');
    });
  });

  describe('executeWithContextResources - Context Resource Request Flow', () => {
    let mockResourceProvider: {
      loadResources: jest.Mock;
    };
    let mockResourceCatalog: Array<{
      path: string;
      label: string;
      group: string;
      isProjectBrief?: boolean;
    }>;

    beforeEach(() => {
      // Create mock resource provider
      mockResourceProvider = {
        loadResources: jest.fn()
      };

      // Create mock resource catalog
      mockResourceCatalog = [
        { path: 'characters/protagonist.md', label: 'Main Character', group: 'projectBrief', isProjectBrief: true },
        { path: 'world/setting.md', label: 'World Setting', group: 'projectBrief', isProjectBrief: true },
        { path: 'chapters/chapter-01.md', label: 'Chapter 1', group: 'manuscript' },
        { path: 'chapters/chapter-02.md', label: 'Chapter 2', group: 'manuscript' }
      ];
    });

    it('should handle max turns recovery when all 3 turns return resource requests', async () => {
      // All 3 regular turns request resources
      const resourceRequestResponse = {
        content: '<context-request path=["characters/protagonist.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.001 }
      };

      // Recovery turn should produce actual output
      const recoveryResponse = {
        content: '## Context Summary\n\nBased on the resources provided, here is the context briefing...',
        finishReason: 'stop',
        usage: { promptTokens: 200, completionTokens: 150, totalTokens: 350, costUsd: 0.002 }
      };

      // Setup mock responses: 3 resource requests + 1 recovery
      mockOpenRouterClient.createChatCompletion
        .mockResolvedValueOnce(resourceRequestResponse)
        .mockResolvedValueOnce(resourceRequestResponse)
        .mockResolvedValueOnce(resourceRequestResponse)
        .mockResolvedValueOnce(recoveryResponse);

      // Setup resource provider to return content
      mockResourceProvider.loadResources.mockResolvedValue([
        {
          path: 'characters/protagonist.md',
          content: '# Protagonist\n\nMain character details...',
          group: 'projectBrief',
          workspaceFolder: 'my-project'
        }
      ]);

      // Execute
      const result = await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing for chapter 5.',
        mockResourceProvider as any,
        mockResourceCatalog as any,
        {}
      );

      // Verify 4 API calls were made (3 regular + 1 recovery)
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(4);

      // Verify recovery message was added
      const addMessageCalls = mockConversationManager.addMessage.mock.calls;
      const recoveryMessageCall = addMessageCalls.find(call =>
        call[1].role === 'user' &&
        call[1].content.includes('reached the maximum number of resource requests')
      );
      expect(recoveryMessageCall).toBeDefined();
      expect(recoveryMessageCall![1].content).toContain('Please produce your context briefing NOW');

      // Verify token usage was aggregated across all turns (including recovery)
      // Turn 1 (100+50), Turn 2 (100+50), Turn 3 (100+50), Recovery (200+150)
      expect(result.usage).toEqual({
        promptTokens: 500, // 100 + 100 + 100 + 200
        completionTokens: 300, // 50 + 50 + 50 + 150
        totalTokens: 800, // 150 + 150 + 150 + 350
        costUsd: 0.005 // 0.001 + 0.001 + 0.001 + 0.002
      });

      // Verify final content is non-empty and stripped of tags
      expect(result.content).toBe('## Context Summary\n\nBased on the resources provided, here is the context briefing...');
      expect(result.requestedResources).toContain('characters/protagonist.md');

      // Verify output channel logged the recovery
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Final turn was still a resource request - forcing output generation')
      );
    });

    it('should handle normal 2-turn flow: request resources on turn 1, output on turn 2', async () => {
      // Turn 1: AI requests resources
      const turn1Response = {
        content: 'I need context. <context-request path=["characters/protagonist.md", "world/setting.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.001 }
      };

      // Turn 2: AI provides final output (no more requests)
      const turn2Response = {
        content: '## Context Summary\n\nThe protagonist is described as brave and curious. The setting is a medieval fantasy world.',
        finishReason: 'stop',
        usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500, costUsd: 0.003 }
      };

      mockOpenRouterClient.createChatCompletion
        .mockResolvedValueOnce(turn1Response)
        .mockResolvedValueOnce(turn2Response);

      mockResourceProvider.loadResources.mockResolvedValueOnce([
        {
          path: 'characters/protagonist.md',
          content: '# Protagonist\n\nBrave and curious...',
          group: 'projectBrief'
        },
        {
          path: 'world/setting.md',
          content: '# Setting\n\nMedieval fantasy world...',
          group: 'projectBrief'
        }
      ]);

      const result = await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing.',
        mockResourceProvider as any,
        mockResourceCatalog as any,
        {}
      );

      // Verify 2 API calls
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(2);

      // Verify resources were loaded
      expect(mockResourceProvider.loadResources).toHaveBeenCalledTimes(1);
      expect(mockResourceProvider.loadResources).toHaveBeenCalledWith([
        'characters/protagonist.md',
        'world/setting.md'
      ]);

      // Verify final result
      expect(result.content).toContain('The protagonist is described as brave and curious');
      expect(result.requestedResources).toEqual([
        'characters/protagonist.md',
        'world/setting.md'
      ]);

      // Verify token usage aggregated
      expect(result.usage).toEqual({
        promptTokens: 400, // 100 + 300
        completionTokens: 250, // 50 + 200
        totalTokens: 650, // 150 + 500
        costUsd: 0.004 // 0.001 + 0.003
      });

      // Should not have triggered recovery
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(
        expect.stringContaining('forcing output generation')
      );
    });

    it('should complete in 1 turn if no resources are requested', async () => {
      const immediateResponse = {
        content: '## Context Summary\n\nBased on the existing knowledge, here is the context briefing.',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 150, totalTokens: 250, costUsd: 0.002 }
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValueOnce(immediateResponse);

      const result = await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing.',
        mockResourceProvider as any,
        mockResourceCatalog as any,
        {}
      );

      // Only 1 API call
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(1);

      // No resources loaded
      expect(mockResourceProvider.loadResources).not.toHaveBeenCalled();

      // Result should be immediate response
      expect(result.content).toBe('## Context Summary\n\nBased on the existing knowledge, here is the context briefing.');
      expect(result.requestedResources).toEqual([]);

      // Should have logged "conversation complete"
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('No resource request found in turn 1, conversation complete')
      );
    });

    it('should handle empty resource loads gracefully', async () => {
      // Turn 1: AI requests resources
      const turn1Response = {
        content: '<context-request path=["nonexistent/file.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };

      // Turn 2: AI adapts to empty response
      const turn2Response = {
        content: '## Context Summary\n\nNo additional resources were available, proceeding with available information.',
        finishReason: 'stop',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
      };

      mockOpenRouterClient.createChatCompletion
        .mockResolvedValueOnce(turn1Response)
        .mockResolvedValueOnce(turn2Response);

      // Resource provider returns empty array
      mockResourceProvider.loadResources.mockResolvedValueOnce([]);

      const result = await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing.',
        mockResourceProvider as any,
        mockResourceCatalog as any,
        {}
      );

      // Verify 2 API calls
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(2);

      // Verify user message indicated no resources found
      const addMessageCalls = mockConversationManager.addMessage.mock.calls;
      const resourceResponseCall = addMessageCalls.find(call =>
        call[1].role === 'user' &&
        call[1].content.includes('No project resources were found')
      );
      expect(resourceResponseCall).toBeDefined();
      expect(resourceResponseCall![1].content).toContain('nonexistent/file.md');

      // Verify AI adapted
      expect(result.content).toContain('No additional resources were available');
      expect(result.requestedResources).toEqual([]);

      // Should have logged "No project resources matched"
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('No project resources matched the AI request')
      );
    });

    it('should handle 3-turn flow with multiple resource requests', async () => {
      // Turn 1: Request first batch
      const turn1Response = {
        content: '<context-request path=["characters/protagonist.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.001 }
      };

      // Turn 2: Request second batch
      const turn2Response = {
        content: 'Thanks. I also need: <context-request path=["world/setting.md"] />',
        finishReason: 'stop',
        usage: { promptTokens: 200, completionTokens: 75, totalTokens: 275, costUsd: 0.002 }
      };

      // Turn 3: Final output
      const turn3Response = {
        content: '## Context Summary\n\nCombined context from protagonist and setting...',
        finishReason: 'stop',
        usage: { promptTokens: 300, completionTokens: 150, totalTokens: 450, costUsd: 0.003 }
      };

      mockOpenRouterClient.createChatCompletion
        .mockResolvedValueOnce(turn1Response)
        .mockResolvedValueOnce(turn2Response)
        .mockResolvedValueOnce(turn3Response);

      mockResourceProvider.loadResources
        .mockResolvedValueOnce([
          { path: 'characters/protagonist.md', content: 'Character details...', group: 'projectBrief' }
        ])
        .mockResolvedValueOnce([
          { path: 'world/setting.md', content: 'Setting details...', group: 'projectBrief' }
        ]);

      const result = await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing.',
        mockResourceProvider as any,
        mockResourceCatalog as any,
        {}
      );

      // Verify 3 API calls
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(3);

      // Verify both resource loads
      expect(mockResourceProvider.loadResources).toHaveBeenCalledTimes(2);
      expect(mockResourceProvider.loadResources).toHaveBeenNthCalledWith(1, ['characters/protagonist.md']);
      expect(mockResourceProvider.loadResources).toHaveBeenNthCalledWith(2, ['world/setting.md']);

      // Verify all resources tracked
      expect(result.requestedResources).toEqual([
        'characters/protagonist.md',
        'world/setting.md'
      ]);

      // Verify token usage aggregated
      expect(result.usage).toEqual({
        promptTokens: 600, // 100 + 200 + 300
        completionTokens: 275, // 50 + 75 + 150
        totalTokens: 875, // 150 + 275 + 450
        costUsd: 0.006 // 0.001 + 0.002 + 0.003
      });
    });

    it('should log catalog with projectBrief items highlighted', async () => {
      const response = {
        content: '## Context Summary\n\nImmediate response.',
        finishReason: 'stop'
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValueOnce(response);

      await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing.',
        mockResourceProvider as any,
        mockResourceCatalog as any,
        {}
      );

      // Verify catalog was logged
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Context resource catalog (4 entries)')
      );

      // Verify projectBrief items logged with their group
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[projectBrief] characters/protagonist.md')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[projectBrief] world/setting.md')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[manuscript] chapters/chapter-01.md')
      );
    });

    it('should append truncation note when finish_reason is length', async () => {
      const truncatedResponse = {
        content: 'This context summary was truncated...',
        finishReason: 'length',
        usage: { promptTokens: 100, completionTokens: 10000, totalTokens: 10100 }
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValueOnce(truncatedResponse);

      const result = await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing.',
        mockResourceProvider as any,
        mockResourceCatalog as any,
        {}
      );

      expect(result.content).toContain('This context summary was truncated...');
      expect(result.content).toContain('⚠️ Response truncated');
    });

    it('should handle empty catalog gracefully', async () => {
      const response = {
        content: '## Context Summary\n\nNo catalog available.',
        finishReason: 'stop'
      };

      mockOpenRouterClient.createChatCompletion.mockResolvedValueOnce(response);

      await orchestrator.executeWithContextResources(
        'context-generation',
        'You are a context assistant.',
        'Generate a context briefing.',
        mockResourceProvider as any,
        [], // Empty catalog
        {}
      );

      // Should log empty catalog message
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Context resource catalog is empty')
      );

      // Should still complete successfully
      expect(mockOpenRouterClient.createChatCompletion).toHaveBeenCalledTimes(1);
    });
  });
});
