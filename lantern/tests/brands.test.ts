import { describe, expect, it } from 'vitest'
import { brandFor, prettyModelName } from '../src/components/brands'

describe('brandFor', () => {
  it('knows the models the website names', () => {
    expect(brandFor('claude-sonnet-4').name).toBe('Anthropic')
    expect(brandFor('gpt-4o').name).toBe('OpenAI')
    expect(brandFor('gemini-2.5-pro').name).toBe('Google')
    expect(brandFor('grok-4').name).toBe('xAI')
    expect(brandFor('llama-3.1-8b').name).toBe('Meta')
    expect(brandFor('mistral-large').name).toBe('Mistral AI')
  })

  it('gives Kimi its own maker, including through a gateway path', () => {
    expect(brandFor('kimi-k2').name).toBe('Moonshot AI')
    expect(brandFor('moonshotai/kimi-k2-instruct').name).toBe('Moonshot AI')
  })

  it('titles Kimi correctly', () => {
    expect(prettyModelName('kimi-k2')).toMatch(/^Kimi/)
  })
})
