/**
 * Versioned price table. Unknown models and missing token counts stay null.
 * Null is not zero: a missing price must not make a run look free.
 * Rates are public list prices used as estimates, not invoices.
 */
export const LIVE_PRICE_VERSION = "openai-public-list-2025-04";
export const DEMO_PRICE_VERSION = "synthetic-demo-2026";
export const DEMO_MODEL_ID = "shannon-canned-1";

const USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  [DEMO_MODEL_ID]: { input: 0.15, output: 0.6 },
};

export function priceVersionFor(model: string): string | null {
  if (model === DEMO_MODEL_ID) return DEMO_PRICE_VERSION;
  return USD_PER_MILLION[model] ? LIVE_PRICE_VERSION : null;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (inputTokens === null || outputTokens === null) return null;
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
  if (inputTokens < 0 || outputTokens < 0) return null;
  const rate = USD_PER_MILLION[model];
  if (!rate) return null;
  const usd = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
  return Math.round(usd * 1e8) / 1e8;
}

/** Conservative reserve before a live call so a run cannot walk past the item cap. */
export function reserveUsd(model: string): number {
  const estimated = estimateCostUsd(model, 4000, 1500);
  return estimated === null ? 0.02 : Math.max(estimated, 0.0001);
}
