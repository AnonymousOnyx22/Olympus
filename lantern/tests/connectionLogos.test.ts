import { describe, expect, it } from 'vitest'
import { CONNECTION_PROVIDERS } from '../electron/connections'
import { CONNECTION_LOGOS } from '../src/components/connectionBrands'

describe('connection logos', () => {
  it('has a logo for every provider, so the library and the ticker never show a bare monogram', () => {
    const missing = CONNECTION_PROVIDERS.map((p) => p.id).filter((id) => !CONNECTION_LOGOS[id])
    expect(missing).toEqual([])
  })
  it('has no logo for a provider that no longer exists', () => {
    const ids = new Set(CONNECTION_PROVIDERS.map((p) => p.id))
    expect(Object.keys(CONNECTION_LOGOS).filter((id) => !ids.has(id))).toEqual([])
  })
})
