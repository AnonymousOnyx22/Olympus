// Per-store decision memory.
//
// An agent told "find what is working and change what is not" with no record of what it
// already tried will repeat itself: rewrite the same description, re-price the same
// listing, churn forever. This file is what makes the loop a controller rather than a
// random number generator.
//
// Two rules shape everything here:
//
//   1. No change without evidence. Below the evidence threshold the agent may fix genuine
//      errors, but must not optimise. New stores get almost no organic traffic for weeks,
//      and an optimiser with no signal is worse than no optimiser: it churns a store's
//      ranking on nothing.
//   2. Every change records a hypothesis and a deadline. A change that has not moved its
//      metric by its review date is reverted, not extended.
//
// Plain JSON on disk, one file per store, in the store's own folder. It is written by the
// main process and read by the agent, so it must survive the agent doing something unwise.

export const SCHEMA_VERSION = 1

/** Below this, there is no signal. Fix errors, change nothing else. */
export const EVIDENCE_VIEWS = 200

/** How long a change gets to prove itself before it is judged. */
export const REVIEW_WINDOW_DAYS = 14

export type Verdict = 'unknown' | 'working' | 'flat' | 'failing'

export interface ListingMetrics {
  views: number
  carts: number
  orders: number
  revenueCents: number
}

export interface Decision {
  id: string
  madeAt: string
  what: string
  /** What this change was supposed to improve. */
  hypothesis: string
  /** Metric this change is judged on. */
  metric: 'orders' | 'views' | 'conversion'
  baseline: number
  /** Null until the review window closes. */
  verdict: Verdict
  reviewedAt?: string
  reverted: boolean
}

export interface StoreState {
  schemaVersion: number
  storeId: string
  createdAt: string
  updatedAt: string
  listings: Record<string, { metrics: ListingMetrics; since: string }>
  decisions: Decision[]
  /** Set false by the kill switch. Nothing that spends or publishes may run. */
  automationEnabled: boolean
  /** Hard ceiling on changes per day. The cheapest brake on the whole system. */
  dailyChangeBudget: number
  changesToday: { day: string; count: number }
}

export function emptyState(storeId: string, now = new Date()): StoreState {
  return {
    schemaVersion: SCHEMA_VERSION,
    storeId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    listings: {},
    decisions: [],
    automationEnabled: true,
    dailyChangeBudget: 3,
    changesToday: { day: now.toISOString().slice(0, 10), count: 0 },
  }
}

const DAY = 86_400_000

/** Total traffic across a store's listings. This is the evidence gate. */
export function totalViews(state: StoreState): number {
  return Object.values(state.listings).reduce((sum, entry) => sum + (entry.metrics.views || 0), 0)
}

export function hasEvidence(state: StoreState): boolean {
  return totalViews(state) >= EVIDENCE_VIEWS
}

/** True when the store may change anything that is not a straight bug fix. */
export function mayOptimise(state: StoreState): boolean {
  return state.automationEnabled && hasEvidence(state) && budgetRemaining(state) > 0
}

export function budgetRemaining(state: StoreState, now = new Date()): number {
  const today = now.toISOString().slice(0, 10)
  const used = state.changesToday.day === today ? state.changesToday.count : 0
  return Math.max(0, state.dailyChangeBudget - used)
}

/** Records a change. Refuses once the daily budget is spent, so the brake cannot be bypassed. */
export function recordDecision(state: StoreState, decision: Omit<Decision, 'id' | 'madeAt' | 'verdict' | 'reverted'>, now = new Date()): StoreState | { refused: string } {
  if (!state.automationEnabled) return { refused: 'automation is disabled' }
  const today = now.toISOString().slice(0, 10)
  const remaining = budgetRemaining(state, now)
  if (remaining <= 0) return { refused: `daily change budget of ${state.dailyChangeBudget} is spent` }
  if (!hasEvidence(state)) return { refused: `only ${totalViews(state)} views so far; below the ${EVIDENCE_VIEWS} needed to justify a change` }

  const id = `d${now.getTime().toString(36)}`
  return {
    ...state,
    updatedAt: now.toISOString(),
    changesToday: { day: today, count: (state.changesToday.day === today ? state.changesToday.count : 0) + 1 },
    decisions: [...state.decisions, { ...decision, id, madeAt: now.toISOString(), verdict: 'unknown', reverted: false }],
  }
}

