import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  trafficIntensity,
  erlangB,
  erlangC,
  serviceLevel,
  averageSpeedOfAnswer,
  grossUpForShrinkage,
  solveStaffing,
  staffingTable,
} from '../dist/erlang-c.js'

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b} (±${eps})`)

/** Textbook closed form, written independently of the library's recursion. */
function erlangCClosedForm(n, a) {
  let sum = 0
  let term = 1 // a^k / k!
  for (let k = 0; k < n; k++) {
    sum += term
    term = (term * a) / (k + 1)
  }
  // term is now a^n / n!
  const top = term * (n / (n - a))
  return top / (sum + top)
}

test('traffic intensity is contacts × AHT ÷ interval', () => {
  close(trafficIntensity(100, 180, 1800), 10)
  close(trafficIntensity(360, 240, 3600), 24)
  assert.equal(trafficIntensity(0, 180, 1800), 0)
  assert.equal(trafficIntensity(100, 180, 0), 0)
})

test('Erlang B matches the classic table value', () => {
  // A = 10 Erlangs on 10 lines blocks ~21.46% of calls.
  close(erlangB(10, 10), 0.21459, 1e-5)
})

test('Erlang C recursion matches the closed form', () => {
  for (const a of [0.5, 2.5, 10, 24, 37.3, 80]) {
    for (let n = Math.floor(a) + 1; n <= Math.floor(a) + 25; n++) {
      close(erlangC(n, a), erlangCClosedForm(n, a), 1e-10)
    }
  }
})

test('Erlang C reproduces the published A = 10 table', () => {
  close(erlangC(11, 10), 0.6821, 1e-4)
  close(erlangC(12, 10), 0.4494, 1e-4)
  close(erlangC(13, 10), 0.2853, 1e-4)
  close(erlangC(14, 10), 0.1741, 1e-4)
})

test('Erlang C edge cases', () => {
  assert.equal(erlangC(5, 0), 0)
  assert.equal(erlangC(10, 10), 1)
  assert.equal(erlangC(9, 10), 1)
  assert.equal(serviceLevel(10, 10, 180, 20), 0)
  assert.equal(averageSpeedOfAnswer(10, 10, 180), Infinity)
})

test('service level and ASA follow the Erlang C formulas', () => {
  const n = 13
  const a = 10
  const pw = erlangCClosedForm(n, a)
  close(serviceLevel(n, a, 180, 20), 1 - pw * Math.exp((-(n - a) * 20) / 180), 1e-10)
  close(averageSpeedOfAnswer(n, a, 180), (pw * 180) / (n - a), 1e-10)
})

test('stays finite for very large centres', () => {
  const pw = erlangC(5200, 5000)
  assert.ok(Number.isFinite(pw) && pw >= 0 && pw <= 1)
})

test('shrinkage gross-up never adds an agent to float error', () => {
  // 21 / 0.7 is 30.000000000000004 in floating point; a naive ceil would give 31.
  assert.equal(grossUpForShrinkage(21, 0.3), 30)
  assert.equal(grossUpForShrinkage(28, 0.3), 40)
  assert.equal(grossUpForShrinkage(14, 0), 14)
  assert.equal(grossUpForShrinkage(14, 0.35), 22)
  assert.equal(grossUpForShrinkage(10, 5), 100) // clamped to 90%
})

test('solveStaffing returns the fewest agents that meet the target', () => {
  const r = solveStaffing({ contacts: 100, intervalSec: 1800, ahtSec: 180, targetSL: 0.8, targetSec: 20 })
  close(r.traffic, 10)
  // 13 agents reach 79.56%, just short of 80/20, so the answer is 14.
  assert.equal(r.agents, 14)
  close(r.serviceLevel, 0.88835, 1e-5)
  close(serviceLevel(13, 10, 180, 20), 0.795595, 1e-6)
  close(r.asaSec, 7.836, 1e-3)
  assert.ok(r.feasible)
})

test('solveStaffing applies AI containment, occupancy cap and shrinkage', () => {
  const base = { contacts: 360, intervalSec: 3600, ahtSec: 240, targetSL: 0.8, targetSec: 20 }
  const plain = solveStaffing(base)
  const contained = solveStaffing({ ...base, aiContainment: 0.25 })
  close(contained.offered, 270)
  assert.ok(contained.agents < plain.agents)

  const capped = solveStaffing({ ...base, maxOccupancy: 0.75 })
  assert.ok(capped.occupancy <= 0.75 + 1e-12)
  assert.ok(capped.agents >= Math.ceil(plain.traffic / 0.75))

  const shrunk = solveStaffing({ ...base, shrinkage: 0.3 })
  assert.equal(shrunk.scheduled, grossUpForShrinkage(plain.agents, 0.3))
})

test('staffingTable brackets the answer', () => {
  const r = solveStaffing({ contacts: 100, intervalSec: 1800, ahtSec: 180, targetSL: 0.8, targetSec: 20 })
  const rows = staffingTable(r, 180, 20)
  assert.deepEqual(
    rows.map((x) => x.agents),
    [12, 13, 14, 15, 16],
  )
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].serviceLevel > rows[i - 1].serviceLevel)
})
