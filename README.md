# contact-center-math

[![CI](https://github.com/andrewhall07/contact-center-math/actions/workflows/ci.yml/badge.svg)](https://github.com/andrewhall07/contact-center-math/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen)

Erlang C staffing, service level, occupancy, average handle time, first contact resolution, CSAT, NPS and cost per ticket for support and contact-center teams, as small, pure TypeScript functions.

**Docs, worked examples and live demos:** https://andrewhall07.github.io/contact-center-math/

- **Numerically stable Erlang C.** Uses the Erlang B recursion instead of `A^N / N!`, so it handles thousands of agents without overflow. Tested against the factorial closed form and the published A = 10 table.
- **Models AI in the queue.** AI containment in staffing, AHT split into AI-only, handoff and human cohorts, and an FCR that never counts an AI-to-human handoff as resolved on first contact.
- **Reports uncertainty.** CSAT, NPS and FCR return a 95% margin of error and the sample size needed for ±5 points.
- **Explicit edge cases.** Unstable queues, impossible targets and invalid inputs return flags or error messages, never `NaN`.

## Install

```bash
npm install github:andrewhall07/contact-center-math
```

ES modules, Node 18+ and modern browsers. Each module can be imported on its own.

## Quick start

```ts
import { solveStaffing } from 'contact-center-math/erlang-c'

const r = solveStaffing({
  contacts: 100,     // per interval
  intervalSec: 1800, // 30 minutes
  ahtSec: 180,
  targetSL: 0.8,     // 80% answered…
  targetSec: 20,     // …within 20 seconds
  shrinkage: 0.3,
})
// r.agents     → 14   (13 agents reach 79.6%, just short of 80/20)
// r.scheduled  → 20   (after 30% shrinkage)
// r.serviceLevel → 0.888, r.asaSec → 7.8, r.occupancy → 0.714
```

```ts
import { npsStats } from 'contact-center-math/nps'

npsStats({ promoters: 210, passives: 120, detractors: 70 })
// { nps: 35, moe: 7.45, low: 27.6, high: 42.4, neededFor5: 888, … }
```

Everything is also available from the root as namespaces:

```ts
import { erlangC, occupancy, aht, fcr, csat, nps, costPerTicket } from 'contact-center-math'
```

## Modules

| Module | Main functions | Docs |
|---|---|---|
| `erlang-c` | `solveStaffing`, `erlangC`, `erlangB`, `serviceLevel`, `averageSpeedOfAnswer`, `grossUpForShrinkage`, `staffingTable` | [Erlang C](https://andrewhall07.github.io/contact-center-math/erlang-c.html) |
| `occupancy` | `occupancyFromActuals`, `occupancyBand`, `callsAtOccupancy`, `forecastAt` | [Occupancy](https://andrewhall07.github.io/contact-center-math/occupancy.html) |
| `aht` | `ahtFromTotals`, `ahtByCohort`, `mmss` | [AHT](https://andrewhall07.github.io/contact-center-math/aht.html) |
| `fcr` | `fcrFromTotals`, `fcrBySplit` | [FCR](https://andrewhall07.github.io/contact-center-math/fcr.html) |
| `csat` | `csatStats`, `parseCsatScores`, `ruleSentence` | [CSAT](https://andrewhall07.github.io/contact-center-math/csat.html) |
| `nps` | `npsStats`, `parseScores`, `countsFromDistribution` | [NPS](https://andrewhall07.github.io/contact-center-math/nps.html) |
| `cost-per-ticket` | `costPerTicket`, `aiCompare` | [Cost per ticket](https://andrewhall07.github.io/contact-center-math/cost-per-ticket.html) |

## Formulas at a glance

```
Traffic (Erlangs)   A   = contacts × AHT ÷ interval
P(wait)             P_W = N·B ÷ (N − A·(1 − B))        B = Erlang B
Service level       SL  = 1 − P_W · e^(−(N − A)·T ÷ AHT)
Avg speed of answer ASA = P_W · AHT ÷ (N − A)
Occupancy               = handle ÷ (handle + available)
AHT                     = (talk + hold + wrap-up) ÷ contacts handled
FCR (gross)             = resolved first time ÷ contacts
CSAT                    = top-box responses ÷ responses
NPS                     = %promoters − %detractors
NPS variance            = p⁺ + p⁻ − (p⁺ − p⁻)²
Cost per ticket         = fully loaded monthly cost ÷ tickets
```

## Limits worth knowing

- Erlang C assumes callers never abandon, so it slightly overstaffs busy intervals. Use short intervals (15–30 min), not daily totals.
- Chat agents working several conversations at once are not modelled. Treat chat separately.
- After an AI agent takes the easy contacts, the remaining human AHT usually rises. Re-measure it instead of reusing the old figure.

## Calculators

To get the same formulas without writing code, the free calculators on [Resolution Index (RTCI)](https://www.resolutionindex.com/tools) use them in the browser, with staffing tables and charts.

## Development

```bash
npm install
npm test        # builds, then runs node:test
npm run docs    # builds the docs site into _site/
```

## License

[MIT](LICENSE)
