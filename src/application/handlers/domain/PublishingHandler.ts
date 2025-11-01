/**
 * Publishing domain handler
 * Handles publishing standards operations
 */

import * as vscode from 'vscode';
import {
  RequestPublishingStandardsDataMessage,
  SetPublishingPresetMessage,
  SetPublishingTrimMessage,
  MessageType,
  ErrorSource
} from '../../../shared/types/messages';
import { PublishingStandardsRepository } from '../../../infrastructure/standards/PublishingStandardsRepository';

import { MessageRouter } from '../MessageRouter';

export class PublishingHandler {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly postMessage: (message: any) => void,
    private readonly sendError: (source: ErrorSource, message: string, details?: string) => void
  ) {}

  /**
   * Register message routes for publishing domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.REQUEST_PUBLISHING_STANDARDS_DATA, this.handleRequestPublishingStandardsData.bind(this));
    router.register(MessageType.SET_PUBLISHING_PRESET, this.handleSetPublishingPreset.bind(this));
    router.register(MessageType.SET_PUBLISHING_TRIM_SIZE, this.handleSetPublishingTrim.bind(this));
  }

  async handleRequestPublishingStandardsData(message: RequestPublishingStandardsDataMessage): Promise<void> {
    try {
      const repo = new PublishingStandardsRepository(this.extensionUri, this.outputChannel);
      const genres = await repo.getGenres();
      const config = vscode.workspace.getConfiguration('proseMinion');
      const preset = (config.get<string>('publishingStandards.preset') || 'none');
      const pageSizeKey = (config.get<string>('publishingStandards.pageSizeKey') || '');

      const payload = {
        type: MessageType.PUBLISHING_STANDARDS_DATA,
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
        })),
        timestamp: Date.now()
      } as const;

      this.postMessage(payload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to load publishing standards', msg);
    }
  }

  async handleSetPublishingPreset(message: SetPublishingPresetMessage): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update('publishingStandards.preset', message.preset, true);
      await this.handleRequestPublishingStandardsData({} as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to update publishing preset', msg);
    }
  }

  async handleSetPublishingTrim(message: SetPublishingTrimMessage): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update('publishingStandards.pageSizeKey', message.pageSizeKey ?? '', true);
      await this.handleRequestPublishingStandardsData({} as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('publishing', 'Failed to update trim size', msg);
    }
  }
}
