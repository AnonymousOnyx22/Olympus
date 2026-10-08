import { describe, expect, it } from 'vitest'
import { migrateModelRef } from '../src/services/legacyModels'

describe('migrateModelRef', () => {
  it('maps the old short names to the real versions', () => {
    expect(migrateModelRef({ providerID: 'claude-code', modelID: 'sonnet' })).toEqual({ providerID: 'claude-code', modelID: 'claude-sonnet-5-5' })
    expect(migrateModelRef({ providerID: 'claude-code', modelID: 'haiku' }).modelID).toBe('claude-haiku-4-5')
    expect(migrateModelRef({ providerID: 'codex-cli', modelID: 'default' }).modelID).toBe('gpt-6-luna')
    expect(migrateModelRef({ providerID: 'codex-cli', modelID: 'gpt-6-sol' }).modelID).toBe('gpt-6-luna')
  })
  it('leaves everything else alone', () => {
    const ref = { providerID: 'opencode', modelID: 'big-pickle' }
    expect(migrateModelRef(ref)).toBe(ref)
    expect(migrateModelRef(null)).toBeNull()
    expect(migrateModelRef({ providerID: 'claude-code', modelID: 'claude-opus-5-5' }).modelID).toBe('claude-opus-5-5')
  })
})
