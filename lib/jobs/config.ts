// Hand-set approximations; refresh when a non-USD posting sits near the floor.
export const FX_SET_ON = "2026-11-06";
export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  CAD: 0.72,
  EUR: 1.08,
  GBP: 1.27,
};
