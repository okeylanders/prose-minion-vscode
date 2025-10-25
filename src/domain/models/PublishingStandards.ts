export interface RangeNumber {
  min?: number;
  max?: number;
}

export interface RangeInteger {
  min?: number;
  max?: number;
}

export interface WordsPerPage {
  min?: number;
  max?: number;
  average?: number;
}

export interface PageSize {
  width_inches: number;
  height_inches: number;
  common: boolean;
  format?: string;
  words_per_page?: WordsPerPage;
}

export interface LiteraryStatistics {
  unique_word_count: RangeInteger;
  lexical_density: RangeNumber; // percent 0–100
  dialogue_percentage: RangeNumber; // percent 0–100
  avg_words_per_sentence: RangeNumber;
  avg_sentences_per_paragraph: RangeNumber;
  reading_time_hours?: RangeNumber | 'N/A';
  reading_time_minutes?: RangeInteger | 'N/A';
  chapter_count: RangeInteger | 'N/A';
  avg_chapter_length: RangeInteger | 'N/A';
  avg_spread_length?: RangeInteger;
  word_length_distribution: {
    '1_to_3_letters': RangeInteger;
    '4_to_6_letters': RangeInteger;
    '7_plus_letters': RangeInteger;
  };
}

export interface Genre {
  name: string;
  slug?: string;
  abbreviation: string;
  words_per_page: WordsPerPage;
  page_sizes: PageSize[];
  word_count_range: RangeInteger;
  page_count_range: RangeInteger;
  formatting: {
    font_size_pt: number[];
    line_spacing: number[];
    margins_inches: number[];
  };
  literary_statistics: LiteraryStatistics;
}

export interface ManuscriptFormat {
  words_per_page: number;
  page_size: { width_inches: number; height_inches: number };
  formatting: { font: string; font_size_pt: number; spacing: string; margins_inches: number };
  purpose: string;
}

export interface PublishingStandardsRoot {
  publishing_standards: {
    genres: Genre[];
    manuscript_format: ManuscriptFormat;
  };
}

