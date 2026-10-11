import type { ConnectionCheck } from '../src/types/opencode'

type Env = Record<string, string>
type Result = Omit<ConnectionCheck, 'at'>
type Fetch = typeof fetch

const TIMEOUT_MS = 10_000

const ok = (detail: string): Result => ({ status: 'verified', detail })
// Provider responses are arbitrary JSON; each check reads only the fields it needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const fail = (detail: string): Result => ({ status: 'failed', detail })

/** One authenticated GET. Never throws: a network problem is a failed check, not a crash. */
async function probe(fetchFn: Fetch, name: string, url: string, headers: Record<string, string> = {}): Promise<{ res: Response; json: Json } | Result> {
  try {
    const res = await fetchFn(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    let json: Json = null
    try { json = await res.json() } catch { /* not JSON */ }
    return { res, json }
  } catch (error) {
    const reason = error instanceof Error ? (error.name === 'TimeoutError' ? 'it did not answer within 10 seconds' : error.message) : String(error)
    return fail(`Could not reach ${name}: ${reason}. Nothing was verified.`)
  }
}

const isResult = (value: unknown): value is Result => !!value && typeof value === 'object' && 'status' in (value as object)

/** Turns a plain "was I let in" response into a result, with the provider's own message on refusal. */
function judge(name: string, got: { res: Response; json: Json } | Result, success: (json: Json) => string): Result {
  if (isResult(got)) return got
  const { res, json } = got
  if (res.ok) return ok(success(json))
  const rawSaid = typeof json?.error === 'string' ? json.error : json?.error?.message ?? json?.result?.toString?.() ?? json?.message ?? json?.errors?.[0]?.message
  // Some services echo a masked copy of the key back ("sk_test_ab****cd"); none of it belongs in the UI or on disk.
  const said = typeof rawSaid === 'string' ? rawSaid.replace(/\S*\*{3,}\S*/g, '(key hidden)') : undefined
  if (res.status === 401 || res.status === 403) return fail(`${name} rejected this key (${res.status})${said ? `: ${said}` : ''}. Check it was copied in full and has the right permissions.`)
  return fail(`${name} answered ${res.status}${said ? `: ${said}` : ''}.`)
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

type Check = { required: string[]; run: (env: Env, fetchFn: Fetch) => Promise<Result> }

const CHECKS: Record<string, Check> = {
  stripe: {
    required: ['STRIPE_SECRET_KEY'],
    run: async (env, f) => {
      const key = env.STRIPE_SECRET_KEY
      const mode = /^(sk|rk)_live_/.test(key) ? 'live' : /^(sk|rk)_test_/.test(key) ? 'test' : null
      if (!mode) return fail('That does not look like a Stripe secret key. It should start with sk_test_ or sk_live_.')
      const pub = env.STRIPE_PUBLISHABLE_KEY
      if (pub && /^pk_(live|test)_/.test(pub) && !pub.startsWith(`pk_${mode}_`)) return fail(`The secret key is a ${mode} key but the publishable key is a ${mode === 'live' ? 'test' : 'live'} key. They must match.`)
      const result = judge('Stripe', await probe(f, 'Stripe', 'https://api.stripe.com/v1/balance', bearer(key)), () => '')
      if (result.status !== 'verified') return result
      return ok(mode === 'live' ? 'Verified, LIVE mode. Checkouts will take real money.' : 'Verified, test mode. No real money moves.')
    },
  },
  openrouter: {
    required: ['OPENROUTER_API_KEY'],
    run: async (env, f) => judge('OpenRouter', await probe(f, 'OpenRouter', 'https://openrouter.ai/api/v1/auth/key', bearer(env.OPENROUTER_API_KEY)), (j) => `Verified${j?.data?.label ? `, key "${j.data.label}"` : ''}.`),
  },
  mistral: {
    required: ['MISTRAL_API_KEY'],
    run: async (env, f) => judge('Mistral', await probe(f, 'Mistral', 'https://api.mistral.ai/v1/models', bearer(env.MISTRAL_API_KEY)), () => 'Verified.'),
  },
  huggingface: {
    required: ['HF_TOKEN'],
    run: async (env, f) => judge('Hugging Face', await probe(f, 'Hugging Face', 'https://huggingface.co/api/whoami-v2', bearer(env.HF_TOKEN)), (j) => `Verified${j?.name ? ` as ${j.name}` : ''}.`),
  },
  netlify: {
    required: ['NETLIFY_AUTH_TOKEN'],
    run: async (env, f) => judge('Netlify', await probe(f, 'Netlify', 'https://api.netlify.com/api/v1/user', bearer(env.NETLIFY_AUTH_TOKEN)), (j) => `Verified${j?.email ? ` as ${j.email}` : ''}.`),
  },
  vercel: {
    required: ['VERCEL_TOKEN'],
    run: async (env, f) => judge('Vercel', await probe(f, 'Vercel', 'https://api.vercel.com/v2/user', bearer(env.VERCEL_TOKEN)), (j) => `Verified${j?.user?.username ? ` as ${j.user.username}` : ''}.`),
  },
  'cloudflare-pages': {
    required: ['CLOUDFLARE_API_TOKEN'],
    run: async (env, f) => {
      const id = env.CLOUDFLARE_ACCOUNT_ID
      const url = id ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(id)}/tokens/verify` : 'https://api.cloudflare.com/client/v4/user/tokens/verify'
      const got = await probe(f, 'Cloudflare', url, bearer(env.CLOUDFLARE_API_TOKEN))
      if (!isResult(got) && got.res.ok && got.json?.success === false) return fail('Cloudflare answered but reported the token as not valid.')
      if (!isResult(got) && got.res.status === 400) return fail('Cloudflare rejected this token (400). Check it was copied in full, and the Account ID if you entered one.')
      return judge('Cloudflare', got, (j) => `Verified${j?.result?.status ? `, token is ${j.result.status}` : ''}.`)
    },
  },
  render: {
    required: ['RENDER_API_KEY'],
    run: async (env, f) => judge('Render', await probe(f, 'Render', 'https://api.render.com/v1/owners?limit=1', bearer(env.RENDER_API_KEY)), () => 'Verified.'),
  },
  sendgrid: {
    required: ['SENDGRID_API_KEY'],
    run: async (env, f) => judge('SendGrid', await probe(f, 'SendGrid', 'https://api.sendgrid.com/v3/scopes', bearer(env.SENDGRID_API_KEY)), (j) => `Verified${Array.isArray(j?.scopes) ? `, ${j.scopes.length} permissions` : ''}.`),
  },
}

export async function checkConnection(providerId: string, env: Env, fetchFn: Fetch = fetch): Promise<Result> {
  const check = CHECKS[providerId]
  if (!check) return { status: 'unchecked', detail: 'There is no automatic test for this service yet. The values are saved and encrypted, but not tested.' }
  const missing = check.required.filter((key) => !env[key])
  if (missing.length) return { status: 'incomplete', detail: `Not complete yet: ${missing.join(', ')} still needs a value.` }
  return check.run(env, fetchFn)
}
