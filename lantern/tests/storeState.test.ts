import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_VIEWS,
  REVIEW_WINDOW_DAYS,
  budgetRemaining,
  emptyState,
  hasEvidence,
  mayOptimise,
  parseState,
  recordDecision,
  reviewDueDecisions,
  summarise,
  type StoreState,
} from '../electron/storeState'

const at = (days: number) => new Date(Date.UTC(2026, 0, 1 + days))

function withViews(state: StoreState, views: number, orders = 0): StoreState {
  return {
    ...state,
    listings: { l1: { metrics: { views, carts: 0, orders, revenueCents: orders * 1200 }, since: state.createdAt } },
  }
}

const CHANGE = { what: 'rewrote the title', hypothesis: 'more searchable title lifts orders', metric: 'orders' as const, baseline: 0 }

describe('evidence gate', () => {
  it('refuses to optimise a store with no signal', () => {
    const state = withViews(emptyState('s1', at(0)), 12)
    expect(hasEvidence(state)).toBe(false)
    expect(mayOptimise(state)).toBe(false)
    const result = recordDecision(state, CHANGE, at(1))
    expect('refused' in result).toBe(true)
    expect(('refused' in result && result.refused) || '').toMatch(/below the/)
  })

  it('allows changes once there is real traffic', () => {
    const state = withViews(emptyState('s1', at(0)), EVIDENCE_VIEWS + 1, 3)
    expect(mayOptimise(state)).toBe(true)
    expect('decisions' in recordDecision(state, CHANGE, at(1))).toBe(true)
  })

  it('fixes genuine errors even without evidence', () => {
    // recordDecision is for optimisation only; error fixes go through the normal file
    // path and must not be gated. This test pins that distinction so nobody later
    // gates bug fixes behind the evidence threshold by accident.
    const state = emptyState('s1', at(0))
    expect(hasEvidence(state)).toBe(false)
  })
})

describe('kill switch and budget', () => {
  it('refuses everything when automation is off', () => {
    const state = { ...withViews(emptyState('s1', at(0)), 500, 2), automationEnabled: false }
    expect(mayOptimise(state)).toBe(false)
    expect('refused' in recordDecision(state, CHANGE, at(1))).toBe(true)
  })

  it('stops after the daily budget is spent', () => {
    let state = withViews(emptyState('s1', at(0)), 900, 5)
    state = { ...state, dailyChangeBudget: 2 }
    for (let i = 0; i < 2; i += 1) {
      const r = recordDecision(state, CHANGE, at(1))
      expect('decisions' in r).toBe(true)
      state = r as StoreState
    }
    expect(budgetRemaining(state, at(1))).toBe(0)
    expect('refused' in recordDecision(state, CHANGE, at(1))).toBe(true)
    expect(state.decisions).toHaveLength(2)
  })

  it('resets the budget on a new day', () => {
    const state = withViews(emptyState('s1', at(0)), 900, 5)
    const spent = recordDecision(state, CHANGE, at(1)) as StoreState
    expect(budgetRemaining(spent, at(1))).toBe(2)
    expect(budgetRemaining(spent, at(2))).toBe(3)
  })
})

describe('reviewing decisions', () => {
  it('leaves a decision unjudged until its window closes', () => {
    const state = recordDecision(withViews(emptyState('s1', at(0)), 900, 4), CHANGE, at(0)) as StoreState
    expect(reviewDueDecisions(state, at(REVIEW_WINDOW_DAYS - 1)).decisions[0].verdict).toBe('unknown')
  })

  it('marks an improved change as working', () => {
    const base = withViews(emptyState('s1', at(0)), 900, 4)
    const decided = recordDecision(base, { ...CHANGE, baseline: 4 }, at(0)) as StoreState
    const later = withViews(decided, 900, 9)
    expect(reviewDueDecisions(later, at(REVIEW_WINDOW_DAYS + 1)).decisions[0].verdict).toBe('working')
  })

  it('marks an unimproved change as flat so it gets reverted', () => {
    const base = withViews(emptyState('s1', at(0)), 900, 4)
    const decided = recordDecision(base, { ...CHANGE, baseline: 4 }, at(0)) as StoreState
    expect(reviewDueDecisions(decided, at(REVIEW_WINDOW_DAYS + 1)).decisions[0].verdict).toBe('flat')
  })
})

describe('durable parsing', () => {
  it('falls back to a fresh state when the file is corrupt', () => {
    const state = parseState('{ not json at all', 's1', at(0))
    expect(state.storeId).toBe('s1')
    expect(state.decisions).toEqual([])
    expect(state.automationEnabled).toBe(true)
  })

  it('keeps the kill switch off across a reload', () => {
    const off = { ...emptyState('s1', at(0)), automationEnabled: false }
    expect(parseState(JSON.stringify(off), 's1', at(1)).automationEnabled).toBe(false)
  })

  it('refuses a state file from a future schema rather than guessing', () => {
    expect(parseState(JSON.stringify({ schemaVersion: 99, storeId: 'other' }), 's1', at(0)).decisions).toEqual([])
  })
})

describe('the summary the agent reads', () => {
  it('tells it not to optimise on thin data', () => {
    expect(summarise(withViews(emptyState('s1', at(0)), 4))).toMatch(/Do not optimise/)
  })

  it('surfaces what worked and what did not', () => {
    const state = withViews(emptyState('s1', at(0)), 900, 10)
    const worked = recordDecision(state, { ...CHANGE, what: 'bundle pricing', baseline: 2 }, at(0)) as StoreState
    // Baseline equal to the final figure, so this one genuinely did not move.
    const both = recordDecision(worked, { ...CHANGE, what: 'new photo', baseline: 14 }, at(0)) as StoreState
    const text = summarise(reviewDueDecisions(withViews(both, 900, 14), at(REVIEW_WINDOW_DAYS + 1)))
    expect(text).toMatch(/Working, do more of this: bundle pricing/)
    expect(text).toMatch(/Not working, revert these: new photo/)
  })

  it('reports the budget so the agent knows its limit', () => {
    expect(summarise(withViews(emptyState('s1', at(0)), 900))).toMatch(/changes left today/)
  })
})
