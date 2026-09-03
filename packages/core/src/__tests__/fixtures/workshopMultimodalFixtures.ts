/**
 * Header-only, synthetic fixtures for media signature validation.
 *
 * These are deliberately not playable or provider-smoke assets. They contain
 * only enough structure to exercise deterministic intake signature checks
 * without adding copyrighted or personal media to the repository.
 */

export interface WorkshopSyntheticMediaFixture {
  readonly mediaKind: 'image' | 'audio' | 'video';
  readonly format: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

const ascii = (value: string): number[] => [...value].map((character) => character.charCodeAt(0));

export const WORKSHOP_SYNTHETIC_MEDIA_FIXTURES: readonly WorkshopSyntheticMediaFixture[] = [
  { mediaKind: 'image', format: 'png', fileName: 'synthetic.png', mimeType: 'image/png', bytes: new Uint8Array([0x89, ...ascii('PNG\r\n\x1a\n')]) },
  { mediaKind: 'image', format: 'jpeg', fileName: 'synthetic.jpg', mimeType: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
  { mediaKind: 'image', format: 'webp', fileName: 'synthetic.webp', mimeType: 'image/webp', bytes: new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]) },
  { mediaKind: 'image', format: 'gif', fileName: 'synthetic.gif', mimeType: 'image/gif', bytes: new Uint8Array(ascii('GIF89a')) },
  { mediaKind: 'audio', format: 'wav', fileName: 'synthetic.wav', mimeType: 'audio/wav', bytes: new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')]) },
  { mediaKind: 'audio', format: 'mp3', fileName: 'synthetic.mp3', mimeType: 'audio/mpeg', bytes: new Uint8Array(ascii('ID3')) },
  { mediaKind: 'audio', format: 'aiff', fileName: 'synthetic.aiff', mimeType: 'audio/aiff', bytes: new Uint8Array([...ascii('FORM'), 0, 0, 0, 0, ...ascii('AIFF')]) },
  { mediaKind: 'audio', format: 'aac', fileName: 'synthetic.aac', mimeType: 'audio/aac', bytes: new Uint8Array([0xff, 0xf1, 0x50, 0x80]) },
  { mediaKind: 'audio', format: 'ogg', fileName: 'synthetic.ogg', mimeType: 'audio/ogg', bytes: new Uint8Array(ascii('OggS')) },
  { mediaKind: 'audio', format: 'flac', fileName: 'synthetic.flac', mimeType: 'audio/flac', bytes: new Uint8Array(ascii('fLaC')) },
  { mediaKind: 'audio', format: 'm4a', fileName: 'synthetic.m4a', mimeType: 'audio/mp4', bytes: new Uint8Array([0, 0, 0, 12, ...ascii('ftypM4A ')]) },
  { mediaKind: 'video', format: 'mp4', fileName: 'synthetic.mp4', mimeType: 'video/mp4', bytes: new Uint8Array([0, 0, 0, 12, ...ascii('ftypisom')]) },
  { mediaKind: 'video', format: 'mpeg', fileName: 'synthetic.mpeg', mimeType: 'video/mpeg', bytes: new Uint8Array([0, 0, 1, 0xba]) },
  { mediaKind: 'video', format: 'mov', fileName: 'synthetic.mov', mimeType: 'video/quicktime', bytes: new Uint8Array([0, 0, 0, 12, ...ascii('ftypqt  ')]) },
  { mediaKind: 'video', format: 'webm', fileName: 'synthetic.webm', mimeType: 'video/webm', bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]) }
];
