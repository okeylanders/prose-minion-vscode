/**
 * AI Resource Orchestrator - Application Layer
 * Orchestrates multi-turn conversations with agent capabilities (guide access, etc.)
 */

import * as vscode from 'vscode';
import { OpenRouterClient, OpenRouterMessage } from '../../infrastructure/api/OpenRouterClient';
import { GuideRegistry } from '../../infrastructure/guides/GuideRegistry';
import { GuideLoader } from '../../tools/shared/guides';
import { ConversationManager } from './ConversationManager';
import { ResourceRequestParser } from '../utils/ResourceRequestParser';

export interface AIOptions {
  includeCraftGuides?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ExecutionResult {
  content: string;
  usedGuides: string[];  // Paths of guides that were actually used
}

export type StatusCallback = (message: string, guideNames?: string) => void;

export class AIResourceOrchestrator {
  private readonly MAX_TURNS = 3; // Safety limit to prevent infinite loops

  constructor(
    private readonly openRouterClient: OpenRouterClient,
    private readonly conversationManager: ConversationManager,
    private readonly guideRegistry: GuideRegistry,
    private readonly guideLoader: GuideLoader,
    private readonly statusCallback?: StatusCallback,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    // Periodically clean up old conversations (every 5 minutes)
    setInterval(() => {
      this.conversationManager.clearOldConversations(300000); // 5 minutes
    }, 300000);
  }

  /**
   * Execute an AI request with agent capabilities support
   * Handles multi-turn conversations for guide requests
   */
  async executeWithAgentCapabilities(
    toolName: string,
    systemMessage: string,
    userMessage: string,
    options: AIOptions = {}
  ): Promise<ExecutionResult> {
    this.outputChannel?.appendLine(
      `\n[AIResourceOrchestrator] Starting conversation for ${toolName} (model: ${this.openRouterClient.getModel()})`
    );
    const conversationId = this.conversationManager.startConversation(toolName, systemMessage);
    const usedGuides: string[] = [];

    try {
      // Build first user message
      let firstUserMessage = userMessage;

      // Only include guide list if setting is enabled
      if (options.includeCraftGuides !== false) {
        const availableGuides = await this.guideRegistry.listAvailableGuides();
        const guideList = this.guideRegistry.formatGuideListForPrompt(availableGuides);
        firstUserMessage += `\n\n${guideList}`;
        this.outputChannel?.appendLine(`[AIResourceOrchestrator] Added ${availableGuides.length} guides to prompt`);

        // Log preview of the guide list format
        this.outputChannel?.appendLine(`[AIResourceOrchestrator] Guide list preview (first 800 chars):`);
        this.outputChannel?.appendLine(guideList.substring(0, 800));
        if (guideList.length > 800) {
          this.outputChannel?.appendLine('...');
        }
      }

      // Log preview of the complete user message
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] User message length: ${firstUserMessage.length} chars`);
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] User message preview (first 500 chars):`);
      this.outputChannel?.appendLine(firstUserMessage.substring(0, 500));
      this.outputChannel?.appendLine('...');

      // Turn 1: Initial request
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn 1: Sending initial request to AI`);
      this.conversationManager.addMessage(conversationId, {
        role: 'user',
        content: firstUserMessage
      });

      let messages = this.conversationManager.getMessages(conversationId);
      this.outputChannel?.appendLine(
        `[AIResourceOrchestrator] Calling OpenRouter API (${messages.length} messages in context) using model ${this.openRouterClient.getModel()}`
      );
      let response = await this.openRouterClient.createChatCompletion(messages, {
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Received response from AI (${response.length} chars)`);

