/**
 * Shared balance formatting (single-provider adaptation of FM's ADR-010 helper).
 *
 * One source of truth for the headline metric so the collapsed pill and the
 * expanded panel can never disagree on the number they show.
 */
import { OpenRouterBalance } from '@messages';

/**
 * USD with the sign OUTSIDE the dollar mark, so a negative (overdrawn) balance
 * reads as `-$0.50`, not `$-0.50`. OpenRouter is single-currency.
 */
function signedUsd(value: number, fractionDigits: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(fractionDigits)}`;
}

/** USD-formatted dollars (2dp) — the headline/balance metric. */
export function fmtUsd(value: number): string {
  return signedUsd(value, 2);
}

/**
 * USD with sub-cent precision (3dp) for tiny per-request costs (e.g. `$0.014`),
 * routed through the same source of truth as `fmtUsd` so the "Last request" line
 * and the balance can't drift on sign/format. Named `Precise` (not `Micro`): the
 * extra digit is milli-scale (10⁻³), not SI micro (10⁻⁶).
 */
export function fmtUsdPrecise(value: number): string {
  return signedUsd(value, 3);
}

/** Tone hint for the headline amount — drives muted/zero styling. */
export type BalanceTone = 'normal' | 'muted' | 'zero';

export interface BalanceHeadline {
  text: string;
  tone: BalanceTone;
}

/**
 * The single prominent number for OpenRouter — the account balance, matching
 * the expanded panel's headline. Falls back to the enforced key-limit remaining
 * ONLY when the account balance (`/credits`) is unreadable, so a non-management
 * key still surfaces the one number it has.
 */
export function openRouterHeadline(
  balance: OpenRouterBalance | null,
  isLoading: boolean
): BalanceHeadline {
  if (!balance) {
    return { text: isLoading ? '…' : '—', tone: 'muted' };
  }
  if (balance.status === 'no_key') {
    return { text: 'no key', tone: 'muted' };
  }
  if (balance.status === 'unavailable') {
    return { text: '—', tone: 'muted' };
  }

  const { keyLimit, credits } = balance;

  // Favor the total account balance — the number users want at a glance. The
  // per-key spend limit is a secondary guard, used only as a fallback.
  if (credits) {
    return { text: fmtUsd(credits.remaining), tone: credits.remaining <= 0 ? 'zero' : 'normal' };
  }

  const hasEnforcedLimit =
    keyLimit != null && keyLimit.limit != null && keyLimit.limitRemaining != null;
  if (hasEnforcedLimit) {
    if (keyLimit!.limit === 0) {
      return { text: fmtUsd(0), tone: 'zero' };
    }
    const remaining = keyLimit!.limitRemaining!;
    return { text: fmtUsd(remaining), tone: remaining <= 0 ? 'zero' : 'normal' };
  }

  return { text: '—', tone: 'muted' };
}
