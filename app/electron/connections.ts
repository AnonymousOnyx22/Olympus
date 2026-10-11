import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ConnectionCheck, ConnectionProvider, ConnectionStatus } from '../src/types/opencode'
import { checkConnection } from './connectionChecks'

/**
 * Real API access for project agents - AI models, hosting, payments, email, storage and
 * analytics - kept out of the chat entirely. The user enters a
 * value once here; it is encrypted at rest with the OS's own
 * secret storage (DPAPI on Windows, Keychain on macOS, libsecret on Linux) and only ever
 * decrypted inside the main process, to become an environment variable on a project's own
 * `opencode serve` process. An agent's generated code reads `process.env.STRIPE_SECRET_KEY`
 * (the field's `key` below); it never sees, requests, or transmits the raw value itself, so a
 * free or third-party model provider never receives it as part of the conversation.
 */
export const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Payments',
    description: 'Accept payments and manage subscriptions.',
    fields: [
      { key: 'STRIPE_SECRET_KEY', label: 'Secret key', secret: true, placeholder: 'sk_live_… or sk_test_…' },
      { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable key', secret: false, placeholder: 'pk_live_… or pk_test_…' },
    ],
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    category: 'Analytics',
    description: 'Website traffic and events (GA4).',
    fields: [
      { key: 'GA4_MEASUREMENT_ID', label: 'Measurement ID', secret: false, placeholder: 'G-XXXXXXX' },
      { key: 'GA4_API_SECRET', label: 'API secret', secret: true },
    
],
  },

  {
    id: 'cloudflare-r2',
    name: 'Cloudflare R2',
    category: 'Media hosting',
    description: 'Cheap public file and image hosting. No egress fees.',
    fields: [
      { key: 'R2_ACCOUNT_ID', label: 'Account ID', secret: false },
      { key: 'R2_ACCESS_KEY_ID', label: 'Access key ID', secret: false },
      { key: 'R2_SECRET_ACCESS_KEY', label: 'Secret access key', secret: true },
      { key: 'R2_BUCKET', label: 'Bucket', secret: false, placeholder: 'listings' },
      { key: 'R2_PUBLIC_URL', label: 'Public base URL', secret: false, placeholder: 'https://cdn.example.com' },
    ],
  },
  {
    id: 'aws-s3',
    name: 'Amazon S3',
    category: 'Media hosting',
    description: 'Image hosting on AWS S3 or any S3-compatible service.',
    fields: [
      { key: 'AWS_ACCESS_KEY_ID', label: 'Access key ID', secret: false },
      { key: 'AWS_SECRET_ACCESS_KEY', label: 'Secret access key', secret: true },
      { key: 'AWS_REGION', label: 'Region', secret: false, placeholder: 'us-east-1' },
      { key: 'S3_BUCKET', label: 'Bucket', secret: false },
      { key: 'S3_PUBLIC_URL', label: 'Public base URL', secret: false },
    ],
  },
  {
    id: 'backblaze-b2',
    name: 'Backblaze B2',
    category: 'Media hosting',
    description: 'Low cost object storage with a native image CDN.',
    fields: [
      { key: 'B2_KEY_ID', label: 'Key ID', secret: false },
      { key: 'B2_APP_KEY', label: 'Application key', secret: true },
      { key: 'B2_BUCKET', label: 'Bucket', secret: false },
    ],
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    category: 'Media hosting',
    description: 'Image hosting with resizing and format conversion built in.',
    fields: [
      { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloud name', secret: false },
      { key: 'CLOUDINARY_API_KEY', label: 'API key', secret: false },
      { key: 'CLOUDINARY_API_SECRET', label: 'API secret', secret: true },
    ],
  },




  {
    id: 'resend',
    name: 'Resend',
    category: 'Email',
    description: 'Send transactional email from an app.',
    fields: [{ key: 'RESEND_API_KEY', label: 'API key', secret: true }, { key: 'RESEND_FROM', label: 'From address', secret: false }],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    category: 'Email',
    description: 'Transactional and marketing email.',
    fields: [{ key: 'SENDGRID_API_KEY', label: 'API key', secret: true }, { key: 'SENDGRID_FROM', label: 'From address', secret: false }],
  },



  {
    id: 'posthog',
    name: 'PostHog',
    category: 'Analytics',
    description: 'Product analytics, self hosted.',
    fields: [{ key: 'POSTHOG_API_KEY', label: 'API key', secret: false }, { key: 'POSTHOG_HOST', label: 'Host', secret: false, placeholder: 'https://eu.posthog.com' }],
  },
  {
    id: 'plausible',
    name: 'Plausible',
    category: 'Analytics',
    description: 'Lightweight private analytics.',
    fields: [{ key: 'PLAUSIBLE_API_KEY', label: 'API key', secret: true }, { key: 'PLAUSIBLE_SITE_ID', label: 'Site ID', secret: false }],
  },






  {
    id: 'postmark',
    name: 'Postmark',
    category: 'Email',
    description: 'Reliable transactional email.',
    fields: [{ key: 'POSTMARK_SERVER_TOKEN', label: 'Server token', secret: true }],
  },



  {
    id: 'figma',
    name: 'Figma',
    category: 'Design assets',
    description: 'Read design files and export assets.',
    fields: [{ key: 'FIGMA_ACCESS_TOKEN', label: 'Access token', secret: true }],
  },

  {
    id: 'netlify',
    name: 'Netlify',
    category: 'Site hosting',
    description: 'Free static hosting with serverless functions. The simplest place to put a site live.',
    fields: [
      { key: 'NETLIFY_AUTH_TOKEN', label: 'Personal access token', secret: true },
      { key: 'NETLIFY_SITE_ID', label: 'Site ID (optional)', secret: false },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Site hosting',
    description: 'Hosting with serverless functions and a generous free tier.',
    fields: [
      { key: 'VERCEL_TOKEN', label: 'Access token', secret: true },
      { key: 'VERCEL_PROJECT_ID', label: 'Project ID (optional)', secret: false },
    ],
  },
  {
    id: 'cloudflare-pages',
    name: 'Cloudflare Pages',
    category: 'Site hosting',
    description: 'Free static hosting on Cloudflare with edge functions.',
    fields: [
      { key: 'CLOUDFLARE_API_TOKEN', label: 'API token', secret: true },
      { key: 'CLOUDFLARE_ACCOUNT_ID', label: 'Account ID', secret: false },
    ],
  },
  {
    id: 'render',
    name: 'Render',
    category: 'Site hosting',
    description: 'Hosting for apps that need a small server that is always on.',
    fields: [{ key: 'RENDER_API_KEY', label: 'API key', secret: true }],
  },
  // Keys here reach the project agents as environment variables, which opencode reads to unlock that provider's models.
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    category: 'AI models',
    description: 'Paid and free models through OpenCode, including the GPT, Claude and Gemini families. Needs funds on the account.',
    fields: [{ key: 'OPENCODE_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    category: 'AI models',
    description: 'Gemini models. Has a free tier.',
    fields: [{ key: 'GEMINI_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'AI models',
    description: 'One key for many models, including several free ones.',
    fields: [{ key: 'OPENROUTER_API_KEY', label: 'API key', secret: true, placeholder: 'sk-or-…' }],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    category: 'AI models',
    description: 'Mistral and Codestral models.',
    fields: [{ key: 'MISTRAL_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    category: 'AI models',
    description: 'Hosted open models. Has a free tier.',
    fields: [{ key: 'HF_TOKEN', label: 'Access token', secret: true, placeholder: 'hf_…' }],
  },
]

function providerById(id: string): ConnectionProvider | undefined {
  return CONNECTION_PROVIDERS.find((p) => p.id === id)
}

interface StoredConnection {
  /** Non-secret fields are stored as plain strings; secret fields as base64 `safeStorage` blobs. */
  values: Record<string, string>
  /** Last real test of these values. Dropped whenever a value changes, so it can never describe stale input. */
  check?: ConnectionCheck
}
type Store = Record<string, StoredConnection>

const storePath = () => path.join(app.getPath('userData'), 'connections.json')

function load(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), 'utf8')) as unknown
    return raw && typeof raw === 'object' ? (raw as Store) : {}
  } catch {
    return {}
  }
}

function persist(store: Store): void {
  const target = storePath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 })
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('This machine has no OS-level secret storage available, so connections cannot be saved securely here.')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(stored: string): string {
  return safeStorage.decryptString(Buffer.from(stored, 'base64'))
}

export function listConnectionStatus(): ConnectionStatus[] {
  const store = load()
  return CONNECTION_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    category: provider.category,
    description: provider.description,
    fields: provider.fields,
    configuredFields: provider.fields.filter((field) => !!store[provider.id]?.values[field.key]).map((field) => field.key),
    verification: store[provider.id]?.check ?? null,
  }))
}

