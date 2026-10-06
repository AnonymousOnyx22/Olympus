import type { ModelRef } from '../types/opencode'

/**
 * Claude Code and Codex first appeared in the model list under short names (sonnet, opus, haiku, default).
 * They now carry real version names, so a choice saved under an old name is mapped across instead of
 * failing with "Model not found".
 */
const LEGACY: Record<string, Record<string, string>> = {
  'claude-code': { default: 'claude-sonnet-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5', haiku: 'claude-haiku-4-5' },
  'codex-cli': { default: 'gpt-6-sol' },
}

export function migrateModelRef<T extends ModelRef | null | undefined>(ref: T): T {
  if (!ref) return ref
  const next = LEGACY[ref.providerID]?.[ref.modelID]
  return (next ? { ...ref, modelID: next } : ref) as T
}
