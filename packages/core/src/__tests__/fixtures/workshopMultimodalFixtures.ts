/**
 * Header-only, synthetic fixtures for binary-attachment signature validation.
 *
 * These are deliberately not playable or provider-smoke assets. They contain
 * only enough structure to exercise deterministic intake signature checks
 * without adding copyrighted or personal files to the repository.
 */

export interface WorkshopSyntheticAssetFixture {
  readonly assetKind: 'image' | 'audio' | 'video' | 'document';
  readonly format: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

const ascii = (value: string): number[] => [...value].map((character) => character.charCodeAt(0));

export const WORKSHOP_SYNTHETIC_ASSET_FIXTURES: readonly WorkshopSyntheticAssetFixture[] = [
  { assetKind: 'image', format: 'png', fileName: 'synthetic.png', mimeType: 'image/png', bytes: new Uint8Array([0x89, ...ascii('PNG\r\n\x1a\n')]) },
  { assetKind: 'image', format: 'jpeg', fileName: 'synthetic.jpg', mimeType: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
  { assetKind: 'image', format: 'webp', fileName: 'synthetic.webp', mimeType: 'image/webp', bytes: new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]) },
  { assetKind: 'image', format: 'gif', fileName: 'synthetic.gif', mimeType: 'image/gif', bytes: new Uint8Array(ascii('GIF89a')) },
  { assetKind: 'audio', format: 'wav', fileName: 'synthetic.wav', mimeType: 'audio/wav', bytes: new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')]) },
  { assetKind: 'audio', format: 'mp3', fileName: 'synthetic.mp3', mimeType: 'audio/mpeg', bytes: new Uint8Array(ascii('ID3')) },
  { assetKind: 'audio', format: 'aiff', fileName: 'synthetic.aiff', mimeType: 'audio/aiff', bytes: new Uint8Array([...ascii('FORM'), 0, 0, 0, 0, ...ascii('AIFF')]) },
  { assetKind: 'audio', format: 'aac', fileName: 'synthetic.aac', mimeType: 'audio/aac', bytes: new Uint8Array([0xff, 0xf1, 0x50, 0x80]) },
  { assetKind: 'audio', format: 'ogg', fileName: 'synthetic.ogg', mimeType: 'audio/ogg', bytes: new Uint8Array(ascii('OggS')) },
  { assetKind: 'audio', format: 'flac', fileName: 'synthetic.flac', mimeType: 'audio/flac', bytes: new Uint8Array(ascii('fLaC')) },
  { assetKind: 'audio', format: 'm4a', fileName: 'synthetic.m4a', mimeType: 'audio/mp4', bytes: new Uint8Array([0, 0, 0, 12, ...ascii('ftypM4A ')]) },
  { assetKind: 'video', format: 'mp4', fileName: 'synthetic.mp4', mimeType: 'video/mp4', bytes: new Uint8Array([0, 0, 0, 12, ...ascii('ftypisom')]) },
  { assetKind: 'video', format: 'mpeg', fileName: 'synthetic.mpeg', mimeType: 'video/mpeg', bytes: new Uint8Array([0, 0, 1, 0xba]) },
  { assetKind: 'video', format: 'mov', fileName: 'synthetic.mov', mimeType: 'video/quicktime', bytes: new Uint8Array([0, 0, 0, 12, ...ascii('ftypqt  ')]) },
  { assetKind: 'video', format: 'webm', fileName: 'synthetic.webm', mimeType: 'video/webm', bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]) },
  { assetKind: 'document', format: 'pdf', fileName: 'synthetic.pdf', mimeType: 'application/pdf', bytes: new Uint8Array(ascii('%PDF-1.7')) }
];
