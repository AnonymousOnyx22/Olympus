import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeGraph, InstagramError } from '../src/graph.mjs'

/** A fetch that answers from a script and records requests. */
function script(responses) {
  const requests = []
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url)
    requests.push({ method: init.method ?? 'GET', path: u.pathname, query: Object.fromEntries(u.searchParams), body: init.body ? Object.fromEntries(new URLSearchParams(init.body)) : undefined })
    const next = responses.shift()
    const status = next.status ?? 200
    return { ok: status < 400, status, text: async () => JSON.stringify(next.json ?? {}), json: async () => next.json ?? {} }
  }
  return { fetchImpl, requests }
}
const make = (responses, over = {}) => { const s = script(responses); return { ...s, graph: makeGraph({ userId: '123', token: 'tok', fetchImpl: s.fetchImpl, sleep: async () => {}, ...over }) } }

test('publishing an image creates a container, waits for it, then publishes it', async () => {
  const { graph, requests } = make([{ json: { id: 'c1' } }, { json: { status_code: 'IN_PROGRESS' } }, { json: { status_code: 'FINISHED' } }, { json: { id: 'm1' } }])
  assert.equal(await graph.publishImage({ imageUrl: 'https://a/b.jpg', caption: 'hi' }), 'm1')
  assert.deepEqual(requests.map((r) => `${r.method} ${r.path}`), ['POST /v21.0/123/media', 'GET /v21.0/c1', 'GET /v21.0/c1', 'POST /v21.0/123/media_publish'])
  assert.equal(requests[0].body.image_url, 'https://a/b.jpg')
  assert.equal(requests[0].body.access_token, 'tok')
  assert.equal(requests[3].body.creation_id, 'c1')
})

test('a carousel builds every child, then the parent, then publishes', async () => {
  const { graph, requests } = make([
    { json: { id: 'k1' } }, { json: { id: 'k2' } }, { json: { status_code: 'FINISHED' } }, { json: { status_code: 'FINISHED' } },
    { json: { id: 'p' } }, { json: { status_code: 'FINISHED' } }, { json: { id: 'm2' } },
  ])
  assert.equal(await graph.publishCarousel({ imageUrls: ['https://a/1.jpg', 'https://a/2.jpg'], caption: 'c' }), 'm2')
  assert.equal(requests[0].body.is_carousel_item, 'true')
  assert.equal(requests[4].body.media_type, 'CAROUSEL')
  assert.equal(requests[4].body.children, 'k1,k2')
})

test('a reel is published as REELS and waits for video processing', async () => {
  const { graph, requests } = make([{ json: { id: 'r1' } }, { json: { status_code: 'FINISHED' } }, { json: { id: 'm3' } }])
  assert.equal(await graph.publishReel({ videoUrl: 'https://a/v.mp4', caption: 'c' }), 'm3')
  assert.equal(requests[0].body.media_type, 'REELS')
  assert.equal(requests[0].body.video_url, 'https://a/v.mp4')
})

test('media that fails processing is reported, not published', async () => {
  const { graph } = make([{ json: { id: 'c1' } }, { json: { status_code: 'ERROR' } }])
  await assert.rejects(() => graph.publishImage({ imageUrl: 'https://a/b.jpg', caption: 'x' }), /ERROR/)
})

test('comments can be read, answered and hidden', async () => {
  const { graph, requests } = make([{ json: { data: [{ id: 'c1', text: 'hi', username: 'a' }] } }, { json: { id: 'r' } }, { json: { success: true } }])
  assert.equal((await graph.comments('m1')).length, 1)
  await graph.reply('c1', 'thanks')
  await graph.hide('c1')
  assert.equal(requests[1].path, '/v21.0/c1/replies')
  assert.equal(requests[1].body.message, 'thanks')
  assert.equal(requests[2].body.hide, 'true')
})

test('rate limits and server errors are retried; real errors are not', async () => {
  const retried = make([{ status: 429, json: { error: { message: 'slow down', code: 4 } } }, { status: 500, json: {} }, { json: { data: [] } }])
  assert.deepEqual(await retried.graph.comments('m1'), [])
  assert.equal(retried.requests.length, 3)
  const real = make([{ status: 400, json: { error: { message: 'Invalid image', code: 100 } } }])
  await assert.rejects(() => real.graph.reply('c', 'x'), (e) => e instanceof InstagramError && !e.auth && e.code === 100)
})

test('an expired token is flagged as an auth error', async () => {
  const { graph } = make([{ status: 401, json: { error: { message: 'Session expired', code: 190 } } }])
  await assert.rejects(() => graph.recentMedia(), (e) => e.auth === true)
})

test('refreshing a token calls the refresh endpoint without a version prefix', async () => {
  const { graph, requests } = make([{ json: { access_token: 'new', expires_in: 5184000 } }])
  assert.equal((await graph.refreshToken()).access_token, 'new')
  assert.equal(requests[0].path, '/refresh_access_token')
  assert.equal(requests[0].query.grant_type, 'ig_refresh_token')
})
