/**
 * Average handle time (AHT) math. Pure functions, no I/O.
 * AHT = (talk + hold + after-contact work) ÷ contacts handled. All times in seconds.
 */

export interface TotalsInput {
  talk: number
  hold: number
  acw: number
  contacts: number
}

export interface TotalsResult {
  aht: number | null
  total: number
  /** Shares of the numerator, 0–1; null when the total is 0. */
  split: { talk: number; hold: number; acw: number } | null
  error: string | null
}

const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x >= 0)

export function ahtFromTotals({ talk, hold, acw, contacts }: TotalsInput): TotalsResult {
  const total = talk + hold + acw
  if (!ok(talk, hold, acw, contacts)) return { aht: null, total: 0, split: null, error: 'Times and contacts must be zero or more' }
  if (contacts <= 0) return { aht: null, total, split: null, error: 'Enter the number of contacts handled' }
  return {
    aht: total / contacts,
    total,
    split: total > 0 ? { talk: talk / total, hold: hold / total, acw: acw / total } : null,
    error: null,
  }
}

/** Per-contact averages, in seconds, for one cohort. */
export interface HumanTime {
  talk: number
  hold: number
  acw: number
}

export interface CohortInput {
  /** Contacts the AI handled end to end, with no person involved. */
  aiOnly: { contacts: number; ai: number }
  /** Contacts the AI started and handed to a person. */
  handoff: { contacts: number; ai: number } & HumanTime
  /** Contacts that went straight to a person. */
  human: { contacts: number } & HumanTime
  /** Optional AHT before AI (seconds per contact, all contacts handled by people). 0 = not given. */
  baseline?: number
}

export interface CohortResult {
  contacts: number
  humanContacts: number
  /** All time (AI + human) ÷ all contacts. */
  blended: number
  /** Human time ÷ contacts a person touched (handoff + human only). null when no person touched any. */
  humanAht: number | null
  /** Per-cohort AHT; the handoff figure counts AI time + human time. */
  aiOnlyAht: number | null
  handoffAht: number | null
  humanOnlyAht: number | null
  aiTime: number
  humanTime: number
  /** Share of all handled contacts that never reached a person. */
  aiOnlyShare: number
  /** Present when a baseline is given: the same contact count at the old AHT, all handled by people. */
  baseline: { aht: number; humanTime: number; blendedChange: number; humanAhtChange: number | null; humanTimeChange: number } | null
  error: string | null
}

const sum = (h: HumanTime) => h.talk + h.hold + h.acw

export function ahtByCohort(input: CohortInput): CohortResult | { error: string } {
  const { aiOnly, handoff, human } = input
  const base = input.baseline ?? 0
  const all = [aiOnly.contacts, aiOnly.ai, handoff.contacts, handoff.ai, handoff.talk, handoff.hold, handoff.acw, human.contacts, human.talk, human.hold, human.acw, base]
  if (!ok(...all)) return { error: 'Times and contacts must be zero or more' }
  const contacts = aiOnly.contacts + handoff.contacts + human.contacts
  if (contacts <= 0) return { error: 'Enter contacts for at least one group' }
  const humanContacts = handoff.contacts + human.contacts
  const aiTime = aiOnly.contacts * aiOnly.ai + handoff.contacts * handoff.ai
  const humanTime = handoff.contacts * sum(handoff) + human.contacts * sum(human)
  const blended = (aiTime + humanTime) / contacts
  const humanAht = humanContacts > 0 ? humanTime / humanContacts : null
  const baseHuman = base * contacts
  return {
    contacts,
    humanContacts,
    blended,
    humanAht,
    aiOnlyAht: aiOnly.contacts > 0 ? aiOnly.ai : null,
    handoffAht: handoff.contacts > 0 ? handoff.ai + sum(handoff) : null,
    humanOnlyAht: human.contacts > 0 ? sum(human) : null,
    aiTime,
    humanTime,
    aiOnlyShare: aiOnly.contacts / contacts,
    baseline:
      base > 0
        ? {
            aht: base,
            humanTime: baseHuman,
            blendedChange: blended / base - 1,
            humanAhtChange: humanAht === null ? null : humanAht / base - 1,
            humanTimeChange: humanTime / baseHuman - 1,
          }
        : null,
    error: null,
  }
}

/** 605 → "10:05"; 3725 → "1:02:05". Rounds to whole seconds. */
export function mmss(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}
