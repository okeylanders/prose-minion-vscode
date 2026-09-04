import { WORKSHOP_COMPOSER_ATTACHMENT_POLICY } from '@shared/constants/workshopComposerAttachments';
import { WORKSHOP_SYNTHETIC_ASSET_FIXTURES } from '@/__tests__/fixtures/workshopMultimodalFixtures';

describe('Workshop composer attachment policy', () => {
  it('pins the Gate 00 limits and long-paste semantics in one owner', () => {
    expect(WORKSHOP_COMPOSER_ATTACHMENT_POLICY).toMatchObject({
      longPaste: {
        minimumCharacters: 2_000,
        maximumWords: 10_000,
        duplicateContent: 'allow-distinct-actions'
      },
      maximumItemsPerMessage: 3,
      maximumBinaryBytesPerMessage: 60 * 1024 * 1024,
      assets: {
        image: { maximumBytes: 10 * 1024 * 1024 },
        audio: { maximumBytes: 20 * 1024 * 1024 },
        video: { maximumBytes: 50 * 1024 * 1024 },
        document: { maximumBytes: 20 * 1024 * 1024 }
      }
    });
  });

  it('keeps one tiny synthetic signature fixture for every accepted format', () => {
    const accepted = Object.entries(WORKSHOP_COMPOSER_ATTACHMENT_POLICY.assets)
      .flatMap(([assetKind, policy]) => Object.keys(policy.formats)
        .map((format) => `${assetKind}:${format}`))
      .sort();
    const fixtures = WORKSHOP_SYNTHETIC_ASSET_FIXTURES
      .map(({ assetKind, format }) => `${assetKind}:${format}`)
      .sort();

    expect(fixtures).toEqual(accepted);
    expect(new Set(fixtures).size).toBe(fixtures.length);
    for (const fixture of WORKSHOP_SYNTHETIC_ASSET_FIXTURES) {
      expect(fixture.bytes.byteLength).toBeGreaterThan(0);
      expect(fixture.bytes.byteLength).toBeLessThanOrEqual(16);
    }
  });

  it('maps every fixture extension and MIME type through the accepted policy', () => {
    for (const fixture of WORKSHOP_SYNTHETIC_ASSET_FIXTURES) {
      const policy = WORKSHOP_COMPOSER_ATTACHMENT_POLICY.assets[fixture.assetKind];
      const formats = policy.formats as Record<string, {
        readonly extensions: readonly string[];
        readonly mimeTypes: readonly string[];
      }>;
      const format = formats[fixture.format];
      expect(format).toBeDefined();
      expect(format.extensions).toContain(`.${fixture.fileName.split('.').at(-1)}`);
      expect(format.mimeTypes).toContain(fixture.mimeType);
    }
  });
});
