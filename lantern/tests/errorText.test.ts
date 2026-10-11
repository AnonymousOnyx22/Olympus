import { describe, expect, it } from 'vitest'
import { errorText } from '../src/errorText'

describe('errorText', () => {
  it('strips the wrapper Electron adds to errors thrown in the main process', () => {
    const wrapped = new Error("Error invoking remote method 'git:status': Error: fatal: not a git repository")
    expect(errorText(wrapped)).toBe('fatal: not a git repository')
  })
  it('leaves an ordinary message alone and accepts non-errors', () => {
    expect(errorText(new Error('Plain failure'))).toBe('Plain failure')
    expect(errorText('just text')).toBe('just text')
    expect(errorText(42)).toBe('42')
  })
})
