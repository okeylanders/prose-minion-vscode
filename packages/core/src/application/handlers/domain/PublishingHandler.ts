/**
 * Publishing domain handler
 * Handles publishing standards operations
 */

import { SettingsStore } from '@/platform';
import {
  RequestPublishingStandardsDataMessage,
  SetPublishingPresetMessage,
  SetPublishingTrimMessage,
  PublishingStandardsDataMessage,
  MessageType,
  ErrorSource,
  ErrorMessage
} from '@messages';
import { StandardsService } from '@services/resources/StandardsService';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '../MessageRouter';

export class PublishingHandler {
  constructor(
    private readonly standardsService: StandardsService,
    private readonly postMessage: MessageTransport,
    private readonly settings: SettingsStore
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
      const genres = await this.standardsService.getGenres();
      const preset = (this.settings.get<string>('proseMinion', 'publishingStandards.preset') || 'none');
      const pageSizeKey = (this.settings.get<string>('proseMinion', 'publishingStandards.pageSizeKey') || '');

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

      void this.postMessage(message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to load publishing standards', msg);
    }
  }

  async handleSetPublishingPreset(message: SetPublishingPresetMessage): Promise<void> {
    try {
      const { preset } = message.payload;
      await this.settings.update('proseMinion', 'publishingStandards.preset', preset);
      await this.handleRequestPublishingStandardsData({} as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to update publishing preset', msg);
    }
  }

  async handleSetPublishingTrim(message: SetPublishingTrimMessage): Promise<void> {
    try {
      const { pageSizeKey } = message.payload;
      await this.settings.update('proseMinion', 'publishingStandards.pageSizeKey', pageSizeKey ?? '');
      await this.handleRequestPublishingStandardsData({} as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to update trim size', msg);
    }
  }
}
