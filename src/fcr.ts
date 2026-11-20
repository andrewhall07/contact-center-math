/**
 * First contact resolution (FCR) math. Pure functions, no I/O.
 * FCR = contacts resolved on the first contact ÷ contacts (gross) or ÷ resolvable contacts (net).
 */

export const Z_95 = 1.96

export interface TotalsInput {
  /** Contacts (issues) in the period, or survey responses when FCR comes from a survey. */
  contacts: number
  /** Resolved on the first contact (no transfer, callback or repeat contact inside the window). */
  resolved: number
  /** Optional: contacts that could not be resolved on the first contact by design (net FCR only). */
  unresolvable?: number
}

export interface TotalsResult {
  gross: number
  /** null when no contacts were marked unresolvable (net = gross). */
  net: number | null
  netBase: number
  /** Contacts not resolved on the first contact. */
  unresolved: number
  /** 95% margin of error on gross FCR, in points (0–1 scale); null under 30 responses or at 0% / 100%. */
  moe: number | null
  /** Responses needed for ±5 points at this FCR. */
  neededFor5: number
}

const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x >= 0)

export function fcrFromTotals({ contacts, resolved, unresolvable = 0 }: TotalsInput): TotalsResult | { error: string } {
  if (!ok(contacts, resolved, unresolvable)) return { error: 'Counts must be zero or more' }
  if (contacts <= 0) return { error: 'Enter the number of contacts' }
  if (resolved > contacts) return { error: 'Resolved on first contact cannot be more than total contacts' }
  const netBase = contacts - unresolvable
  if (unresolvable > 0 && resolved > netBase)
    return { error: 'Resolved plus not-resolvable contacts cannot be more than total contacts' }
  const p = resolved / contacts
  const variance = p * (1 - p)
  const moe = contacts < 30 || variance === 0 ? null : Z_95 * Math.sqrt(variance / contacts)
  return {
    gross: p,
    net: unresolvable > 0 ? (netBase > 0 ? resolved / netBase : null) : null,
    netBase,
    unresolved: contacts - resolved,
    moe,
    // Subtract a hair before ceil so float noise doesn't add a response.
    neededFor5: variance === 0 ? 0 : Math.ceil((Z_95 * Z_95 * variance) / 0.0025 - 1e-9),
  }
}

export interface SplitInput {
  /** Contacts an AI agent took first. */
  ai: number
  /** Of those, resolved by the AI on the first contact with no handoff and no repeat contact in the window. */
  aiResolved: number
  /** Of those, handed to a person during the same contact. */
  escalated: number
  /** Of the escalations, resolved by the person in that same contact. */
  escalatedResolved: number
  /** Contacts routed straight to a person. */
  human: number
  /** Of those, resolved on the first contact. */
  humanResolved: number
  /** Optional FCR before AI (0–1). 0 = not given. */
  baseline?: number
}

export interface SplitResult {
  contacts: number
  /** AI-resolved + human-direct-resolved ÷ all contacts. A handoff never counts as first contact resolution. */
  strict: number
  /** As strict, plus escalations a person resolved inside the same conversation. */
  customer: number
  /** AI resolutions ÷ contacts the AI took first. */
  aiRate: number | null
  /** AI resolutions ÷ all contacts. */
  aiShareOfAll: number
  /** Contacts that left the AI with no resolution and no handoff. */
  dropped: number
  /** AI rate if the dropped contacts were counted as resolved (what a deflection count shows). */
  aiRateIfDroppedCounted: number | null
  /** Human resolutions in the same contact ÷ contacts a person took (escalations + direct). */
  humanRate: number | null
  escalatedRate: number | null
  directRate: number | null
  escalationRate: number | null
  baseline: { fcr: number; strictChange: number; customerChange: number; directChange: number | null } | null
}

export function fcrBySplit(input: SplitInput): SplitResult | { error: string } {
  const { ai, aiResolved, escalated, escalatedResolved, human, humanResolved } = input
  const base = input.baseline ?? 0
  if (!ok(ai, aiResolved, escalated, escalatedResolved, human, humanResolved, base)) return { error: 'Counts must be zero or more' }
  if (aiResolved + escalated > ai) return { error: 'AI-resolved plus handed-off contacts cannot be more than contacts the AI took' }
  if (escalatedResolved > escalated) return { error: 'Handoffs resolved cannot be more than handoffs' }
  if (humanResolved > human) return { error: 'Resolved by a person cannot be more than contacts sent straight to a person' }
  if (base > 1) return { error: 'Enter FCR before AI as a percentage from 0 to 100' }
  const contacts = ai + human
  if (contacts <= 0) return { error: 'Enter contacts for at least one group' }
  const strict = (aiResolved + humanResolved) / contacts
  const customer = (aiResolved + escalatedResolved + humanResolved) / contacts
  const dropped = ai - aiResolved - escalated
  const personTook = escalated + human
  const directRate = human > 0 ? humanResolved / human : null
  return {
    contacts,
    strict,
    customer,
    aiRate: ai > 0 ? aiResolved / ai : null,
    aiShareOfAll: aiResolved / contacts,
    dropped,
    aiRateIfDroppedCounted: ai > 0 ? (aiResolved + dropped) / ai : null,
    humanRate: personTook > 0 ? (escalatedResolved + humanResolved) / personTook : null,
    escalatedRate: escalated > 0 ? escalatedResolved / escalated : null,
    directRate,
    escalationRate: ai > 0 ? escalated / ai : null,
    baseline:
      base > 0
        ? {
            fcr: base,
            strictChange: strict - base,
            customerChange: customer - base,
            directChange: directRate === null ? null : directRate - base,
          }
        : null,
  }
}