      // Log preview of AI response to see what it's saying
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] AI response preview (first 500 chars):`);
      this.outputChannel?.appendLine(response.substring(0, 500));
      this.outputChannel?.appendLine('...');

      // Only check for guide requests if guides are enabled
      if (options.includeCraftGuides !== false) {
        let turnCount = 1;

        while (turnCount < this.MAX_TURNS) {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Checking for guide requests in response...`);
          const resourceRequest = ResourceRequestParser.parse(response);

          if (!resourceRequest.hasGuideRequest) {
            // No guide request - we're done
            this.outputChannel?.appendLine(`[AIResourceOrchestrator] No guide request found, conversation complete`);
            break;
          }

          this.outputChannel?.appendLine(`[AIResourceOrchestrator] AI requested ${resourceRequest.requestedGuides.length} guides:`);
          resourceRequest.requestedGuides.forEach((guide, index) => {
            this.outputChannel?.appendLine(`  ${index + 1}. ${guide}`);
          });

          // Notify UI that we're loading guides
          if (this.statusCallback && resourceRequest.requestedGuides.length > 0) {
            const guideNames = ResourceRequestParser.formatGuideNamesForStatus(
              resourceRequest.requestedGuides
            );
            this.statusCallback('Loading requested craft guides...', guideNames);
          }

          // Turn N: Fulfill guide request
          turnCount++;
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn ${turnCount}: Fulfilling guide request`);
          response = await this.fulfillGuideRequest(
            conversationId,
            response,
            resourceRequest.requestedGuides,
            options
          );

          // Track which guides were used
          usedGuides.push(...resourceRequest.requestedGuides);
        }

        if (turnCount >= this.MAX_TURNS) {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Conversation ${conversationId} reached max turns (${this.MAX_TURNS})`);
        }
      }

      // Clean up and return final response
      const cleanedResponse = ResourceRequestParser.stripResourceTags(response);
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Conversation complete. Used ${usedGuides.length} guides total\n`);

      return {
        content: cleanedResponse,
        usedGuides
      };
    } finally {
      // Clean up conversation after completion
      this.conversationManager.deleteConversation(conversationId);
    }
  }

  /**
   * Execute an AI request without guide-handling capabilities
   * Suitable for single-turn interactions that only need system + user prompts
   */
  async executeWithoutCapabilities(
    toolName: string,
    systemMessage: string,
    userMessage: string,
    options: AIOptions = {}
  ): Promise<ExecutionResult> {
    this.outputChannel?.appendLine(
      `\n[AIResourceOrchestrator] Starting single-turn request for ${toolName} (model: ${this.openRouterClient.getModel()})`
    );
    const conversationId = this.conversationManager.startConversation(toolName, systemMessage);

    try {
      this.conversationManager.addMessage(conversationId, {
        role: 'user',
        content: userMessage
      });

      const messages = this.conversationManager.getMessages(conversationId);
      this.outputChannel?.appendLine(
        `[AIResourceOrchestrator] Calling OpenRouter API (${messages.length} messages in context) using model ${this.openRouterClient.getModel()}`
      );
      const response = await this.openRouterClient.createChatCompletion(messages, {
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Received response from AI (${response.length} chars)\n`);

      return {
        content: response,
        usedGuides: []
      };
    } finally {
      this.conversationManager.deleteConversation(conversationId);
    }
  }

  /**
   * Fulfill a guide request by loading guides and continuing the conversation
   */
  private async fulfillGuideRequest(
    conversationId: string,
    assistantResponse: string,
    requestedGuidePaths: string[],
    options: AIOptions
  ): Promise<string> {
    // Add assistant's response (with guide request) to conversation
    this.conversationManager.addMessage(conversationId, {
      role: 'assistant',
      content: assistantResponse
    });

    // Load the requested guides
    const loadedGuides = await this.loadRequestedGuides(requestedGuidePaths);

    // Build user message with loaded guides
    const userMessage = this.buildGuideResponseMessage(loadedGuides);

    // Add user message with guides to conversation
    this.conversationManager.addMessage(conversationId, {
      role: 'user',
      content: userMessage
    });

    // Call API again with updated conversation
    const messages = this.conversationManager.getMessages(conversationId);
    return await this.openRouterClient.createChatCompletion(messages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });
  }

  /**
   * Load multiple guides by their paths
   */
  private async loadRequestedGuides(guidePaths: string[]): Promise<Map<string, string>> {
    const guides = new Map<string, string>();

    this.outputChannel?.appendLine(`[AIResourceOrchestrator] Loading ${guidePaths.length} requested guides...`);
    for (const path of guidePaths) {
      try {
        const content = await this.guideLoader.loadGuide(path);
        guides.set(path, content);
        this.outputChannel?.appendLine(`  ✓ Loaded: ${path} (${content.length} chars)`);
      } catch (error) {
        this.outputChannel?.appendLine(`  ✗ Failed to load: ${path} - ${error}`);
        guides.set(path, `[Guide not found: ${path}]`);
      }
    }

    return guides;
  }

  /**
   * Build the user message containing loaded guides
   */
  private buildGuideResponseMessage(guides: Map<string, string>): string {
    const lines = ['Here are the requested craft guides:', ''];

    for (const [path, content] of guides) {
      lines.push(`## Guide: ${path}`, '');
      lines.push(content);
      lines.push('', '---', '');
    }

    return lines.join('\n');
  }
}
