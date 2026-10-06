import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { codexLine, describeCommand, describeTool, isTitleRequest, lastUserText, sseChunk, textOf, titleFrom, workingDirectory } from '../electron/cliBridge'

describe('cliBridge helpers', () => {
  it('reads text from string or part-list content', () => {
    expect(textOf('hi')).toBe('hi')
    expect(textOf([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }])).toBe('ab')
    expect(textOf(null)).toBe('')
  })
  it('finds the project folder from the system prompt, only if it exists', () => {
    const dir = os.tmpdir()
    expect(workingDirectory([{ role: 'system', content: `<env>\nWorking directory: ${dir}\nPlatform: win32\n</env>` }])).toBe(dir)
    expect(workingDirectory([{ role: 'system', content: 'Working directory: C:\definitely\not\here' }])).toBeNull()
    expect(workingDirectory([{ role: 'user', content: `Working directory: ${dir}` }])).toBeNull()
  })
  it('uses the last user message as the prompt', () => {
    expect(lastUserText([{ role: 'user', content: 'one' }, { role: 'assistant', content: 'x' }, { role: 'user', content: ' two ' }])).toBe('two')
  })
  it('answers title requests without a CLI run', () => {
    expect(isTitleRequest([{ role: 'system', content: 'You are a title generator. Reply with a title.' }])).toBe(true)
    expect(isTitleRequest([{ role: 'system', content: 'You are the Station store manager.' }])).toBe(false)
    expect(titleFrom('Build me a store   for dog people today please thanks')).toBe('Build me a store for dog')
  })
  it('formats stream chunks and tool lines', () => {
    expect(sseChunk('id', 'm', 'hello')).toContain('"content":"hello"')
    expect(sseChunk('id', 'm', '', 'stop')).toContain('"finish_reason":"stop"')
    expect(describeTool('Edit', { file_path: 'a/b.html' })).toBe('\n> Edit: a/b.html\n')
  })
  it('keeps the bridge off the network and the prompt off the command line', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'electron', 'cliBridge.ts'), 'utf8')
    expect(source).toContain("listen(0, '127.0.0.1'")
    expect(source).toContain('child.stdin?.end(prompt)')
    expect(source).not.toMatch(/args\.push\([^)]*prompt/)
  })
  it('only ever passes a listed model name to a command line', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'electron', 'cliBridge.ts'), 'utf8')
    expect(source).toContain('ENGINES[engine].models.includes(String(body.model))')
    expect(source).not.toMatch(/const model = body\.model/)
  })
  it('turns Codex JSON events into live chat lines', () => {
    expect(codexLine(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Working on it' } }))).toEqual({ text: 'Working on it\n' })
    const run = codexLine(JSON.stringify({ type: 'item.started', item: { type: 'command_execution', command: '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command Get-Date' } }))
    expect(run?.text).toBe('\n> Run: Get-Date\n')
    expect(codexLine(JSON.stringify({ type: 'turn.failed', error: { message: 'nope' } }))).toEqual({ error: 'nope' })
    expect(codexLine('not json')).toBeNull()
    expect(describeCommand('plain command')).toBe('plain command')
  })
})
