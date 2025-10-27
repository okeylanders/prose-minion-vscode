/**
 * Publishing domain messages
 * Publishing standards and genre presets
 */

import { BaseMessage, MessageType } from './base';

export interface RequestPublishingStandardsDataMessage extends BaseMessage {
  type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA;
}

export interface PublishingStandardsDataMessage extends BaseMessage {
  type: MessageType.PUBLISHING_STANDARDS_DATA;
  preset: string;           // current configured preset
  pageSizeKey?: string;     // current configured trim key
  genres: Array<{
    key: string;            // slug|abbreviation|name (best available)
    name: string;
    abbreviation: string;
    pageSizes: Array<{ key: string; label: string; width: number; height: number; common: boolean }>;
  }>;
}

export interface SetPublishingPresetMessage extends BaseMessage {
  type: MessageType.SET_PUBLISHING_PRESET;
  preset: string; // 'none' | 'manuscript' | 'genre:<key>'
}

export interface SetPublishingTrimMessage extends BaseMessage {
  type: MessageType.SET_PUBLISHING_TRIM_SIZE;
  pageSizeKey?: string; // format or WIDTHxHEIGHT
}
