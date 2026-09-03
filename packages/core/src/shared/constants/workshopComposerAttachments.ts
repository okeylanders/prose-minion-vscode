/**
 * Accepted Workshop composer attachment policy (ADR 2026-09-03).
 *
 * This is the single product-policy owner shared by presentation and host-side
 * validation. Provider-specific acceptance may be narrower and is enforced
 * separately at dispatch time.
 */

const MEBIBYTE = 1024 * 1024;

export const WORKSHOP_COMPOSER_ATTACHMENT_POLICY = {
  longPaste: {
    minimumCharacters: 2_000,
    maximumWords: 10_000,
    duplicateContent: 'allow-distinct-actions'
  },
  maximumItemsPerMessage: 3,
  maximumBinaryBytesPerMessage: 60 * MEBIBYTE,
  media: {
    image: {
      maximumBytes: 10 * MEBIBYTE,
      formats: {
        png: { extensions: ['.png'], mimeTypes: ['image/png'] },
        jpeg: { extensions: ['.jpg', '.jpeg'], mimeTypes: ['image/jpeg'] },
        webp: { extensions: ['.webp'], mimeTypes: ['image/webp'] },
        gif: { extensions: ['.gif'], mimeTypes: ['image/gif'] }
      }
    },
    audio: {
      maximumBytes: 20 * MEBIBYTE,
      formats: {
        wav: { extensions: ['.wav'], mimeTypes: ['audio/wav', 'audio/x-wav'] },
        mp3: { extensions: ['.mp3'], mimeTypes: ['audio/mpeg'] },
        aiff: { extensions: ['.aif', '.aiff'], mimeTypes: ['audio/aiff', 'audio/x-aiff'] },
        aac: { extensions: ['.aac'], mimeTypes: ['audio/aac'] },
        ogg: { extensions: ['.ogg'], mimeTypes: ['audio/ogg'] },
        flac: { extensions: ['.flac'], mimeTypes: ['audio/flac', 'audio/x-flac'] },
        m4a: { extensions: ['.m4a'], mimeTypes: ['audio/mp4', 'audio/x-m4a'] }
      }
    },
    video: {
      maximumBytes: 50 * MEBIBYTE,
      formats: {
        mp4: { extensions: ['.mp4'], mimeTypes: ['video/mp4'] },
        mpeg: { extensions: ['.mpeg', '.mpg'], mimeTypes: ['video/mpeg'] },
        mov: { extensions: ['.mov'], mimeTypes: ['video/quicktime', 'video/mov'] },
        webm: { extensions: ['.webm'], mimeTypes: ['video/webm'] }
      }
    }
  }
} as const;

export type WorkshopMediaKind = keyof typeof WORKSHOP_COMPOSER_ATTACHMENT_POLICY.media;
