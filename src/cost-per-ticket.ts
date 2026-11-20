/**
 * Support cost per ticket math. Pure functions, no I/O.
 * Cost per ticket = fully loaded monthly support cost ÷ tickets per month.
 */

export interface CostInput {
  /** Agents (FTE). */
  agents: number
  /** Fully loaded annual cost per agent (salary + benefits). */
  loadedPerAgent: number
  /** Annual helpdesk, AI and other software cost for the team. */
  tooling: number
  /** Annual overhead (facilities, management, training) as an amount… */
  overheadAmount?: number
  /** …or as a share of people cost (0–1). Used when overheadAmount is undefined. */
  overheadPct?: number
  /** New tickets (issues) per month. */
  tickets: number
  /** Share of tickets verified resolved, not just closed (0–1). */
  verified: number
  /** Share of tickets where the customer comes back about the same issue (0–1). */
  recontact: number
}

export interface CostResult {
  people: number
  overhead: number
  tooling: number
  annual: number
  monthly: number
  perTicket: number
  contacts: number
  perContact: number
  /** Verified resolutions that held: tickets × verified × (1 − re-contact rate). */
  resolutions: number
  perResolution: number | null
  /** Tickets per agent per month. */
  ticketsPerAgent: number
}

const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x >= 0)

export function costPerTicket(i: CostInput): CostResult | { error: string } {
  const oa = i.overheadAmount ?? 0
  const op = i.overheadPct ?? 0
  if (!ok(i.agents, i.loadedPerAgent, i.tooling, oa, op, i.tickets, i.verified, i.recontact)) return { error: 'Inputs must be zero or more' }
  if (i.agents <= 0) return { error: 'Enter the number of agents (FTE)' }
  if (i.tickets <= 0) return { error: 'Enter tickets per month' }
  if (i.verified > 1) return { error: 'Verified resolved must be 100% or less' }
  if (i.recontact >= 1) return { error: 'Re-contact rate must be below 100%' }
  const people = i.agents * i.loadedPerAgent
  const overhead = i.overheadAmount !== undefined ? oa : people * op
  const annual = people + i.tooling + overhead
  const monthly = annual / 12
  const contacts = i.tickets * (1 + i.recontact)
  const resolutions = i.tickets * i.verified * (1 - i.recontact)
  return {
    people,
    overhead,
    tooling: i.tooling,
    annual,
    monthly,
    perTicket: monthly / i.tickets,
    contacts,
    perContact: monthly / contacts,
    resolutions,
    perResolution: resolutions > 0 ? monthly / resolutions : null,
    ticketsPerAgent: i.tickets / i.agents,
  }
}

export interface AiCompare {
  /** AI cost per resolution (platform midpoint). */
  cost: number
  /** Realistic resolution rate (0–1, platform midpoint). */
  rate: number
  /** The same AI spend divided by every ticket the AI touches: cost × rate. */
  perTouched: number
  /** Tickets the AI touches but does not resolve, priced at your current cost per ticket, per AI-touched ticket. */
  followUp: number
  /** perTouched + followUp. */
  perTouchedAllIn: number
}

/** How an AI agent's cost per resolution reads when divided by tickets touched instead of tickets resolved. */
export function aiCompare(cost: number, rate: number, humanPerTicket: number): AiCompare {
  const perTouched = cost * rate
  const followUp = (1 - rate) * humanPerTicket
  return { cost, rate, perTouched, followUp, perTouchedAllIn: perTouched + followUp }
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
