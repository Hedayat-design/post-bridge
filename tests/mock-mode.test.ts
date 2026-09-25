import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockAdapter, mockModeEnabled, mockAccessToken } from '../lib/adapters/mock'
import { TokenExpiredError } from '../lib/adapters/types'
import { validatePost } from '../lib/adapters/limits'
import { imageItem, videoItem } from './helpers/mock-fetch'

const saved = { ...process.env }

// @types/node marks NODE_ENV readonly; tests legitimately need to vary it.
function setNodeEnv(value: string) {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_PLATFORM_MOCK
  delete process.env.ALLOW_MOCK_IN_PRODUCTION
  setNodeEnv('test')
})
afterEach(() => {
  process.env = { ...saved }
})

const base = { accessToken: 'tok', platformAccountId: 'x1', mediaType: 'text' as const }

describe('mock mode flag', () => {
  test('off by default', () => {
    assert.equal(mockModeEnabled(), false)
  })

  test('accepts 1 and true', () => {
    process.env.NEXT_PUBLIC_PLATFORM_MOCK = '1'
    assert.equal(mockModeEnabled(), true)

    process.env.NEXT_PUBLIC_PLATFORM_MOCK = 'true'
    assert.equal(mockModeEnabled(), true)
  })

  test('ignores other values rather than guessing', () => {
    process.env.NEXT_PUBLIC_PLATFORM_MOCK = '0'
    assert.equal(mockModeEnabled(), false)

    process.env.NEXT_PUBLIC_PLATFORM_MOCK = 'yes'
    assert.equal(mockModeEnabled(), false)
  })

  test('refuses to run in production — silently faking posts is worse', () => {
    process.env.NEXT_PUBLIC_PLATFORM_MOCK = '1'
    setNodeEnv('production')

    assert.throws(() => mockModeEnabled(), /would be faked/)
  })

  test('allows production only with the explicit demo override', () => {
    process.env.NEXT_PUBLIC_PLATFORM_MOCK = '1'
    setNodeEnv('production')
    process.env.ALLOW_MOCK_IN_PRODUCTION = '1'

    assert.equal(mockModeEnabled(), true)
  })
})

describe('mock adapters', () => {
  test('publish returns a traceable synthetic id', async () => {
    const result = await mockAdapter('x').publish({ ...base, caption: 'hello', media: [] })

    assert.equal(result.success, true)
    assert.match(result.platformPostId!, /^mock-x-/)
  })

  test('enforces the same limits as the live adapter', async () => {
    const tooLong = 'a'.repeat(281)

    const mockResult = await mockAdapter('x').publish({ ...base, caption: tooLong, media: [] })
    const sharedRule = validatePost('x', tooLong, [])

    assert.equal(mockResult.success, false)
    // If these ever diverge, a demo could pass where production fails.
    assert.equal(mockResult.errorMessage, sharedRule)
  })

  test('rejects mixed media just like the real platform', async () => {
    const result = await mockAdapter('x').publish({
      ...base,
      caption: 'mixed',
      media: [videoItem(), imageItem()],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /cannot mix/)
  })

  test('honours platforms that require media', async () => {
    const result = await mockAdapter('instagram').publish({
      ...base,
      caption: 'text only',
      media: [],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /requires media/)
  })

  test('[fail] directive simulates a platform rejection', async () => {
    const result = await mockAdapter('linkedin').publish({
      ...base,
      caption: 'this one should [fail] please',
      media: [],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /rejected the post/)
  })

  test('[expired] directive raises TokenExpiredError', async () => {
    await assert.rejects(
      () => mockAdapter('x').publish({ ...base, caption: 'token is [expired]', media: [] }),
      TokenExpiredError
    )
  })

  test('profile is stable for a token so reconnecting updates one row', async () => {
    const a = await mockAdapter('x').fetchProfile('same-token')
    const b = await mockAdapter('x').fetchProfile('same-token')
    const c = await mockAdapter('x').fetchProfile('other-token')

    assert.equal(a.platformAccountId, b.platformAccountId)
    assert.notEqual(a.platformAccountId, c.platformAccountId)
  })

  test('each platform gets a distinct fake account', async () => {
    const x = await mockAdapter('x').fetchProfile('tok')
    const li = await mockAdapter('linkedin').fetchProfile('tok')

    assert.notEqual(x.platformAccountId, li.platformAccountId)
    assert.match(x.displayName!, /^@demo_/)
  })

  test('refresh returns a usable new token', async () => {
    const refreshed = await mockAdapter('x').refreshToken!('old')

    assert.match(refreshed.accessToken, /^mock-at-/)
    assert.equal(refreshed.expiresInSeconds, 7200)
  })

  test('mock tokens are deterministic per user and platform', () => {
    assert.equal(mockAccessToken('u1', 'x'), mockAccessToken('u1', 'x'))
    assert.notEqual(mockAccessToken('u1', 'x'), mockAccessToken('u2', 'x'))
    assert.notEqual(mockAccessToken('u1', 'x'), mockAccessToken('u1', 'linkedin'))
  })
})
