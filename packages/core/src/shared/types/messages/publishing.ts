/**
 * Publishing domain messages
 * Publishing standards and genre presets
 */

import { MessageEnvelope, MessageType } from './base';

export interface RequestPublishingStandardsDataMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA;
}

export interface PublishingStandardsDataPayload {
  preset: string;           // current configured preset
  pageSizeKey?: string;     // current configured trim key
  genres: Array<{
    key: string;            // slug|abbreviation|name (best available)
    name: string;
    abbreviation: string;
    pageSizes: Array<{ key: string; label: string; width: number; height: number; common: boolean }>;
  }>;
}

export interface PublishingStandardsDataMessage extends MessageEnvelope<PublishingStandardsDataPayload> {
  type: MessageType.PUBLISHING_STANDARDS_DATA;
}

export interface SetPublishingPresetPayload {
  preset: string; // 'none' | 'manuscript' | 'genre:<key>'
}

export interface SetPublishingPresetMessage extends MessageEnvelope<SetPublishingPresetPayload> {
  type: MessageType.SET_PUBLISHING_PRESET;
}

export interface SetPublishingTrimPayload {
  pageSizeKey?: string; // format or WIDTHxHEIGHT
}

export interface SetPublishingTrimMessage extends MessageEnvelope<SetPublishingTrimPayload> {
  type: MessageType.SET_PUBLISHING_TRIM_SIZE;
}
