/** Provider-normalized, display-safe source citation for a grounded response. */
export interface UrlCitation {
  url: string;
  title?: string;
  startIndex?: number;
  endIndex?: number;
}

/** Accept only complete HTTP(S) URLs before a citation reaches persistence or UI. */
export const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
};
