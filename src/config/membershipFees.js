/**
 * Club membership fees (CAD, before HST).
 * Half = Fall or Winter only | Full = Both Fall and Winter
 */
export const MEMBERSHIP_FEES = [
  { id: 'full-tri', name: 'Full Tri', amount: 256 },
  { id: 'half-tri', name: 'Half Tri', amount: 136 },
  { id: 'full-du', name: 'Full Du', amount: 213 },
  { id: 'half-du', name: 'Half Du', amount: 122 },
  { id: 'full-run', name: 'Full Run', amount: 182 },
  { id: 'half-run', name: 'Half Run', amount: 101 },
];

export function formatFeeAmount(amount) {
  return `$${amount} + HST`;
}
