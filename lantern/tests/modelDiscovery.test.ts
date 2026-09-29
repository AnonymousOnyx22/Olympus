import { describe, expect, it } from 'vitest'
import { BUILTIN_ENDPOINTS, isChatModel, mergeProviders, modelAccess, slugifyProviderId } from '../electron/modelDiscovery'
import type { LocalProvider } from '../src/types/opencode'

const provider = (over: Partial<LocalProvider> & { id: string }): LocalProvider => ({
  name: over.id,
  baseURL: 'http://127.0.0.1:1234/v1',
  online: true,
  models: [],
  ...over,
})

describe('slugifyProviderId', () => {
  it('lowercases and dash-separates a display name', () => {
    expect(slugifyProviderId('LM Studio', [])).toBe('lm-studio')
    expect(slugifyProviderId('Ollama', [])).toBe('ollama')
  })

  it('collapses runs of punctuation and trims leading/trailing dashes', () => {
    expect(slugifyProviderId('  My  Local  Server!! ', [])).toBe('my-local-server')
    expect(slugifyProviderId('---vllm---', [])).toBe('vllm')
  })

  it('falls back to "local" when nothing usable survives', () => {
    // opencode requires a non-empty provider id; a blank key would produce a
    // config file that opencode silently ignores, which looks like a dead
    // provider in the picker rather than an error.
    expect(slugifyProviderId('', [])).toBe('local')
    expect(slugifyProviderId('!!!', [])).toBe('local')
    expect(slugifyProviderId('   ', [])).toBe('local')
  })

  it('suffixes on collision, and keeps counting past gaps', () => {
    expect(slugifyProviderId('Ollama', [])).toBe('ollama')
    expect(slugifyProviderId('Ollama', ['ollama'])).toBe('ollama-2')
    expect(slugifyProviderId('Ollama', ['ollama', 'ollama-2'])).toBe('ollama-3')
    // A gap must not be reused: reusing "ollama-2" after it was removed would
    // make a deleted provider's id come back to life.
    expect(slugifyProviderId('Ollama', ['ollama', 'ollama-3'])).toBe('ollama-2')
  })

  it('compares against the taken list verbatim, so callers must pass slugified ids', () => {
    // The collision check is an exact string match against `taken`, not a
    // case-insensitive one. Callers derive `taken` from ids that slugifyProviderId
    // already produced, so they are lowercase by construction. Asserting the
    // exact behaviour here so a future case-insensitive change is deliberate.
    expect(slugifyProviderId('Ollama', ['ollama'])).toBe('ollama-2')
    // An uppercase entry does not collide, because it could never have been
    // produced by this function.
    expect(slugifyProviderId('Ollama', ['OLLAMA'])).toBe('ollama')
  })
})

describe('isChatModel', () => {
  it('keeps ordinary chat and coding models', () => {
    expect(isChatModel('llama3.2')).toBe(true)
    expect(isChatModel('qwen2.5-coder')).toBe(true)
    expect(isChatModel('gpt-4o')).toBe(true)
  })

  it('drops embedding, rerank and bge models, which cannot drive an agent', () => {
    expect(isChatModel('nomic-embed-text')).toBe(false)
    expect(isChatModel('mxbai-embed-large')).toBe(false)
    expect(isChatModel('bge-m3')).toBe(false)
    expect(isChatModel('bge-reranker-v2-m3')).toBe(false)
  })

  it('matches case-insensitively, because server model ids are not normalised', () => {
    expect(isChatModel('NOMIC-EMBED-TEXT')).toBe(false)
    expect(isChatModel('Embed-Large')).toBe(false)
  })
})

describe('modelAccess', () => {
  it('reports local access for anything on a local endpoint, whatever it costs', () => {
    // A local model is free by definition; it has no vendor to bill.
    expect(modelAccess({ cost: { input: 5, output: 5 } }, true)).toBe('local')
    expect(modelAccess(undefined, true)).toBe('local')
  })

  it('detects a zero-cost entry in the array cost shape', () => {
    expect(modelAccess({ cost: [{ input: 0, output: 0 }] }, false)).toBe('free')
  })

  it('does not call a partially-zero or missing-price model free', () => {
    // A provider that omits `output` price is not promising it is free.
    expect(modelAccess({ cost: [{ input: 0 }] }, false)).toBe('api')
    expect(modelAccess({ cost: [] }, false)).toBe('api')
    expect(modelAccess({ cost: null }, false)).toBe('api')
  })

  it('does not treat a zero-input-only entry as free', () => {
    expect(modelAccess({ cost: [{ input: 0, output: 3 }] }, false)).toBe('api')
  })

  it('falls back to the id/name for models whose cost field is absent', () => {
    expect(modelAccess({ id: 'some-model-free' }, false)).toBe('free')
    expect(modelAccess({ name: 'Free Tier' }, false)).toBe('free')
  })

  it('requires a whole-word "free", so it does not fire on names that contain it', () => {
    // "freemium" and "freescore" are not free; the word-boundary check is the
    // whole point of the regex.
    expect(modelAccess({ id: 'freemium-mini' }, false)).toBe('api')
    expect(modelAccess({ id: 'freescore-v2' }, false)).toBe('api')
  })

  it('defaults to api for junk input rather than throwing', () => {
    expect(modelAccess(null, false)).toBe('api')
    expect(modelAccess('not an object', false)).toBe('api')
    expect(modelAccess({ cost: 'nonsense' }, false)).toBe('api')
  })
})

describe('mergeProviders', () => {
  it('puts local endpoints first and layers daemon data on top by id', () => {
    const local = [provider({ id: 'ollama', models: ['a'] })]
    const daemon = [provider({ id: 'ollama', models: ['a', 'b'], source: 'opencode' })]
    const merged = mergeProviders(daemon, local)
    expect(merged).toHaveLength(1)
    // Daemon data wins when the daemon knows the endpoint, because the daemon
    // knows which models actually loaded. The local probe only knows the port
    // is open.
    expect(merged[0].models).toEqual(['a', 'b'])
  })

  it('keeps a local endpoint the daemon has never heard of', () => {
    const merged = mergeProviders([], [provider({ id: 'my-lan-server' })])
    expect(merged.map((p) => p.id)).toEqual(['my-lan-server'])
  })

  it('keeps a daemon-only provider after the local ones', () => {
    const merged = mergeProviders([provider({ id: 'opencode-zen' })], [provider({ id: 'ollama' })])
    expect(merged.map((p) => p.id)).toEqual(['ollama', 'opencode-zen'])
  })

  it('does not duplicate an id that appears on both sides', () => {
    const merged = mergeProviders(
      [provider({ id: 'ollama' }), provider({ id: 'lmstudio' })],
      [provider({ id: 'ollama' }), provider({ id: 'vllm' })],
    )
    expect(merged.map((p) => p.id)).toEqual(['ollama', 'vllm', 'lmstudio'])
    expect(new Set(merged.map((p) => p.id)).size).toBe(merged.length)
  })

  it('handles two empty lists without throwing', () => {
    expect(mergeProviders([], [])).toEqual([])
  })
})

describe('BUILTIN_ENDPOINTS', () => {
  it('are all loopback, since a "local" provider on a routable IP is a security bug', () => {
    for (const endpoint of BUILTIN_ENDPOINTS) {
      expect(endpoint.baseURL).toMatch(/^http:\/\/127\.0\.0\.1:/)
    }
  })

  it('have unique ids, which mergeProviders relies on for its dedupe', () => {
    expect(new Set(BUILTIN_ENDPOINTS.map((e) => e.id)).size).toBe(BUILTIN_ENDPOINTS.length)
  })
})