/**
 * Reviews every decision past its window and marks it. A change whose metric did not move
 * is `failing` and should be reverted; one that improved is `working` and is worth
 * doubling down on.
 */
export function reviewDueDecisions(state: StoreState, now = new Date()): StoreState {
  let changed = false
  const decisions = state.decisions.map((d) => {
    if (d.verdict !== 'unknown') return d
    const made = Date.parse(d.madeAt)
    if (!Number.isFinite(made) || now.getTime() - made < REVIEW_WINDOW_DAYS * DAY) return d
    changed = true
    return { ...d, reviewedAt: now.toISOString(), verdict: d.baseline > 0 && currentFor(state, d) > d.baseline * 1.1 ? 'working' : d.baseline > 0 ? 'flat' : 'unknown' } as Decision
  })
  return changed ? { ...state, updatedAt: now.toISOString(), decisions } : state
}

function currentFor(state: StoreState, decision: Decision): number {
  if (decision.metric === 'views') return totalViews(state)
  const orders = Object.values(state.listings).reduce((sum, e) => sum + (e.metrics.orders || 0), 0)
  const carts = Object.values(state.listings).reduce((sum, e) => sum + (e.metrics.carts || 0), 0)
  if (decision.metric === 'orders') return orders
  return carts > 0 ? (orders / carts) * 100 : 0
}

/** The three questions the agent asks first, answered from state rather than memory. */
export function summarise(state: StoreState): string {
  const views = totalViews(state)
  const orders = Object.values(state.listings).reduce((s, e) => s + (e.metrics.orders || 0), 0)
  const revenue = Object.values(state.listings).reduce((s, e) => s + (e.metrics.revenueCents || 0), 0)
  const listingCount = Object.keys(state.listings).length
  const lines = [
    `Store ${state.storeId}: ${listingCount} ${listingCount === 1 ? 'listing' : 'listings'}, ${views} views, ${orders} ${orders === 1 ? 'order' : 'orders'}, ${(revenue / 100).toFixed(2)} earned.`,
    hasEvidence(state)
      ? 'There is enough traffic to judge changes. Read the decisions below before proposing anything.'
      : `Only ${views} views so far, below the ${EVIDENCE_VIEWS} needed. Fix genuine errors only. Do not optimise, re-price, or rewrite listings on this little data - churn with no signal costs you ranking.`,
    `Automation ${state.automationEnabled ? 'on' : 'OFF'}, ${budgetRemaining(state)} of ${state.dailyChangeBudget} changes left today.`,
  ]
  const working = state.decisions.filter((d) => d.verdict === 'working')
  const failing = state.decisions.filter((d) => d.verdict === 'failing' || d.verdict === 'flat')
  if (working.length) lines.push(`Working, do more of this: ${working.map((d) => d.what).join('; ')}`)
  if (failing.length) lines.push(`Not working, revert these: ${failing.map((d) => d.what).join('; ')}`)
  if (!state.decisions.length) lines.push('No changes recorded yet.')
  return lines.join('\n')
}

/** Repairs anything unreadable rather than throwing: a corrupt file must not brick a store. */
export function parseState(raw: string, storeId: string, now = new Date()): StoreState {
  try {
    const parsed = JSON.parse(raw) as Partial<StoreState>
    if (parsed.schemaVersion !== SCHEMA_VERSION) return emptyState(storeId, now)
    const base = emptyState(storeId, now)
    return {
      ...base,
      ...parsed,
      storeId,
      listings: parsed.listings ?? {},
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      dailyChangeBudget: typeof parsed.dailyChangeBudget === 'number' ? parsed.dailyChangeBudget : base.dailyChangeBudget,
      automationEnabled: parsed.automationEnabled !== false,
      changesToday: parsed.changesToday ?? base.changesToday,
    } as StoreState
  } catch {
    return emptyState(storeId, now)
  }
}
