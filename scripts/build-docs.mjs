// Builds the static docs site into _site/. Worked-example numbers are computed
// from the compiled library at build time, so the docs cannot drift from the code.
import { mkdirSync, rmSync, writeFileSync, cpSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as E from '../dist/erlang-c.js'
import * as O from '../dist/occupancy.js'
import * as A from '../dist/aht.js'
import * as F from '../dist/fcr.js'
import * as C from '../dist/csat.js'
import * as N from '../dist/nps.js'
import * as K from '../dist/cost-per-ticket.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '_site')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const BASE = 'https://andrewhall07.github.io/contact-center-math/'
const REPO = 'https://github.com/andrewhall07/contact-center-math'
const RTCI = 'https://www.resolutionindex.com'

const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------- Worked examples (computed) ----------
const st = E.solveStaffing({ contacts: 100, intervalSec: 1800, ahtSec: 180, targetSL: 0.8, targetSec: 20, shrinkage: 0.3 })
const st13 = E.intervalAt(13, 10, 180, 20)
const table = E.staffingTable(st, 180, 20)
const occ = O.occupancyFromActuals({ handle: 5.6, available: 1.1, aux: 0.8, shift: 8 })
const ahtT = A.ahtFromTotals({ talk: 21000, hold: 3000, acw: 6000, contacts: 75 })
const ahtC = A.ahtByCohort({
  aiOnly: { contacts: 400, ai: 90 },
  handoff: { contacts: 100, ai: 60, talk: 300, hold: 30, acw: 90 },
  human: { contacts: 500, talk: 280, hold: 20, acw: 60 },
  baseline: 380,
})
const fcrT = F.fcrFromTotals({ contacts: 1000, resolved: 720, unresolvable: 40 })
const fcrS = F.fcrBySplit({ ai: 600, aiResolved: 300, escalated: 200, escalatedResolved: 150, human: 400, humanResolved: 280 })
const cs = C.csatStats([12, 18, 40, 150, 180], 5)
const np = N.npsStats({ promoters: 210, passives: 120, detractors: 70 })
const cpt = K.costPerTicket({ agents: 12, loadedPerAgent: 58000, tooling: 30000, overheadPct: 0.15, tickets: 6000, verified: 0.82, recontact: 0.12 })
const money = (x) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ---------- Pages ----------
const pages = [
  {
    slug: 'erlang-c',
    module: 'erlang-c',
    title: 'Erlang C in JavaScript: agents, service level and ASA',
    nav: 'Erlang C',
    description:
      'Erlang C staffing in TypeScript: traffic intensity, probability of waiting, service level, average speed of answer and shrinkage, with a worked example and a live demo.',
    lede: 'Erlang C answers the core staffing question for a queue: how many agents do you need on the phones so that a target share of contacts is answered within a target time?',
    sections: [
      [
        'The formulas',
        `<pre class="formula">A    = λ × h ÷ I                       traffic intensity (Erlangs)
P_W  = N·B ÷ (N − A·(1 − B))            probability a contact waits (B = Erlang B)
SL   = 1 − P_W · e^(−(N − A) · T ÷ h)   share answered within T seconds
ASA  = P_W · h ÷ (N − A)                average speed of answer
sched = ⌈N ÷ (1 − shrinkage)⌉           agents to schedule</pre>
<p>λ is contacts per interval, <i>h</i> is average handle time, <i>I</i> is the interval length and <i>N</i> is agents on the phones. The library computes Erlang B with the recursion <code>B = A·B ÷ (j + A·B)</code> instead of <code>A<sup>N</sup> ÷ N!</code>, so it stays numerically stable for thousands of agents. The tests check it against the factorial form and the published A = 10 table.</p>`,
      ],
      [
        'Worked example',
        `<p>100 contacts in a 30-minute interval, a 3-minute AHT, a target of 80% answered in 20 seconds and 30% shrinkage.</p>
<ul>
<li>Traffic: 100 × 180 ÷ 1800 = <b>${st.traffic} Erlangs</b>.</li>
<li>13 agents reach ${pct(st13.serviceLevel, 2)}, just short of the target. Rounding traffic up "plus a few" is how teams end up one agent short.</li>
<li><b>${st.agents} agents</b> on the phones give ${pct(st.serviceLevel)} in 20 s, an ASA of ${st.asaSec.toFixed(1)} s and ${pct(st.occupancy)} occupancy.</li>
<li>After 30% shrinkage, schedule <b>${st.scheduled} agents</b>.</li>
</ul>
<table><thead><tr><th>Agents</th><th>P(wait)</th><th>Service level</th><th>ASA</th><th>Occupancy</th></tr></thead><tbody>
${table.map((r) => `<tr${r.agents === st.agents ? ' class="hit"' : ''}><td>${r.agents}</td><td>${pct(r.pWait)}</td><td>${pct(r.serviceLevel)}</td><td>${r.asaSec.toFixed(1)} s</td><td>${pct(r.occupancy)}</td></tr>`).join('\n')}
</tbody></table>`,
      ],
      [
        'Usage',
        `<pre><code>import { solveStaffing, staffingTable } from 'contact-center-math/erlang-c'

const r = solveStaffing({
  contacts: 100,      // per interval
  intervalSec: 1800,  // 30 minutes
  ahtSec: 180,
  targetSL: 0.8,      // 80% …
  targetSec: 20,      // … in 20 seconds
  shrinkage: 0.3,
  maxOccupancy: 0.85, // optional cap
  aiContainment: 0,   // share of contacts an AI agent fully handles first
})
// r.agents, r.scheduled, r.serviceLevel, r.asaSec, r.occupancy, r.feasible</code></pre>`,
      ],
      [
        'Things Erlang C gets wrong',
        `<ul>
<li><b>No abandonment.</b> Erlang C assumes every caller waits forever. Real queues lose impatient callers, so it slightly overstaffs busy intervals. Erlang A models abandonment if you have patience data.</li>
<li><b>Steady arrivals inside the interval.</b> Use 15- or 30-minute intervals, not daily totals. A daily average hides the peaks that drive staffing.</li>
<li><b>Chat concurrency.</b> An agent working three chats is not three agents. Model chat separately.</li>
<li><b>AI containment changes the mix.</b> If an AI agent resolves the easy contacts, the remaining contacts usually have a <i>longer</i> AHT. Re-measure AHT after rollout instead of keeping the old figure.</li>
</ul>`,
      ],
    ],
    demo: {
      inputs: [
        ['contacts', 'Contacts per interval', 100],
        ['interval', 'Interval (minutes)', 30],
        ['aht', 'AHT (seconds)', 180],
        ['sl', 'Target service level (%)', 80],
        ['t', 'Target answer time (seconds)', 20],
        ['shrink', 'Shrinkage (%)', 30],
      ],
      run: (M, v) => {
        const r = M.solveStaffing({ contacts: v.contacts, intervalSec: v.interval * 60, ahtSec: v.aht, targetSL: v.sl / 100, targetSec: v.t, shrinkage: v.shrink / 100 })
        if (!r.feasible) return [['Result', 'No headcount meets this target']]
        return [
          ['Agents on phones', r.agents],
          ['Agents to schedule', r.scheduled],
          ['Service level', (r.serviceLevel * 100).toFixed(1) + '%'],
          ['Average speed of answer', r.asaSec.toFixed(1) + ' s'],
          ['Occupancy', (r.occupancy * 100).toFixed(1) + '%'],
        ]
      },
    },
    links: [
      [`${RTCI}/tools/erlang-c-calculator`, 'Erlang C calculator with a staffing table'],
      [`${RTCI}/tools/customer-support-staffing-calculator`, 'Support staffing calculator for ticket queues'],
    ],
  },
  {
    slug: 'occupancy',
    module: 'occupancy',
    title: 'Call center occupancy: formula, healthy range and capacity',
    nav: 'Occupancy',
    description:
      'Agent occupancy from actual handle and available time, how it differs from utilization, the 85% ceiling, and occupancy at a fixed headcount via Erlang C.',
    lede: 'Occupancy is the share of logged-in, ready time that agents spend handling contacts. It is the clearest single signal of whether a team is overloaded or idle.',
    sections: [
      [
        'The formulas',
        `<pre class="formula">occupancy   = handle ÷ (handle + available)
idle        = 1 − occupancy
utilization = handle ÷ shift   (one of several definitions in use)
capacity    = ⌊occ × N × I ÷ h⌋   contacts N agents take at a given occupancy</pre>
<p>Occupancy only counts time when the agent is ready: handling or waiting for a contact. Meetings, coaching and admin ("aux") are left out. Utilization divides by the whole shift instead, and vendors define it in at least three ways. <code>occupancyFromActuals</code> returns all three so reports can say which one they mean.</p>`,
      ],
      [
        'Worked example',
        `<p>In an 8-hour shift an agent handles contacts for 5.6 h, is available for 1.1 h and spends 0.8 h in aux.</p>
<ul>
<li>Occupancy: 5.6 ÷ (5.6 + 1.1) = <b>${pct(occ.occupancy)}</b>, in the <b>${O.occupancyBand(occ.occupancy)}</b> band.</li>
<li>Logged in ÷ shift: ${pct(occ.utilization.loggedInOverShift)}. Handle ÷ shift: ${pct(occ.utilization.handleOverShift)}. Handle ÷ logged in: ${pct(occ.utilization.handleOverLoggedIn)}.</li>
<li>At 85% occupancy, 10 agents with a 3-minute AHT can take <b>${O.callsAtOccupancy(10, 1800, 180)}</b> calls per half hour.</li>
</ul>
<p>Sustained occupancy above about 85% is widely linked to burnout and attrition. Below about 70%, the team is usually overstaffed for the interval. <code>occupancyBand</code> uses those two edges.</p>`,
      ],
      [
        'Usage',
        `<pre><code>import { occupancyFromActuals, forecastAt } from 'contact-center-math/occupancy'

occupancyFromActuals({ handle: 5.6, available: 1.1, aux: 0.8, shift: 8 })
// { occupancy: 0.836, idle: 0.164, utilization: { … }, error: null }

forecastAt({ calls: 100, intervalSec: 1800, ahtSec: 180, agents: 13, targetSec: 20 })
// Erlang C occupancy, service level and ASA at a fixed headcount</code></pre>`,
      ],
    ],
    demo: {
      inputs: [
        ['handle', 'Handle time (hours)', 5.6],
        ['available', 'Available time (hours)', 1.1],
        ['aux', 'Aux time (hours)', 0.8],
        ['shift', 'Shift (hours)', 8],
      ],
      run: (M, v) => {
        const r = M.occupancyFromActuals(v)
        if (r.error) return [['Result', r.error]]
        const out = [
          ['Occupancy', (r.occupancy * 100).toFixed(1) + '%'],
          ['Band', M.occupancyBand(r.occupancy)],
        ]
        if (r.utilization) out.push(['Handle ÷ shift', (r.utilization.handleOverShift * 100).toFixed(1) + '%'])
        return out
      },
    },
    links: [[`${RTCI}/tools/call-center-occupancy-calculator`, 'Call center occupancy calculator']],
  },
  {
    slug: 'aht',
    module: 'aht',
    title: 'Average handle time (AHT): formula and AI-era cohorts',
    nav: 'AHT',
    description:
      'Average handle time from talk, hold and after-contact work, plus a cohort view that separates AI-only, handoff and human contacts so AHT stays honest after an AI rollout.',
    lede: 'AHT is the average time a contact takes from first word to finished wrap-up. It is the input every staffing model depends on, and it is easy to distort once an AI agent handles part of the queue.',
    sections: [
      [
        'The formula',
        `<pre class="formula">AHT = (talk + hold + after-contact work) ÷ contacts handled</pre>
<p>Use contacts <i>handled</i>, not contacts offered: abandoned calls have no handle time. Keep hold and wrap-up in the numerator. Leaving them out is the most common reason AHT looks better than staffing reality.</p>`,
      ],
      [
        'Worked example',
        `<p>75 contacts with 21,000 s of talk, 3,000 s of hold and 6,000 s of wrap-up: AHT = 30,000 ÷ 75 = <b>${A.mmss(ahtT.aht)}</b> (${ahtT.aht} s), of which ${pct(ahtT.split.acw, 0)} is wrap-up.</p>`,
      ],
      [
        'AHT after an AI rollout',
        `<p>When an AI agent resolves easy contacts on its own, a single AHT figure mixes very different work. <code>ahtByCohort</code> reports AI-only, handoff and human-only contacts separately.</p>
<p>Example: 400 AI-only contacts, 100 handoffs and 500 human-only contacts, against a 380 s baseline.</p>
<ul>
<li>Blended AHT across all 1,000 contacts: <b>${Math.round(ahtC.blended)} s</b>, ${pct(Math.abs(ahtC.baseline.blendedChange), 0)} below baseline. This is the number that gets put on slides.</li>
<li>Human AHT on the 600 contacts a person touched: <b>${Math.round(ahtC.humanAht)} s</b>, only ${pct(Math.abs(ahtC.baseline.humanAhtChange), 1)} lower. Staffing should use this number.</li>
</ul>
<p>Plugging the blended figure into Erlang C would understaff the human queue.</p>`,
      ],
      [
        'Usage',
        `<pre><code>import { ahtFromTotals, ahtByCohort, mmss } from 'contact-center-math/aht'

const { aht } = ahtFromTotals({ talk: 21000, hold: 3000, acw: 6000, contacts: 75 })
mmss(aht) // "6:40"</code></pre>`,
      ],
    ],
    demo: {
      inputs: [
        ['talk', 'Total talk time (s)', 21000],
        ['hold', 'Total hold time (s)', 3000],
        ['acw', 'Total wrap-up time (s)', 6000],
        ['contacts', 'Contacts handled', 75],
      ],
      run: (M, v) => {
        const r = M.ahtFromTotals(v)
        if (r.error) return [['Result', r.error]]
        return [
          ['AHT', M.mmss(r.aht) + ' (' + Math.round(r.aht) + ' s)'],
          ['Wrap-up share', r.split ? (r.split.acw * 100).toFixed(0) + '%' : '—'],
        ]
      },
    },
    links: [[`${RTCI}/tools/average-handle-time-calculator`, 'Average handle time calculator with AI cohorts']],
  },
  {
    slug: 'fcr',
    module: 'fcr',
    title: 'First contact resolution (FCR): gross, net and AI handoffs',
    nav: 'FCR',
    description:
      'First contact resolution as gross and net rates with a 95% margin of error, and a strict split that never counts an AI-to-human handoff as resolved on first contact.',
    lede: 'FCR is the share of issues solved in the first contact, with no transfer, callback or repeat contact inside the measurement window.',
    sections: [
      [
        'The formulas',
        `<pre class="formula">gross FCR = resolved on first contact ÷ all contacts
net FCR   = resolved on first contact ÷ (contacts − unresolvable by design)
MoE (95%) = 1.96 × √(p(1 − p) ÷ n)</pre>
<p>Net FCR removes contacts that could never be resolved on the first touch, such as a field visit, so always say which one you report. When FCR comes from a survey, the margin of error tells you whether a month-on-month change is real.</p>`,
      ],
      [
        'Worked example',
        `<p>1,000 contacts, 720 resolved first time, 40 unresolvable by design.</p>
<ul>
<li>Gross FCR <b>${pct(fcrT.gross)}</b> ± ${(fcrT.moe * 100).toFixed(1)} points. Net FCR <b>${pct(fcrT.net)}</b>.</li>
<li>Responses needed for ±5 points at this rate: ${fcrT.neededFor5}.</li>
</ul>`,
      ],
      [
        'AI handoffs are not first contact resolution',
        `<p>600 contacts go to an AI agent first. It resolves 300, hands 200 to a person (who resolves 150 in the same conversation), and 100 leave with neither. Another 400 go straight to people, who resolve 280.</p>
<ul>
<li>Strict FCR, where a handoff never counts: <b>${pct(fcrS.strict)}</b>.</li>
<li>Customer view, where a same-conversation handoff that ends resolved does count: <b>${pct(fcrS.customer)}</b>.</li>
<li>AI resolution rate: <b>${pct(fcrS.aiRate)}</b>. Counting the 100 dropped contacts as resolved, the way a deflection metric does, would show ${pct(fcrS.aiRateIfDroppedCounted)}.</li>
</ul>`,
      ],
      [
        'Usage',
        `<pre><code>import { fcrFromTotals, fcrBySplit } from 'contact-center-math/fcr'

fcrFromTotals({ contacts: 1000, resolved: 720, unresolvable: 40 })
// { gross: 0.72, net: 0.75, moe: 0.0278, neededFor5: 310, … }</code></pre>`,
      ],
    ],
    demo: {
      inputs: [
        ['contacts', 'Contacts', 1000],
        ['resolved', 'Resolved on first contact', 720],
        ['unresolvable', 'Unresolvable by design (optional)', 40],
      ],
      run: (M, v) => {
        const r = M.fcrFromTotals(v)
        if (r.error) return [['Result', r.error]]
        return [
          ['Gross FCR', (r.gross * 100).toFixed(1) + '%'],
          ['Net FCR', r.net === null ? '—' : (r.net * 100).toFixed(1) + '%'],
          ['95% margin of error', r.moe === null ? 'n < 30, directional only' : '± ' + (r.moe * 100).toFixed(1) + ' pts'],
        ]
      },
    },
    links: [
      [`${RTCI}/tools/first-contact-resolution-calculator`, 'First contact resolution calculator'],
      [`${RTCI}/blog/first-contact-vs-end-to-end-resolution`, 'First-contact vs end-to-end resolution'],
    ],
  },
  {
    slug: 'csat',
    module: 'csat',
    title: 'CSAT score: top-box formula, scales and margin of error',
    nav: 'CSAT',
    description:
      'Customer satisfaction (CSAT) as a top-box share on 1–3, 1–5, 1–7 and 1–10 scales, with DSAT, average score, 95% margin of error and the sample size needed for ±5 points.',
    lede: 'CSAT is the share of survey responses in the top boxes of the scale. The number only means something once you state the scale, the boxes counted and the sample size.',
    sections: [
      [
        'The formulas',
        `<pre class="formula">CSAT      = responses in top boxes ÷ all responses
DSAT      = responses in bottom boxes ÷ all responses
MoE (95%) = 1.96 × √(p(1 − p) ÷ n) × 100   points
n for ±5  = ⌈1.96² × p(1 − p) ÷ 0.05²⌉</pre>
<p>The default is top 2 boxes on 5-, 7- and 10-point scales, and top box only on a 1–3 scale, where "top 2" would include the neutral midpoint. Under 30 responses, the library returns no margin of error because the result is directional only.</p>`,
      ],
      [
        'Worked example',
        `<p>400 responses on a 1–5 scale: 12, 18, 40, 150 and 180 for scores 1 to 5.</p>
<ul>
<li>${esc(C.ruleSentence(5, 2))}: <b>${cs.pctCsat.toFixed(1)}%</b> ± ${cs.moe.toFixed(1)} points (${cs.low.toFixed(1)}–${cs.high.toFixed(1)}%).</li>
<li>DSAT ${cs.pctDsat.toFixed(1)}%, average score ${cs.average.toFixed(2)} out of 5.</li>
<li>Responses needed for ±5 points: ${cs.neededFor5}.</li>
</ul>`,
      ],
      [
        'Usage',
        `<pre><code>import { csatStats, parseCsatScores } from 'contact-center-math/csat'

const { counts } = parseCsatScores('5 4 5 3 5 4 2 5', 5)
csatStats(counts, 5) // top-2-box by default</code></pre>`,
      ],
    ],
    demo: {
      inputs: [['scores', 'Paste 1–5 scores', '5 4 5 3 5 4 2 5 5 4 1 5 4 4 5 3 5 5 4 5 4 5 5 3 4 5 5 4 2 5 5 4', 'text']],
      run: (M, v) => {
        const p = M.parseCsatScores(v.scores, 5)
        const r = M.csatStats(p.counts, 5)
        if (!r) return [['Result', 'Enter at least one score from 1 to 5']]
        return [
          ['CSAT (top 2 of 5)', r.pctCsat.toFixed(1) + '%'],
          ['Responses', r.n + (p.skipped ? ' (' + p.skipped + ' skipped)' : '')],
          ['95% margin of error', r.moe === null ? 'n < 30, directional only' : '± ' + r.moe.toFixed(1) + ' pts'],
        ]
      },
    },
    links: [
      [`${RTCI}/tools/csat-calculator`, 'CSAT calculator for any scale'],
      [`${RTCI}/blog/csat-vs-nps`, 'CSAT vs NPS: when to use which'],
    ],
  },
  {
    slug: 'nps',
    module: 'nps',
    title: 'Net Promoter Score (NPS): formula and margin of error',
    nav: 'NPS',
    description:
      'Net Promoter Score from 0–10 ratings with the correct margin of error for a difference of two proportions, and the sample size needed to detect a 5-point change.',
    lede: 'NPS is the share of promoters (9–10) minus the share of detractors (0–6), on a scale from −100 to +100. Its margin of error is wider than most dashboards suggest.',
    sections: [
      [
        'The formulas',
        `<pre class="formula">NPS       = (%promoters − %detractors) × 100
Var       = p⁺ + p⁻ − (p⁺ − p⁻)²
MoE (95%) = 1.96 × √(Var ÷ n) × 100   points</pre>
<p>NPS is a difference of two proportions taken from the same sample. Its variance is therefore not the single-proportion <code>p(1 − p)</code>. This is the Wald interval described by MeasuringU and Rocks (2016).</p>`,
      ],
      [
        'Worked example',
        `<p>400 responses: 210 promoters, 120 passives, 70 detractors.</p>
<ul>
<li>NPS <b>${N.formatPoints(np.nps)}</b> ± ${np.moe.toFixed(1)} points (${N.formatPoints(np.low)} to ${N.formatPoints(np.high)}).</li>
<li>Responses needed for ±5 points at this split: ${np.neededFor5}.</li>
</ul>
<p>A month-on-month move from 35 to 39 on 400 responses is noise, not a trend.</p>`,
      ],
      [
        'Usage',
        `<pre><code>import { npsStats, parseScores } from 'contact-center-math/nps'

npsStats(parseScores('10 9 8 6 10 7 9 3 10'))</code></pre>`,
      ],
    ],
    demo: {
      inputs: [
        ['promoters', 'Promoters (9–10)', 210],
        ['passives', 'Passives (7–8)', 120],
        ['detractors', 'Detractors (0–6)', 70],
      ],
      run: (M, v) => {
        const r = M.npsStats(v)
        if (!r) return [['Result', 'Enter at least one response']]
        return [
          ['NPS', M.formatPoints(r.nps)],
          ['95% margin of error', '± ' + r.moe.toFixed(1) + ' pts'],
          ['Range', M.formatPoints(r.low) + ' to ' + M.formatPoints(r.high)],
        ]
      },
    },
    links: [
      [`${RTCI}/tools/net-promoter-score-calculator`, 'NPS calculator with confidence interval'],
      [`${RTCI}/blog/csat-vs-nps`, 'CSAT vs NPS compared'],
    ],
  },
  {
    slug: 'cost-per-ticket',
    module: 'cost-per-ticket',
    title: 'Support cost per ticket, per contact and per resolution',
    nav: 'Cost per ticket',
    description:
      'Fully loaded support cost per ticket, per contact and per verified resolution, plus how to compare AI cost per resolution against a human cost per ticket without mixing denominators.',
    lede: 'Cost per ticket is fully loaded monthly support cost divided by tickets. The denominator decides whether the number helps or misleads, especially when comparing against AI pricing.',
    sections: [
      [
        'The formulas',
        `<pre class="formula">annual        = agents × loaded cost + tooling + overhead
cost/ticket   = (annual ÷ 12) ÷ tickets
cost/contact  = (annual ÷ 12) ÷ (tickets × (1 + re-contact rate))
resolutions   = tickets × verified share × (1 − re-contact rate)
cost/resolution = (annual ÷ 12) ÷ resolutions</pre>`,
      ],
      [
        'Worked example',
        `<p>12 agents at $58,000 loaded, $30,000 a year of tooling, 15% overhead, 6,000 tickets a month, 82% verified resolved and 12% re-contact.</p>
<ul>
<li>Monthly cost ${money(cpt.monthly)}. Cost per ticket <b>${money(cpt.perTicket)}</b>, per contact ${money(cpt.perContact)}.</li>
<li>Cost per verified resolution <b>${money(cpt.perResolution)}</b>, ${pct(cpt.perResolution / cpt.perTicket - 1, 0)} above cost per ticket.</li>
</ul>`,
      ],
      [
        'Comparing against AI pricing',
        `<p>AI vendors usually price per <i>resolution</i>, while support teams track cost per <i>ticket</i>. <code>aiCompare(cost, rate, humanPerTicket)</code> puts both on the same basis: every ticket the AI touches, including the ones it fails on, which still need a person.</p>
<p>At a $0.99 resolution fee and a 50% realistic resolution rate, against the ${money(cpt.perTicket)} human cost above: ${money(K.aiCompare(0.99, 0.5, cpt.perTicket).perTouchedAllIn)} all-in per AI-touched ticket.</p>`,
      ],
      [
        'Usage',
        `<pre><code>import { costPerTicket, aiCompare } from 'contact-center-math/cost-per-ticket'

const r = costPerTicket({ agents: 12, loadedPerAgent: 58000, tooling: 30000,
  overheadPct: 0.15, tickets: 6000, verified: 0.82, recontact: 0.12 })
aiCompare(0.99, 0.5, r.perTicket)</code></pre>`,
      ],
    ],
    demo: {
      inputs: [
        ['agents', 'Agents (FTE)', 12],
        ['loadedPerAgent', 'Loaded cost per agent / year ($)', 58000],
        ['tooling', 'Tooling / year ($)', 30000],
        ['overheadPct', 'Overhead (% of people cost)', 15],
        ['tickets', 'Tickets per month', 6000],
        ['verified', 'Verified resolved (%)', 82],
        ['recontact', 'Re-contact rate (%)', 12],
      ],
      run: (M, v) => {
        const r = M.costPerTicket({ ...v, overheadPct: v.overheadPct / 100, verified: v.verified / 100, recontact: v.recontact / 100 })
        if (r.error) return [['Result', r.error]]
        const f = (x) => '$' + x.toFixed(2)
        return [
          ['Cost per ticket', f(r.perTicket)],
          ['Cost per contact', f(r.perContact)],
          ['Cost per verified resolution', r.perResolution === null ? '—' : f(r.perResolution)],
        ]
      },
    },
    links: [
      [`${RTCI}/tools/cost-per-ticket-calculator`, 'Support cost per ticket calculator'],
      [`${RTCI}/blog/cost-per-verified-resolution-framework`, 'Cost per verified resolution framework'],
    ],
  },
]

// ---------- Template ----------
const css = `
:root{--bg:#fbfbf9;--fg:#1b1d1f;--muted:#5e646b;--line:#e3e3de;--card:#fff;--accent:#0f6b4f;--accent-soft:#e3f1ec;--code:#f3f3ef;--hit:#e3f1ec}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121416;--fg:#e8e9ea;--muted:#9aa1a8;--line:#2a2e33;--card:#181b1e;--accent:#5cc7a1;--accent-soft:#16302a;--code:#1d2125;--hit:#16302a}}
:root[data-theme="dark"]{--bg:#121416;--fg:#e8e9ea;--muted:#9aa1a8;--line:#2a2e33;--card:#181b1e;--accent:#5cc7a1;--accent-soft:#16302a;--code:#1d2125;--hit:#16302a}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}a:hover{text-decoration-thickness:2px}
header.top{border-bottom:1px solid var(--line);background:var(--card)}
.wrap{max-width:780px;margin:0 auto;padding:0 16px}
.top .wrap{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding-top:12px;padding-bottom:12px}
.brand{font-weight:700;color:var(--fg);text-decoration:none;margin-right:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px}
.top nav{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}.top nav a{color:var(--muted);text-decoration:none}.top nav a[aria-current]{color:var(--fg);font-weight:600}
main{padding:36px 0 56px}h1{font-size:clamp(26px,5vw,34px);line-height:1.2;margin:0 0 12px;letter-spacing:-.01em}
.lede{font-size:18px;color:var(--muted);margin:0 0 28px}h2{font-size:21px;margin:36px 0 10px}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13.5px}
:not(pre)>code{background:var(--code);padding:1px 5px;border-radius:4px}
pre{background:var(--code);border:1px solid var(--line);border-radius:8px;padding:14px 16px;overflow-x:auto;line-height:1.55}
pre.formula{border-left:3px solid var(--accent)}
table{border-collapse:collapse;width:100%;font-size:14.5px;margin:14px 0;display:block;overflow-x:auto}
th,td{text-align:left;padding:7px 12px;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--muted);font-weight:600}
tr.hit td{background:var(--hit);font-weight:600}
.demo{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin:28px 0}
.demo h2{margin-top:0}.demo form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.demo label{display:flex;flex-direction:column;font-size:13.5px;color:var(--muted);gap:4px}
.demo input{font:inherit;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:7px 9px;width:100%}
.demo label.wide{grid-column:1/-1}
.demo dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:16px 0 0;padding-top:14px;border-top:1px solid var(--line)}
.demo dt{color:var(--muted)}.demo dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.further{border-top:1px solid var(--line);margin-top:40px;padding-top:6px}.further ul{padding-left:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:18px 0}
.card{display:block;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;text-decoration:none;color:var(--fg)}
.card:hover{border-color:var(--accent)}.card b{display:block;color:var(--accent);margin-bottom:2px}.card span{font-size:14px;color:var(--muted)}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px;padding:22px 0 40px}footer a{color:var(--muted)}
`

const nav = (current) =>
  `<nav aria-label="Modules">${pages.map((p) => `<a href="${p.slug}.html"${p.slug === current ? ' aria-current="page"' : ''}>${p.nav}</a>`).join('')}<a href="${REPO}">GitHub</a></nav>`

function shell({ slug, title, description, body, jsonld }) {
  const url = slug === 'index' ? BASE : `${BASE}${slug}.html`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${slug === 'index' ? 'website' : 'article'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230f6b4f'/%3E%3Ctext x='16' y='22' font-family='monospace' font-size='16' font-weight='700' text-anchor='middle' fill='white'%3EΣ%3C/text%3E%3C/svg%3E">
<style>${css}</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="./">contact-center-math</a>${nav(slug)}</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer><div class="wrap">
<p>MIT licensed · v${pkg.version} · <a href="${REPO}">Source on GitHub</a> · <a href="${REPO}/issues">Report an issue</a></p>
<p>These formulas also power the free support-metric calculators on <a href="${RTCI}/tools">Resolution Index (RTCI)</a>.</p>
</div></footer>
</body>
</html>
`
}

function demoBlock(p) {
  const fields = p.demo.inputs
    .map(([id, label, value, type]) =>
      type === 'text'
        ? `<label class="wide">${esc(label)}<input name="${id}" type="text" value="${esc(value)}"></label>`
        : `<label>${esc(label)}<input name="${id}" type="number" inputmode="decimal" step="any" min="0" value="${value}"></label>`,
    )
    .join('\n')
  return `<section class="demo" aria-labelledby="demo-h">
<h2 id="demo-h">Try it</h2>
<form id="demo" autocomplete="off">
${fields}
</form>
<dl id="out" aria-live="polite"></dl>
</section>
<script type="module">
import * as M from './lib/${p.module}.js'
const run = ${p.demo.run.toString()}
const form = document.getElementById('demo')
const out = document.getElementById('out')
function update() {
  const v = {}
  for (const el of form.elements) v[el.name] = el.type === 'number' ? Number(el.value || 0) : el.value
  out.replaceChildren(...run(M, v).flatMap(([k, val]) => {
    const dt = document.createElement('dt'); dt.textContent = k
    const dd = document.createElement('dd'); dd.textContent = String(val)
    return [dt, dd]
  }))
}
form.addEventListener('input', update)
form.addEventListener('submit', (e) => e.preventDefault())
update()
</script>`
}

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'lib'), { recursive: true })
for (const f of ['erlang-c', 'occupancy', 'aht', 'fcr', 'csat', 'nps', 'cost-per-ticket']) cpSync(join(root, 'dist', `${f}.js`), join(out, 'lib', `${f}.js`))

for (const p of pages) {
  const body = `<article>
<h1>${esc(p.title)}</h1>
<p class="lede">${p.lede}</p>
${p.sections
  .map(([h, html], i) => `<h2>${h}</h2>\n${html}` + (i === 1 ? '\n' + demoBlock(p) : ''))
  .join('\n')}
<section class="further">
<h2>Further reading</h2>
<ul>
${p.links.map(([href, text]) => `<li><a href="${href}">${esc(text)}</a></li>`).join('\n')}
<li><a href="${REPO}/blob/main/src/${p.module}.ts">Source: src/${p.module}.ts</a></li>
</ul>
</section>
</article>`
  writeFileSync(
    join(out, `${p.slug}.html`),
    shell({
      slug: p.slug,
      title: `${p.title} · contact-center-math`,
      description: p.description,
      body,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: p.title,
        description: p.description,
        url: `${BASE}${p.slug}.html`,
        author: { '@type': 'Person', name: 'Andrew', url: 'https://github.com/andrewhall07' },
        isPartOf: { '@type': 'WebSite', name: 'contact-center-math', url: BASE },
        dateModified: new Date().toISOString().slice(0, 10),
      },
    }),
  )
}

const indexBody = `<h1>Contact-center formulas you can test</h1>
<p class="lede">Erlang C staffing, service level, occupancy, AHT, first contact resolution, CSAT, NPS and cost per ticket as small, pure TypeScript functions. Zero dependencies, fully typed, and covered by unit tests. Erlang C is checked against the textbook closed form and published tables.</p>
<pre><code>npm install github:andrewhall07/contact-center-math</code></pre>
<pre><code>import { solveStaffing } from 'contact-center-math/erlang-c'

solveStaffing({ contacts: 100, intervalSec: 1800, ahtSec: 180, targetSL: 0.8, targetSec: 20 })
// → { agents: ${st.agents}, serviceLevel: ${st.serviceLevel.toFixed(3)}, asaSec: ${st.asaSec.toFixed(2)}, occupancy: ${st.occupancy.toFixed(3)}, … }</code></pre>
<h2>Modules</h2>
<div class="grid">
${pages.map((p) => `<a class="card" href="${p.slug}.html"><b>${p.nav}</b><span>${esc(p.description.split('. ')[0].replace(/\.$/, ''))}.</span></a>`).join('\n')}
</div>
<h2>Why another Erlang C implementation?</h2>
<ul>
<li><b>Numerically stable.</b> Erlang B recursion instead of factorials, so 5,000-agent centres work without overflow.</li>
<li><b>Models AI in the queue.</b> AI containment in staffing, AI-vs-human AHT cohorts, and FCR that never counts a handoff as a first-contact resolution.</li>
<li><b>Reports uncertainty.</b> CSAT, NPS and FCR return a 95% margin of error and the sample size needed for ±5 points.</li>
<li><b>Honest edge cases.</b> Unstable queues, impossible targets and invalid inputs return explicit flags or errors, never <code>NaN</code>.</li>
</ul>
<h2>Prefer a calculator?</h2>
<p>If you'd rather not write code, the <a href="${RTCI}/tools">Resolution Index calculators</a> run the same formulas in the browser, with staffing tables and charts.</p>`

writeFileSync(
  join(out, 'index.html'),
  shell({
    slug: 'index',
    title: 'contact-center-math: Erlang C, occupancy, AHT, FCR, CSAT and NPS in TypeScript',
    description: pkg.description,
    body: indexBody,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'contact-center-math',
      description: pkg.description,
      url: BASE,
      codeRepository: REPO,
      programmingLanguage: 'TypeScript',
      license: 'https://opensource.org/licenses/MIT',
      version: pkg.version,
      author: { '@type': 'Person', name: 'Andrew', url: 'https://github.com/andrewhall07' },
    },
  }),
)

const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['', ...pages.map((p) => `${p.slug}.html`)].map((u) => `  <url><loc>${BASE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`,
)
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`)
writeFileSync(join(out, '.nojekyll'), '')
console.log(`Built ${pages.length + 1} pages into _site/`)
