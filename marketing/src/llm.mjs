// A model client for any OpenAI compatible endpoint, so the agent runs on whatever is free for you:
// a model on your own computer (Ollama, LM Studio) or a hosted free tier. Configure with
//   LLM_BASE_URL   e.g. http://127.0.0.1:11434/v1  (Ollama)
//   LLM_MODEL      the model name your server offers
//   LLM_API_KEY    only if the server wants one

/** Pulls the first JSON object or array out of a model reply, tolerating prose and code fences around it. */
export function extractJson(text) {
  const clean = String(text).replace(/```(?:json)?/gi, '')
  try { return JSON.parse(clean) } catch { /* fall through to scanning */ }
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const a = clean.indexOf(open)
    const b = clean.lastIndexOf(close)
    if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)) } catch { /* try the next shape */ } }
  }
  throw new Error('The model did not return JSON')
}

export function makeLlm({ baseUrl, model, apiKey, fetchImpl = fetch, temperature = 0.6 } = {}) {
  if (!baseUrl || !model) throw new Error('Set LLM_BASE_URL and LLM_MODEL (for example http://127.0.0.1:11434/v1 and a model you have pulled).')
  return {
    async json(system, user) {
      const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ model, temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      })
      if (!res.ok) throw new Error(`The model server answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const reply = (await res.json()).choices?.[0]?.message?.content ?? ''
      return extractJson(reply)
    },
  }
}

export const llmFromEnv = () => makeLlm({ baseUrl: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL, apiKey: process.env.LLM_API_KEY })
