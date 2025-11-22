/**
 * Publishing domain handler
 * Handles publishing standards operations
 */

import * as vscode from 'vscode';
import {
  RequestPublishingStandardsDataMessage,
  SetPublishingPresetMessage,
  SetPublishingTrimMessage,
  PublishingStandardsDataMessage,
  MessageType,
  ErrorSource,
  ErrorMessage
} from '@messages';
import { PublishingStandardsRepository } from '@/infrastructure/standards/PublishingStandardsRepository';

import { MessageRouter } from '../MessageRouter';

export class PublishingHandler {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly postMessage: (message: any) => Promise<void>
  ) {}

  /**
   * Register message routes for publishing domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.REQUEST_PUBLISHING_STANDARDS_DATA, this.handleRequestPublishingStandardsData.bind(this));
    router.register(MessageType.SET_PUBLISHING_PRESET, this.handleSetPublishingPreset.bind(this));
    router.register(MessageType.SET_PUBLISHING_TRIM_SIZE, this.handleSetPublishingTrim.bind(this));
  }

  // Helper methods (domain owns its message lifecycle)

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.publishing',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
  }

  // Message handlers

  async handleRequestPublishingStandardsData(message: RequestPublishingStandardsDataMessage): Promise<void> {
    try {
      const repo = new PublishingStandardsRepository(this.extensionUri);
      const genres = await repo.getGenres();
      const config = vscode.workspace.getConfiguration('proseMinion');
      const preset = (config.get<string>('publishingStandards.preset') || 'none');
      const pageSizeKey = (config.get<string>('publishingStandards.pageSizeKey') || '');

      const message: PublishingStandardsDataMessage = {
        type: MessageType.PUBLISHING_STANDARDS_DATA,
        source: 'extension.publishing',
        payload: {
          preset,
          pageSizeKey,
          genres: genres.map(g => ({
            key: (g.slug || g.abbreviation || g.name),
            name: g.name,
            abbreviation: g.abbreviation,
            pageSizes: g.page_sizes.map(ps => ({
              key: ps.format || `${ps.width_inches}x${ps.height_inches}`,
              label: ps.format || `${ps.width_inches}x${ps.height_inches}`,
              width: ps.width_inches,
              height: ps.height_inches,
              common: ps.common
            }))
          }))
        },
        timestamp: Date.now()
      };

      this.postMessage(message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to load publishing standards', msg);
    }
  }

  async handleSetPublishingPreset(message: SetPublishingPresetMessage): Promise<void> {
    try {
      const { preset } = message.payload;
      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update('publishingStandards.preset', preset, true);
      await this.handleRequestPublishingStandardsData({} as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to update publishing preset', msg);
    }
  }

  async handleSetPublishingTrim(message: SetPublishingTrimMessage): Promise<void> {
    try {
      const { pageSizeKey } = message.payload;
      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update('publishingStandards.pageSizeKey', pageSizeKey ?? '', true);
      await this.handleRequestPublishingStandardsData({} as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to update trim size', msg);
    }
  }
}
