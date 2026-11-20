/** Net Promoter Score math. Pure functions, no I/O. */

export const Z_95 = 1.96

export interface NpsCounts {
  promoters: number
  passives: number
  detractors: number
}

export interface NpsStats extends NpsCounts {
  n: number
  pctPromoters: number
  pctPassives: number
  pctDetractors: number
  /** NPS on its −100 to +100 scale, unrounded. */
  nps: number
  /** 95% margin of error in NPS points (Wald). */
  moe: number
  low: number
  high: number
  /** Responses needed for ±target points at the current split (0 when the variance is 0). */
  neededFor5: number
  variance: number
}

/** Splits pasted text on whitespace, commas and semicolons; keeps whole numbers 0–10. */
export function parseScores(raw: string): NpsCounts & { skipped: number } {
  const out = { promoters: 0, passives: 0, detractors: 0, skipped: 0 }
  for (const token of raw.split(/[\s,;]+/)) {
    if (!token) continue
    const score = /^\d{1,2}$/.test(token) ? Number(token) : NaN
    if (!(score >= 0 && score <= 10)) out.skipped++
    else if (score >= 9) out.promoters++
    else if (score >= 7) out.passives++
    else out.detractors++
  }
  return out
}

/** Groups a per-score frequency table (index 0–10 = how many answered that score). */
export function countsFromDistribution(perScore: readonly number[]): NpsCounts {
  const out = { promoters: 0, passives: 0, detractors: 0 }
  perScore.slice(0, 11).forEach((raw, score) => {
    const v = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
    if (score >= 9) out.promoters += v
    else if (score >= 7) out.passives += v
    else out.detractors += v
  })
  return out
}

/** Var = p⁺ + p⁻ − (p⁺ − p⁻)²; MoE = z·√(Var/n)·100 (MeasuringU 2021; Rocks 2016). */
export function npsStats(counts: NpsCounts, z = Z_95, targetPoints = 5): NpsStats | null {
  const clean = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)
  const promoters = clean(counts.promoters)
  const passives = clean(counts.passives)
  const detractors = clean(counts.detractors)
  const n = promoters + passives + detractors
  if (n === 0) return null

  const pPro = promoters / n
  const pDet = detractors / n
  const nps = (pPro - pDet) * 100
  const variance = Math.max(0, pPro + pDet - (pPro - pDet) ** 2)
  const moe = z * Math.sqrt(variance / n) * 100
  const target = targetPoints / 100
  // Subtract a hair before ceil so float noise (e.g. 400.0000001) doesn't add a response.
  const neededFor5 = variance === 0 ? 0 : Math.ceil((z * z * variance) / (target * target) - 1e-9)

  return {
    promoters,
    passives,
    detractors,
    n,
    pctPromoters: pPro * 100,
    pctPassives: (passives / n) * 100,
    pctDetractors: pDet * 100,
    nps,
    moe,
    low: Math.max(-100, nps - moe),
    high: Math.min(100, nps + moe),
    neededFor5,
    variance,
  }
}

/** One decimal with a true minus sign: −12.5, 35.0. */
export function formatPoints(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—'
  const fixed = Math.abs(v).toFixed(digits)
  return Number(fixed) === 0 ? fixed : `${v < 0 ? '−' : ''}${fixed}`
}
