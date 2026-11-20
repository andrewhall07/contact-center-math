/**
 * Erlang C staffing math. Pure functions, no I/O.
 * Uses the Erlang B recursion so A^N and N! are never computed (stable into the
 * hundreds of thousands of agents).
 */

/** Hard ceiling on the agent search so the loop is always bounded. */
export const MAX_AGENTS = 100_000

export interface ErlangInputs {
  /** Contacts offered in one interval, before any AI containment. */
  contacts: number
  /** Interval length in seconds (e.g. 1800 for 30 minutes). */
  intervalSec: number
  /** Average handle time in seconds. */
  ahtSec: number
  /** Target share answered within targetSec, 0–1. */
  targetSL: number
  /** Target answer time in seconds. */
  targetSec: number
  /** Maximum occupancy, 0–1; 1 means no cap. */
  maxOccupancy?: number
  /** Shrinkage, 0–0.9. */
  shrinkage?: number
  /** Share of contacts fully handled by AI before the queue, 0–1. */
  aiContainment?: number
}

export interface Interval {
  agents: number
  pWait: number
  serviceLevel: number
  asaSec: number
  occupancy: number
}

export interface ErlangResult extends Interval {
  /** Contacts that still reach the queue after AI containment. */
  offered: number
  /** Traffic intensity in Erlangs. */
  traffic: number
  scheduled: number
  /** False when no N up to MAX_AGENTS meets the target. */
  feasible: boolean
}

/** A = λ × h / I (Erlangs). */
export function trafficIntensity(contacts: number, ahtSec: number, intervalSec: number): number {
  if (!(intervalSec > 0) || !(contacts > 0) || !(ahtSec > 0)) return 0
  return (contacts * ahtSec) / intervalSec
}

/** Erlang B blocking probability via B = A·B / (j + A·B). */
export function erlangB(agents: number, traffic: number): number {
  let b = 1
  for (let j = 1; j <= agents; j++) b = (traffic * b) / (j + traffic * b)
  return b
}

/** Erlang C probability that a contact waits: P_W = N·B / (N − A·(1 − B)). 1 when N ≤ A. */
export function erlangC(agents: number, traffic: number): number {
  if (traffic <= 0) return 0
  if (agents <= traffic) return 1
  const b = erlangB(agents, traffic)
  return Math.min(1, (agents * b) / (agents - traffic * (1 - b)))
}

/** SL = 1 − P_W · e^(−(N − A) · T / h). */
export function serviceLevel(agents: number, traffic: number, ahtSec: number, targetSec: number, pWait = erlangC(agents, traffic)): number {
  if (traffic <= 0) return 1
  if (agents <= traffic) return 0
  return Math.max(0, 1 - pWait * Math.exp((-(agents - traffic) * targetSec) / ahtSec))
}

/** ASA = P_W · h / (N − A), in seconds. Infinity when N ≤ A. */
export function averageSpeedOfAnswer(agents: number, traffic: number, ahtSec: number, pWait = erlangC(agents, traffic)): number {
  if (traffic <= 0) return 0
  if (agents <= traffic) return Infinity
  return (pWait * ahtSec) / (agents - traffic)
}

export function occupancy(agents: number, traffic: number): number {
  return agents > 0 ? Math.min(1, traffic / agents) : 0
}

/** All interval metrics for a given number of agents on phones. */
export function intervalAt(agents: number, traffic: number, ahtSec: number, targetSec: number): Interval {
  const pWait = erlangC(agents, traffic)
  return {
    agents,
    pWait,
    serviceLevel: serviceLevel(agents, traffic, ahtSec, targetSec, pWait),
    asaSec: averageSpeedOfAnswer(agents, traffic, ahtSec, pWait),
    occupancy: occupancy(agents, traffic),
  }
}

/** scheduled = ceil(N / (1 − s)), s clamped to [0, 0.9], with a tolerance so float error never adds an agent. */
export function grossUpForShrinkage(agents: number, shrinkage: number): number {
  const s = Math.min(0.9, Math.max(0, shrinkage))
  return Math.ceil(agents / (1 - s) - 1e-9)
}

/**
 * Fewest agents on phones that meet the service-level target and keep occupancy at
 * or under the cap, then shrinkage gross-up. Starts at floor(A) + 1.
 */
export function solveStaffing(input: ErlangInputs): ErlangResult {
  const contain = Math.min(1, Math.max(0, input.aiContainment ?? 0))
  const offered = Math.max(0, input.contacts) * (1 - contain)
  const traffic = trafficIntensity(offered, input.ahtSec, input.intervalSec)
  const target = Math.min(1, Math.max(0, input.targetSL))
  const cap = Math.min(1, Math.max(0.01, input.maxOccupancy ?? 1))
  const targetSec = Math.max(0, input.targetSec)

  let n = traffic > 0 ? Math.floor(traffic) + 1 : 0
  // Jump straight to the occupancy floor so a tight cap doesn't loop agent by agent.
  if (traffic > 0 && cap < 1) n = Math.max(n, Math.ceil(traffic / cap - 1e-9))
  let feasible = n <= MAX_AGENTS
  let row = intervalAt(n, traffic, input.ahtSec, targetSec)
  while (feasible && traffic > 0 && (row.serviceLevel < target - 1e-12 || row.occupancy > cap + 1e-12)) {
    if (n >= MAX_AGENTS) {
      feasible = false
      break
    }
    n++
    row = intervalAt(n, traffic, input.ahtSec, targetSec)
  }

  return {
    ...row,
    offered,
    traffic,
    scheduled: grossUpForShrinkage(n, input.shrinkage ?? 0),
    feasible,
  }
}

/** Rows N−2 … N+2 around an answer (skipping N ≤ 0). */
export function staffingTable(result: ErlangResult, ahtSec: number, targetSec: number, span = 2): Interval[] {
  const rows: Interval[] = []
  for (let n = result.agents - span; n <= result.agents + span; n++) {
    if (n > 0 && n <= MAX_AGENTS) rows.push(intervalAt(n, result.traffic, ahtSec, targetSec))
  }
  return rows
}