/** `values[field.key] === ''` clears that one field; an omitted key leaves it untouched. */
export function setConnectionValues(providerId: string, values: Record<string, string>): ConnectionStatus[] {
  const provider = providerById(providerId)
  if (!provider) throw new Error(`Unknown connection: ${providerId}`)
  const store = load()
  const current: StoredConnection = { values: { ...(store[providerId]?.values ?? {}) } }
  let changed = false
  for (const field of provider.fields) {
    const raw = values[field.key]
    if (raw === undefined) continue
    changed = true
    if (!raw.trim()) {
      delete current.values[field.key]
      continue
    }
    current.values[field.key] = field.secret ? encrypt(raw.trim()) : raw.trim()
  }
  if (changed) delete current.check
  else if (store[providerId]?.check) current.check = store[providerId].check
  if (Object.keys(current.values).length) store[providerId] = current
  else delete store[providerId]
  persist(store)
  return listConnectionStatus()
}

/** Decrypts one connection's values and tests them against the service, then remembers the result. */
export async function verifyConnection(providerId: string, fetchFn?: typeof fetch): Promise<ConnectionStatus[]> {
  const provider = providerById(providerId)
  if (!provider) throw new Error(`Unknown connection: ${providerId}`)
  const stored = load()[providerId]
  if (!stored) return listConnectionStatus()
  const env: Record<string, string> = {}
  for (const field of provider.fields) {
    const raw = stored.values[field.key]
    if (raw) env[field.key] = field.secret ? decrypt(raw) : raw
  }
  const result = await checkConnection(providerId, env, fetchFn)
  // Re-read before writing: the user may have edited the values while the request was in flight,
  // and a result for the old values must not be attached to the new ones.
  const fresh = load()
  if (fresh[providerId] && JSON.stringify(fresh[providerId].values) === JSON.stringify(stored.values)) {
    fresh[providerId] = { ...fresh[providerId], check: { ...result, at: Date.now() } }
    persist(fresh)
  }
  return listConnectionStatus()
}

export function clearConnection(providerId: string): ConnectionStatus[] {
  const store = load()
  delete store[providerId]
  persist(store)
  return listConnectionStatus()
}

/** Every connection a project's agent may use: all of them, minus the ones withheld from that project. */
export function connectionIdsForProject(projectId: string, optOut: Record<string, string[]>): string[] {
  const withheld = new Set(optOut[projectId] ?? [])
  return CONNECTION_PROVIDERS.map((provider) => provider.id).filter((id) => !withheld.has(id))
}

/**
 * Decrypted env vars for the given connections, for one project's `opencode serve` process
 * only. Never sent over IPC - call this in the main process right where a daemon is spawned.
 */
export function envForConnections(connectionIds: string[]): NodeJS.ProcessEnv {
  const store = load()
  const out: NodeJS.ProcessEnv = {}
  for (const id of connectionIds) {
    const provider = providerById(id)
    const stored = store[id]
    if (!provider || !stored) continue
    for (const field of provider.fields) {
      const raw = stored.values[field.key]
      if (!raw) continue
      out[field.key] = field.secret ? decrypt(raw) : raw
    }
  }
  return out
}
