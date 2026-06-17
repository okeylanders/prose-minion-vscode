import * as path from 'path';
import { FileSystem } from '@/platform';
import { PublishingStandardsRoot, Genre, PageSize } from '@/domain/models/PublishingStandards';

export class PublishingStandardsRepository {
  private cache?: PublishingStandardsRoot;

  constructor(
    private readonly extensionPath: string,
    private readonly fileSystem: FileSystem
  ) {}

  async load(): Promise<PublishingStandardsRoot> {
    if (this.cache) return this.cache;
    const filePath = path.join(this.extensionPath, 'resources', 'repository', 'publishing_standards.json');
    const raw = await this.fileSystem.readFile(filePath);
    const json = JSON.parse(Buffer.from(raw).toString('utf8')) as PublishingStandardsRoot;
    this.cache = json;
    return json;
  }

  async getGenres(): Promise<Genre[]> {
    const root = await this.load();
    return root.publishing_standards.genres || [];
  }

  async getManuscriptFormat() {
    const root = await this.load();
    return root.publishing_standards.manuscript_format;
  }

  /** Lookup genre by slug, abbreviation, or name (case-insensitive). */
  async findGenre(key: string): Promise<Genre | undefined> {
    const k = key.trim().toLowerCase();
    const genres = await this.getGenres();
    return genres.find(g =>
      (g.slug && g.slug.toLowerCase() === k) ||
      g.abbreviation.toLowerCase() === k ||
      g.name.toLowerCase() === k
    );
  }

  /**
   * Key used for selecting a page size: prefer format label; fallback to WIDTHxHEIGHT (e.g., 5.5x8.5)
   */
  getPageSizeKey(size: PageSize): string {
    if (size.format && size.format.trim()) return size.format;
    return `${size.width_inches}x${size.height_inches}`;
  }
}

