/** Keep model diagnostics useful without copying an arbitrarily large body into logs. */
export function boundedLogText(
  content: string,
  maximumCharacters = 12_000,
  edgeCharacters = 4_000
): string {
  if (content.length <= maximumCharacters) {
    return content;
  }
  const edge = Math.min(edgeCharacters, Math.floor(maximumCharacters / 2));
  const omitted = content.length - (edge * 2);
  return [
    content.slice(0, edge),
    `\n\n[... ${omitted.toLocaleString('en-US')} characters omitted ...]\n\n`,
    content.slice(-edge)
  ].join('');
}
