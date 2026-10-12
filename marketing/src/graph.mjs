// A small client for the Instagram API (Instagram Login flavour: graph.instagram.com). Free to use.
// It only does what the official API allows: publish your own content, read and answer comments on your own
// posts, hide comments, and read insights. It cannot like, follow or comment on other people's accounts.
// Set IG_API_HOST=graph.facebook.com and use a Facebook Page token if you use the Facebook Login flavour.

export class InstagramError extends Error {
  constructor(message, { status, code, auth } = {}) { super(message); this.status = status; this.code = code; this.auth = !!auth }
}

export function makeGraph({ userId, token, host = 'graph.instagram.com', version = 'v21.0', fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), retries = 2 } = {}) {
  const base = host.startsWith('http') ? `${host}/${version}` : `https://${host}/${version}`

  async function call(method, path, params = {}) {
    const url = new URL(`${base}${path}`)
    const body = new URLSearchParams()
    const all = { ...params, access_token: token }
    for (const [k, v] of Object.entries(all)) if (v !== undefined && v !== null) (method === 'GET' ? url.searchParams : body).set(k, String(v))
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url, { method, ...(method === 'GET' ? {} : { body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }) })
      const text = await res.text()
      let json
      try { json = JSON.parse(text) } catch { json = { raw: text } }
      if (res.ok && !json.error) return json
      const e = json.error || {}
      // Rate limits and server errors are retried; everything else is a real answer.
      if ((res.status === 429 || res.status >= 500) && attempt < retries) { await sleep(500 * 2 ** attempt); continue }
      throw new InstagramError(e.message || `Instagram API ${res.status}`, { status: res.status, code: e.code, auth: e.code === 190 || res.status === 401 })
    }
  }

  async function waitForContainer(id, { tries = 40, every = 5000 } = {}) {
    for (let i = 0; i < tries; i++) {
      const { status_code: status } = await call('GET', `/${id}`, { fields: 'status_code' })
      if (status === 'FINISHED') return
      if (status === 'ERROR' || status === 'EXPIRED') throw new InstagramError(`Media processing ended with ${status}`)
      await sleep(every)
    }
    throw new InstagramError('Media was still processing after waiting')
  }
  const publishContainer = async (creationId) => (await call('POST', `/${userId}/media_publish`, { creation_id: creationId })).id

  return {
    call,
    async publishImage({ imageUrl, caption }) {
      const { id } = await call('POST', `/${userId}/media`, { image_url: imageUrl, caption })
      await waitForContainer(id)
      return publishContainer(id)
    },
    async publishCarousel({ imageUrls, caption }) {
      const children = []
      for (const url of imageUrls) children.push((await call('POST', `/${userId}/media`, { image_url: url, is_carousel_item: true })).id)
      for (const id of children) await waitForContainer(id)
      const { id } = await call('POST', `/${userId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption })
      await waitForContainer(id)
      return publishContainer(id)
    },
    async publishReel({ videoUrl, caption, coverUrl }) {
      const { id } = await call('POST', `/${userId}/media`, { media_type: 'REELS', video_url: videoUrl, caption, cover_url: coverUrl })
      await waitForContainer(id, { tries: 60 })
      return publishContainer(id)
    },
    permalink: async (mediaId) => (await call('GET', `/${mediaId}`, { fields: 'permalink' })).permalink,
    me: () => call('GET', '/me', { fields: 'user_id,username' }),
    async recentMedia(limit = 25) {
      return (await call('GET', `/${userId}/media`, { fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count', limit })).data ?? []
    },
    async comments(mediaId) {
      return (await call('GET', `/${mediaId}/comments`, { fields: 'id,text,username,timestamp,hidden,replies{id,username}', limit: 50 })).data ?? []
    },
    reply: (commentId, message) => call('POST', `/${commentId}/replies`, { message }),
    hide: (commentId) => call('POST', `/${commentId}`, { hide: true }),
    async insights(mediaId) {
      try {
        const rows = (await call('GET', `/${mediaId}/insights`, { metric: 'reach,saved,shares' })).data ?? []
        return Object.fromEntries(rows.map((r) => [r.name, r.values?.[0]?.value ?? 0]))
      } catch { return {} } // some media types do not report every metric
    },
    /** Long-lived tokens last 60 days. Refreshing returns a new one to store in your secrets. */
    async refreshToken() {
      const url = new URL(`${base.slice(0, base.lastIndexOf('/'))}/refresh_access_token`)
      url.searchParams.set('grant_type', 'ig_refresh_token')
      url.searchParams.set('access_token', token)
      const res = await fetchImpl(url)
      const json = await res.json()
      if (!res.ok || json.error) throw new InstagramError(json.error?.message || `Token refresh failed (${res.status})`, { status: res.status, auth: true })
      return json
    },
  }
}
