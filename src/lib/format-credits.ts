/**
 * Formats the internal credits value for display
 * - Internal: credits are stored as integers (1 = 0.5 displayed credits)
 * - Display: credits are shown as decimals (1 internal credit = 0.5 displayed credits)
 */
export function formatCredits(internalCredits: number): number {
  return internalCredits / 2;
}

/**
 * Converts display credits to internal credits
 * - Display: credits are shown as decimals (0.5 displayed credits)
 * - Internal: credits are stored as integers (1 = 0.5 displayed credits)
 */
export function toInternalCredits(displayCredits: number): number {
  return displayCredits * 2;
}