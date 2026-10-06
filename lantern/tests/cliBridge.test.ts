import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeLine, codexLine, newClaudeState, describeCommand, describeTool, isTitleRequest, lastUserText, sseChunk, textOf, titleFrom, workingDirectory } from '../electron/cliBridge'

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
  it('streams Claude Code partial output as it is produced', () => {
    const state = newClaudeState()
    const ev = (event: object) => JSON.stringify({ type: 'stream_event', event })
    expect(claudeLine(ev({ type: 'message_start' }), state)).toBeNull()
    expect(claudeLine(ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } }), state)).toEqual({ text: 'Hello' })
    expect(claudeLine(ev({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', name: 'Write' } }), state)).toEqual({ text: '\n> Write...\n' })
    expect(claudeLine(ev({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"file_path":"a/b.html"' } }), state)).toBeNull()
    expect(claudeLine(ev({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: ',"content":"x"}' } }), state)).toBeNull()
    expect(claudeLine(ev({ type: 'content_block_stop', index: 1 }), state)).toEqual({ text: '  a/b.html\n' })
    // The finished message repeats what was already streamed, so it adds nothing
    expect(claudeLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } }), state)).toBeNull()
  })
  it('falls back to finished messages when no partial events arrive, and reports errors', () => {
    const state = newClaudeState()
    expect(claudeLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }, { type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] } }), state)?.text).toBe('Hi\n\n> Bash: ls\n')
    expect(claudeLine(JSON.stringify({ type: 'result', is_error: true, result: 'out of credits' }), state)).toEqual({ error: 'out of credits' })
    expect(claudeLine('not json', state)).toBeNull()
  })
})
