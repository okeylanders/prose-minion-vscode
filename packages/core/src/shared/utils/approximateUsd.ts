/**
 * The one way an estimated price is written (ADR 2026-11-20 D14): "≈ $0.42",
 * or "< $0.01" for a price that rounds to nothing. An estimate is
 * approximate, never a cap, so it is never worded "up to". Pure; shared by
 * the host and the webview.
 */
export function formatApproximateUsd(usd: number): string {
  return usd < 0.005 ? '< $0.01' : `≈ $${usd.toFixed(2)}`;
}
