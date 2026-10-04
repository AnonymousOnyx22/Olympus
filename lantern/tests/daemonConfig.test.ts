import { describe, expect, it } from 'vitest'
import { buildOpencodeConfig } from '../electron/daemonManager'
describe('cloud response timeout', () => {
  it('bounds a selected cloud provider without supplying credentials or a replacement endpoint', () => {
    const config = buildOpencodeConfig([], { providerID: 'opencode', modelID: 'big-pickle' }, 'ask')
    expect(config.provider.opencode).toEqual({ options: { timeout: 180000, chunkTimeout: 60000 } })
    expect(config.permission.bash).toBe('ask')
  })
  it('does not invent a model or provider when none is selected', () => {
    expect(buildOpencodeConfig([], null).provider).toEqual({})
  })
})
