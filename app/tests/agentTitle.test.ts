import { describe, expect, it } from 'vitest'
import { agentDisplayTitle, isAutoTitle } from '../src/components/AgentWorkspace'

describe('agent display titles', () => {
  it('numbers auto-named agents by their place among the project’s open windows', () => {
    // Stored titles counted every chat ever made ("Agent 19"); what matters is what is open now.
    expect(agentDisplayTitle('Agent 19', 0)).toBe('Agent 1')
    expect(agentDisplayTitle('Agent 26', 1)).toBe('Agent 2')
    expect(agentDisplayTitle(undefined, 2)).toBe('Agent 3')
    expect(agentDisplayTitle('New session - 2026-10-02T12:00:00.000Z', 0)).toBe('Agent 1')
  })

  it('keeps names someone chose', () => {
    expect(agentDisplayTitle('Athena · Planner', 3)).toBe('Athena · Planner')
    expect(agentDisplayTitle('Fix the login bug', 0)).toBe('Fix the login bug')
    expect(isAutoTitle('Agent 7')).toBe(true)
    expect(isAutoTitle('Agent Smith')).toBe(false)
  })
})
