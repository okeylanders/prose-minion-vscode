/** Provider-normalized, display-safe source citation for a grounded response. */
export interface UrlCitation {
  url: string;
  title?: string;
  startIndex?: number;
  endIndex?: number;
}
