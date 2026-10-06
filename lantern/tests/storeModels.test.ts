import { describe, expect, it } from 'vitest'
import { BUSINESS_MODELS, STORE_THEMES } from '../src/services/storeModels'

describe('store models and themes', () => {
  it('gives every business model a stack, an owner step, a blunt timeline and an honest risk', () => {
    for (const m of BUSINESS_MODELS) {
      for (const field of [m.sells, m.stack, m.ownerSetup, m.timeToFirstSale, m.honestRisk]) expect(field.trim().length).toBeGreaterThan(10)
    }
    expect(new Set(BUSINESS_MODELS.map((m) => m.id)).size).toBe(BUSINESS_MODELS.length)
  })

  it('never offers a model that needs a paid plan or work from the owner to run', () => {
    const text = JSON.stringify(BUSINESS_MODELS).toLowerCase()
    expect(text).not.toMatch(/monthly fee|subscription plan|you ship|owner ships/)
  })

  it('does not promise newsletter or content income', () => {
    for (const id of ['newsletter', 'affiliate']) {
      const m = BUSINESS_MODELS.find((x) => x.id === id)!
      expect(m.timeToFirstSale.toLowerCase()).toMatch(/many months|months/)
      expect(m.honestRisk.length).toBeGreaterThan(40)
    }
  })

  it('has distinct, fully specified themes with real colours', () => {
    expect(new Set(STORE_THEMES.map((t) => t.id)).size).toBe(STORE_THEMES.length)
    for (const t of STORE_THEMES) {
      expect(t.palette).toMatch(/#[0-9a-f]{6}/i)
      for (const field of [t.mood, t.type, t.layout, t.motion, t.bestFor]) expect(field.trim().length).toBeGreaterThan(5)
    }
  })
})
