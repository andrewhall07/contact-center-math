/** Customer Satisfaction (CSAT) math. Pure functions, no I/O. */

export const Z_95 = 1.96

export type CsatScale = 3 | 5 | 7 | 10

export const CSAT_SCALES: readonly CsatScale[] = [3, 5, 7, 10]

/** Top-box choices that never reach the scale midpoint. */
export function allowedTopN(scale: CsatScale): number[] {
  if (scale === 3) return [1]
  if (scale === 5) return [1, 2]
  return [1, 2, 3]
}

/** Default: top 1 on 1–3 (top 2 would include the neutral midpoint), top 2 on every other scale. */
export function defaultTopN(scale: CsatScale): number {
  return scale === 3 ? 1 : 2
}

/** Bottom boxes counted as dissatisfied (DSAT): bottom 1 on 1–3, bottom 2 otherwise. */
export function bottomN(scale: CsatScale): number {
  return scale === 3 ? 1 : 2
}

/** "9–10" or "3": the scores counted as satisfied. */
export function topRange(scale: CsatScale, topN: number): string {
  const lo = scale - topN + 1
  return lo === scale ? `${scale}` : `${lo}–${scale}`
}

export function bottomRange(scale: CsatScale): string {
  const b = bottomN(scale)
  return b === 1 ? '1' : `1–${b}`
}

/** "CSAT = share of responses scoring 9–10 on a 1–10 scale (top 2 boxes)" */
export function ruleSentence(scale: CsatScale, topN: number): string {
  const boxes = topN === 1 ? 'top box' : `top ${topN} boxes`
  return `CSAT = share of responses scoring ${topRange(scale, topN)} on a 1–${scale} scale (${boxes})`
}

export interface CsatStats {
  n: number
  satisfied: number
  dissatisfied: number
  neutral: number
  pctCsat: number
  pctDsat: number
  pctNeutral: number
  /** Σ(score × count) ÷ n, on the original scale. */
  average: number
  /** 95% margin of error in percentage points; null when n < 30 or p is 0 or 1. */
  moe: number | null
  low: number | null
  high: number | null
  /** Responses needed for ±5 points at the current CSAT share (0 when p is 0 or 1). */
  neededFor5: number
}

const clean = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)

/** perScore[i] = how many responses scored i + 1. Extra entries beyond the scale are ignored. */
export function csatStats(
  perScore: readonly number[],
  scale: CsatScale,
  topN = defaultTopN(scale),
  z = Z_95,
  targetPoints = 5,
): CsatStats | null {
  const top = allowedTopN(scale).includes(topN) ? topN : defaultTopN(scale)
  const counts = Array.from({ length: scale }, (_, i) => clean(perScore[i] ?? 0))
  const n = counts.reduce((a, b) => a + b, 0)
  if (n === 0) return null

  let satisfied = 0
  let dissatisfied = 0
  let sum = 0
  counts.forEach((c, i) => {
    const score = i + 1
    sum += score * c
    if (score > scale - top) satisfied += c
    else if (score <= bottomN(scale)) dissatisfied += c
  })
  const neutral = n - satisfied - dissatisfied
  const p = satisfied / n
  const pctCsat = p * 100
  const pctDsat = (dissatisfied / n) * 100
  const variance = p * (1 - p)
  const directional = n < 30 || variance === 0
  const moe = directional ? null : z * Math.sqrt(variance / n) * 100
  const target = targetPoints / 100
  // Subtract a hair before ceil so float noise doesn't add a response.
  const neededFor5 = variance === 0 ? 0 : Math.ceil((z * z * variance) / (target * target) - 1e-9)

  return {
    n,
    satisfied,
    dissatisfied,
    neutral,
    pctCsat,
    pctDsat,
    pctNeutral: (neutral / n) * 100,
    average: sum / n,
    moe,
    low: moe === null ? null : Math.max(0, pctCsat - moe),
    high: moe === null ? null : Math.min(100, pctCsat + moe),
    neededFor5,
  }
}

/** Splits pasted text on whitespace, commas and semicolons; keeps whole numbers 1..scale. */
export function parseCsatScores(raw: string, scale: CsatScale): { counts: number[]; skipped: number } {
  const counts = Array.from({ length: scale }, () => 0)
  let skipped = 0
  for (const token of raw.split(/[\s,;]+/)) {
    if (!token) continue
    const score = /^\d{1,2}$/.test(token) ? Number(token) : NaN
    if (score >= 1 && score <= scale) counts[score - 1]++
    else skipped++
  }
  return { counts, skipped }
}

/** One decimal: 77.0 */
export function fmt1(v: number | null, digits = 1): string {
  return v === null || !Number.isFinite(v) ? '—' : v.toFixed(digits)
}
