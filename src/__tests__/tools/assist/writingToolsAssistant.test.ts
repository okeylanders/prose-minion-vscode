/**
 * WritingToolsAssistant Tests
 *
 * Validates focus-based analysis for all 6 writing tools:
 * cliche, continuity, style, editor, fresh, repetition
 */

import { WritingToolsAssistant, WritingToolsFocus } from '@/tools/assist/writingToolsAssistant';

// Mock PromptLoader
const mockPromptLoader = {
  loadSharedPrompts: jest.fn().mockResolvedValue('Shared prompts content'),
  loadPrompts: jest.fn().mockResolvedValue('Tool prompts content')
};

// Mock AIResourceOrchestrator
const mockOrchestrator = {
  executeWithAgentCapabilities: jest.fn().mockResolvedValue({
    content: 'Analysis result content',
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
  })
};

// Mock OutputChannel
const mockOutputChannel = {
  appendLine: jest.fn()
};

describe('WritingToolsAssistant', () => {
  let assistant: WritingToolsAssistant;

  beforeEach(() => {
    jest.clearAllMocks();
    assistant = new WritingToolsAssistant(
      mockOrchestrator as any,
      mockPromptLoader as any,
      mockOutputChannel as any
    );
  });

  describe('analyze', () => {
    const focusModes: WritingToolsFocus[] = [
      'cliche',
      'continuity',
      'style',
      'editor',
      'fresh',
      'repetition'
    ];

    focusModes.forEach(focus => {
      it(`should analyze with focus="${focus}"`, async () => {
        const result = await assistant.analyze(
          { text: 'Test passage text' },
          { focus }
        );

        expect(mockOrchestrator.executeWithAgentCapabilities).toHaveBeenCalledWith(
          `writing-tools-${focus}`,
          expect.any(String), // system message
          expect.any(String), // user message
          expect.objectContaining({
            temperature: 0.7,
            maxTokens: 10000
          })
        );
        expect(result.content).toBe('Analysis result content');
      });
    });

    it('should include context text when provided', async () => {
      await assistant.analyze(
        {
          text: 'Test passage',
          contextText: 'Additional context information'
        },
        { focus: 'cliche' }
      );

      const userMessage = mockOrchestrator.executeWithAgentCapabilities.mock.calls[0][2];
      expect(userMessage).toContain('Additional context information');
      expect(userMessage).toContain('Supplemental Context');
    });

    it('should include source file URI when provided', async () => {
      await assistant.analyze(
        {
          text: 'Test passage',
          sourceFileUri: 'file:///path/to/chapter.md'
        },
        { focus: 'style' }
      );

      const userMessage = mockOrchestrator.executeWithAgentCapabilities.mock.calls[0][2];
      expect(userMessage).toContain('file:///path/to/chapter.md');
    });

    it('should pass streaming options through', async () => {
      const mockOnToken = jest.fn();
      const mockSignal = new AbortController().signal;

      await assistant.analyze(
        { text: 'Test passage' },
        {
          focus: 'editor',
          onToken: mockOnToken,
          signal: mockSignal
        }
      );

      expect(mockOrchestrator.executeWithAgentCapabilities).toHaveBeenCalledWith(
        'writing-tools-editor',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          onToken: mockOnToken,
          signal: mockSignal
        })
      );
    });

    it('should respect custom temperature and maxTokens', async () => {
      await assistant.analyze(
        { text: 'Test passage' },
        {
          focus: 'fresh',
          temperature: 0.9,
          maxTokens: 5000
        }
      );

      expect(mockOrchestrator.executeWithAgentCapabilities).toHaveBeenCalledWith(
        'writing-tools-fresh',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          temperature: 0.9,
          maxTokens: 5000
        })
      );
    });

    it('should log analysis start to output channel', async () => {
      await assistant.analyze(
        { text: 'Test passage' },
        { focus: 'repetition' }
      );

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[WritingToolsAssistant] Analyzing with focus="repetition"'
      );
    });
  });

  describe('prompt loading', () => {
    it('should load prompts for each focus mode', async () => {
      await assistant.analyze(
        { text: 'Test passage' },
        { focus: 'continuity' }
      );

      expect(mockPromptLoader.loadPrompts).toHaveBeenCalledWith([
        'writing-tools-assistant/00-writing-tools-base.md',
        'writing-tools-assistant/focus/continuity.md'
      ]);
    });

    it('should fallback to defaults when prompt loading fails', async () => {
      mockPromptLoader.loadPrompts.mockRejectedValueOnce(new Error('File not found'));

      const result = await assistant.analyze(
        { text: 'Test passage' },
        { focus: 'cliche' }
      );

      // Should still succeed with default instructions
      expect(result.content).toBe('Analysis result content');
      expect(mockOrchestrator.executeWithAgentCapabilities).toHaveBeenCalled();
    });
  });
});
