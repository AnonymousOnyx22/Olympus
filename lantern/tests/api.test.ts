import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../src/services/api'

const request = vi.fn()
beforeEach(() => {
  request.mockReset()
  ;(globalThis as unknown as { window: { electronAPI: unknown } }).window = { electronAPI: { request } }
})

describe('api', () => {
  it('returns the data of a successful call, scoped to the space', async () => {
    request.mockResolvedValue({ ok: true, status: 200, data: [{ id: 's1' }] })
    expect(await api.listSessions('proj')).toEqual([{ id: 's1' }])
    expect(request).toHaveBeenCalledWith('proj', 'GET', '/session', undefined)
  })

  it('throws an ApiError carrying the status and the daemon message', async () => {
    request.mockResolvedValue({ ok: false, status: 404, data: null, error: 'no such session' })
    const failure = await api.deleteSession('proj', 'x').catch((error) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.message).toBe('no such session')
    expect(failure.status).toBe(404)
  })

  it('encodes ids that contain path characters', async () => {
    request.mockResolvedValue({ ok: true, status: 200, data: true })
    await api.deleteSession('proj', 'a/b c')
    expect(request).toHaveBeenCalledWith('proj', 'DELETE', '/session/a%2Fb%20c', undefined)
  })
})
