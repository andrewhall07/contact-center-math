/**
 * Call center occupancy math. Pure functions, no I/O.
 * Queueing math (traffic, service level, ASA) comes only from ./erlang-c.
 */
import { intervalAt, MAX_AGENTS, trafficIntensity, type Interval } from './erlang-c.js'

export interface ActualsInput {
  /** Talk + hold + after-call work. Any time unit, as long as all inputs share it. */
  handle: number
  /** Logged in, ready and waiting for a contact. */
  available: number
  /** Other logged-in time (meetings, coaching, training, admin). Optional. */
  aux?: number
  /** Paid or scheduled shift time. Optional; 0 or missing hides the utilization panel. */
  shift?: number
}

export interface ActualsResult {
  /** null when the inputs are invalid; see error. */
  occupancy: number | null
  idle: number | null
  /** The three published utilization-style ratios, present only when a shift is given. */
  utilization: {
    loggedInOverShift: number
    handleOverShift: number
    handleOverLoggedIn: number
  } | null
  error: string | null
}

/** Occupancy = handle ÷ (handle + available). */
export function occupancyFromActuals(input: ActualsInput): ActualsResult {
  const { handle, available } = input
  const aux = input.aux ?? 0
  const shift = input.shift ?? 0
  const none = { occupancy: null, idle: null, utilization: null }
  if (![handle, available, aux, shift].every((x) => Number.isFinite(x) && x >= 0)) {
    return { ...none, error: 'Times must be zero or more' }
  }
  if (handle + available <= 0) return { ...none, error: 'Enter handle time or available time' }
  const loggedIn = handle + available + aux
  if (shift > 0 && loggedIn > shift + 1e-9) return { ...none, error: "Logged-in time can't exceed the shift" }
  const occupancy = handle / (handle + available)
  return {
    occupancy,
    idle: 1 - occupancy,
    utilization:
      shift > 0
        ? {
            loggedInOverShift: loggedIn / shift,
            handleOverShift: handle / shift,
            handleOverLoggedIn: handle / loggedIn,
          }
        : null,
    error: null,
  }
}

export type Band = 'low' | 'sustainable' | 'high'

/** Display band: only the 85% edge is sourced (Call Centre Helper); the 70% lower edge is a common planning floor, not a published standard. */
export function occupancyBand(occ: number): Band {
  if (occ > 0.85 + 1e-12) return 'high'
  if (occ < 0.7 - 1e-12) return 'low'
  return 'sustainable'
}

/** Calls N agents can take in one interval at a given occupancy: floor(occ × N × I ÷ h). */
export function callsAtOccupancy(agents: number, intervalSec: number, ahtSec: number, occ = 0.85): number {
  if (!(ahtSec > 0) || !(agents > 0) || !(intervalSec > 0)) return 0
  return Math.floor((occ * agents * intervalSec) / ahtSec + 1e-9)
}

export interface ForecastInput {
  calls: number
  intervalSec: number
  ahtSec: number
  agents: number
  targetSec: number
  /** Share of calls fully handled by AI before the queue, 0–1. */
  containment?: number
}

export interface ForecastResult extends Interval {
  offered: number
  traffic: number
  /** False when N ≤ A: the queue grows without limit. */
  stable: boolean
  /** Calls this headcount can take at 85% occupancy. */
  callsAt85: number
  /** Rows N−2 … N+2 (N ≥ 1). */
  table: (Interval & { stable: boolean })[]
}

/** Erlang C occupancy and service metrics at a fixed headcount, composed from ./erlangc. */
export function forecastAt(input: ForecastInput): ForecastResult {
  const contain = Math.min(1, Math.max(0, input.containment ?? 0))
  const offered = Math.max(0, input.calls) * (1 - contain)
  const traffic = trafficIntensity(offered, input.ahtSec, input.intervalSec)
  const agents = Math.min(MAX_AGENTS, Math.max(1, Math.round(input.agents)))
  const row = intervalAt(agents, traffic, input.ahtSec, input.targetSec)
  const table: ForecastResult['table'] = []
  for (let n = agents - 2; n <= agents + 2; n++) {
    if (n >= 1 && n <= MAX_AGENTS) table.push({ ...intervalAt(n, traffic, input.ahtSec, input.targetSec), stable: n > traffic })
  }
  return {
    ...row,
    offered,
    traffic,
    stable: agents > traffic,
    callsAt85: callsAtOccupancy(agents, input.intervalSec, input.ahtSec),
    table,
  }
}
