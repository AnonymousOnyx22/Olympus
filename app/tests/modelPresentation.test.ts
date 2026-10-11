import { describe, expect, it } from 'vitest'
import { presentModel } from '../src/components/ModelPicker'

describe('model family and version', () => {
  it('groups Claude by family, with the number as the version', () => {
    expect(presentModel('claude-haiku-4-5')).toMatchObject({ family: 'Haiku', version: '4.5' })
    expect(presentModel('claude-sonnet-5-5')).toMatchObject({ family: 'Sonnet', version: '5.5' })
    expect(presentModel('claude-opus-5-5')).toMatchObject({ family: 'Opus', version: '5.5' })
  })
  it('groups GPT by tier, so Sol is a family and 6 is its number', () => {
    expect(presentModel('gpt-6-sol')).toMatchObject({ family: 'Sol', version: '6' })
    expect(presentModel('gpt-5.6-sol')).toMatchObject({ family: 'Sol', version: '5.6' })
    expect(presentModel('gpt-5.1-codex')).toMatchObject({ family: 'Codex', version: '5.1' })
    expect(presentModel('gpt-5.4')).toMatchObject({ family: 'GPT', version: '5.4' })
  })
})
