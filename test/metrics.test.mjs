import { test } from 'node:test'
import assert from 'node:assert/strict'
import { occupancyFromActuals, occupancyBand, callsAtOccupancy, forecastAt } from '../dist/occupancy.js'
import { ahtFromTotals, ahtByCohort, mmss } from '../dist/aht.js'
import { fcrFromTotals, fcrBySplit } from '../dist/fcr.js'
import { csatStats, parseCsatScores, ruleSentence } from '../dist/csat.js'
import { npsStats, parseScores, countsFromDistribution, formatPoints } from '../dist/nps.js'
import { costPerTicket, aiCompare, median } from '../dist/cost-per-ticket.js'
import * as all from '../dist/index.js'

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b} (±${eps})`)

test('index exposes every module as a namespace', () => {
  for (const ns of ['erlangC', 'occupancy', 'aht', 'fcr', 'csat', 'nps', 'costPerTicket']) assert.equal(typeof all[ns], 'object')
  assert.equal(typeof all.erlangC.solveStaffing, 'function')
})

test('occupancy from actuals', () => {
  const r = occupancyFromActuals({ handle: 400, available: 100, aux: 50, shift: 600 })
  close(r.occupancy, 0.8)
  close(r.idle, 0.2)
  close(r.utilization.loggedInOverShift, 550 / 600)
  close(r.utilization.handleOverLoggedIn, 400 / 550)
  assert.equal(occupancyFromActuals({ handle: 400, available: 100, aux: 200, shift: 600 }).error, "Logged-in time can't exceed the shift")
  assert.equal(occupancyFromActuals({ handle: 0, available: 0 }).error, 'Enter handle time or available time')
})

test('occupancy bands and capacity', () => {
  assert.equal(occupancyBand(0.9), 'high')
  assert.equal(occupancyBand(0.85), 'sustainable')
  assert.equal(occupancyBand(0.6), 'low')
  // 10 agents × 1800 s × 0.85 ÷ 180 s = 85 calls
  assert.equal(callsAtOccupancy(10, 1800, 180), 85)
})

test('forecastAt flags an unstable queue', () => {
  const ok = forecastAt({ calls: 100, intervalSec: 1800, ahtSec: 180, agents: 13, targetSec: 20 })
  assert.equal(ok.stable, true)
  close(ok.occupancy, 10 / 13)
  const bad = forecastAt({ calls: 100, intervalSec: 1800, ahtSec: 180, agents: 10, targetSec: 20 })
  assert.equal(bad.stable, false)
  assert.equal(bad.serviceLevel, 0)
})

test('AHT from totals', () => {
  const r = ahtFromTotals({ talk: 3000, hold: 600, acw: 1200, contacts: 10 })
  assert.equal(r.aht, 480)
  close(r.split.talk, 0.625)
  assert.equal(ahtFromTotals({ talk: 1, hold: 0, acw: 0, contacts: 0 }).error, 'Enter the number of contacts handled')
  assert.equal(mmss(605), '10:05')
  assert.equal(mmss(3725), '1:02:05')
})

test('AHT by cohort separates blended and human AHT', () => {
  const r = ahtByCohort({
    aiOnly: { contacts: 400, ai: 90 },
    handoff: { contacts: 100, ai: 60, talk: 300, hold: 30, acw: 90 },
    human: { contacts: 500, talk: 280, hold: 20, acw: 60 },
    baseline: 380,
  })
  assert.equal(r.contacts, 1000)
  // human time = 100 × 420 + 500 × 360 = 222,000 over 600 people-touched contacts
  close(r.humanAht, 370)
  // all time = AI (36,000 + 6,000) + human 222,000 = 264,000 over 1,000
  close(r.blended, 264)
  close(r.aiOnlyShare, 0.4)
  close(r.baseline.blendedChange, 264 / 380 - 1)
})

test('FCR from totals with margin of error', () => {
  const r = fcrFromTotals({ contacts: 1000, resolved: 720, unresolvable: 40 })
  close(r.gross, 0.72)
  close(r.net, 720 / 960)
  close(r.moe, 1.96 * Math.sqrt((0.72 * 0.28) / 1000))
  assert.equal(r.neededFor5, Math.ceil((1.96 ** 2 * 0.72 * 0.28) / 0.0025))
  assert.equal(fcrFromTotals({ contacts: 20, resolved: 10 }).moe, null) // under 30
  assert.ok('error' in fcrFromTotals({ contacts: 10, resolved: 11 }))
})

test('FCR split never counts a handoff as first contact resolution', () => {
  const r = fcrBySplit({ ai: 600, aiResolved: 300, escalated: 200, escalatedResolved: 150, human: 400, humanResolved: 280 })
  close(r.strict, (300 + 280) / 1000)
  close(r.customer, (300 + 150 + 280) / 1000)
  assert.equal(r.dropped, 100)
  close(r.aiRate, 0.5)
  close(r.aiRateIfDroppedCounted, 400 / 600)
})

test('CSAT top-2-box on a 5-point scale', () => {
  const r = csatStats([5, 5, 10, 30, 50], 5)
  assert.equal(r.n, 100)
  close(r.pctCsat, 80)
  close(r.pctDsat, 10)
  close(r.average, (5 + 10 + 30 + 120 + 250) / 100)
  close(r.moe, 1.96 * Math.sqrt(0.16 / 100) * 100)
  assert.equal(r.neededFor5, 246)
  assert.equal(csatStats([0, 0, 0], 3), null)
  assert.equal(ruleSentence(10, 2), 'CSAT = share of responses scoring 9–10 on a 1–10 scale (top 2 boxes)')
})

test('CSAT parser keeps only valid scores', () => {
  const r = parseCsatScores('5, 4; 5 x 9 0 3', 5)
  assert.deepEqual(r.counts, [0, 0, 1, 1, 2])
  assert.equal(r.skipped, 3)
})

test('NPS with Wald margin of error', () => {
  const r = npsStats({ promoters: 50, passives: 30, detractors: 20 })
  close(r.nps, 30)
  close(r.variance, 0.61)
  close(r.moe, 1.96 * Math.sqrt(0.61 / 100) * 100)
  assert.equal(r.neededFor5, Math.ceil((1.96 ** 2 * 0.61) / 0.0025))
  assert.equal(npsStats({ promoters: 0, passives: 0, detractors: 0 }), null)
})

test('NPS parsing and grouping', () => {
  const p = parseScores('10 9 8 7 6 0 11 abc')
  assert.deepEqual(p, { promoters: 2, passives: 2, detractors: 2, skipped: 2 })
  assert.deepEqual(countsFromDistribution([1, 0, 0, 0, 0, 0, 2, 3, 0, 4, 5]), { promoters: 9, passives: 3, detractors: 3 })
  assert.equal(formatPoints(-12.5), '−12.5')
  assert.equal(formatPoints(-0.01), '0.0')
})

test('cost per ticket, contact and verified resolution', () => {
  const r = costPerTicket({ agents: 10, loadedPerAgent: 60000, tooling: 24000, overheadPct: 0.2, tickets: 5000, verified: 0.8, recontact: 0.1 })
  assert.equal(r.annual, 744000)
  assert.equal(r.monthly, 62000)
  close(r.perTicket, 12.4)
  close(r.perContact, 62000 / 5500)
  close(r.resolutions, 3600)
  close(r.perResolution, 62000 / 3600)
  assert.equal(r.ticketsPerAgent, 500)
  assert.ok('error' in costPerTicket({ agents: 0, loadedPerAgent: 1, tooling: 0, tickets: 1, verified: 0, recontact: 0 }))
})

test('AI cost per resolution vs per ticket touched', () => {
  const r = aiCompare(1.0, 0.5, 12)
  close(r.perTouched, 0.5)
  close(r.followUp, 6)
  close(r.perTouchedAllIn, 6.5)
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 2, 3]), 2.5)
})
