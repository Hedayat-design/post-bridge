import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ensureFreshToken, SocialAccountRow } from '../lib/tokens'
import { TokenExpiredError } from '../lib/adapters/types'
import { MockFetch } from './helpers/mock-fetch'

let mock: MockFetch

beforeEach(() => {
  mock = new MockFetch()
  mock.install()
  process.env.X_CLIENT_ID = 'cid'
  process.env.X_CLIENT_SECRET = 'csec'
})
afterEach(() => mock.restore())

/** Minimal stand-in for the supabase client, recording what would be written. */
function fakeAdmin() {
  const updates: Array<{ table: string; values: Record<string, unknown>; id?: string }> = []

  const client = {
    updates,
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            eq(_col: string, id: string) {
              updates.push({ table, values, id })
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
      }
    },
  }

  return client as any
}

const account = (over: Partial<SocialAccountRow> = {}): SocialAccountRow => ({
  id: 'acct-1',
  platform: 'x',
  platform_account_id: '42',
  access_token: 'current-token',
  refresh_token: 'refresh-token',
  token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  ...over,
})

describe('ensureFreshToken', () => {
  test('returns the existing token when it is still valid', async () => {
    const admin = fakeAdmin()

    const token = await ensureFreshToken(admin, account())

    assert.equal(token, 'current-token')
    assert.equal(mock.requests.length, 0, 'should not call the platform')
    assert.equal(admin.updates.length, 0)
  })

  test('treats a null expiry as non-expiring', async () => {
    const admin = fakeAdmin()

    const token = await ensureFreshToken(admin, account({ token_expires_at: null }))

    assert.equal(token, 'current-token')
    assert.equal(mock.requests.length, 0)
  })

  test('refreshes a token that already expired', async () => {
    const admin = fakeAdmin()
    mock.reply({ json: { access_token: 'fresh', refresh_token: 'rotated', expires_in: 7200 } })

    const token = await ensureFreshToken(
      admin,
      account({ token_expires_at: new Date(Date.now() - 1000).toISOString() })
    )

    assert.equal(token, 'fresh')
    assert.equal(admin.updates.length, 1)
    assert.equal(admin.updates[0].table, 'social_accounts')
    assert.equal(admin.updates[0].id, 'acct-1')
    assert.equal(admin.updates[0].values.access_token, 'fresh')
    // X rotates refresh tokens; persisting the new one is what keeps the
    // account connected past the second refresh.
    assert.equal(admin.updates[0].values.refresh_token, 'rotated')
  })

  test('refreshes early, inside the 5-minute skew window', async () => {
    const admin = fakeAdmin()
    mock.reply({ json: { access_token: 'fresh', expires_in: 7200 } })

    const token = await ensureFreshToken(
      admin,
      account({ token_expires_at: new Date(Date.now() + 60 * 1000).toISOString() })
    )

    assert.equal(token, 'fresh', 'a token expiring in 1 minute must not be used')
  })

  test('keeps the old refresh token when the platform does not rotate it', async () => {
    const admin = fakeAdmin()
    mock.reply({ json: { access_token: 'fresh', expires_in: 7200 } })

    await ensureFreshToken(
      admin,
      account({ token_expires_at: new Date(Date.now() - 1000).toISOString() })
    )

    assert.equal(admin.updates[0].values.refresh_token, 'refresh-token')
  })

  test('raises TokenExpiredError when there is no refresh token to use', async () => {
    const admin = fakeAdmin()

    await assert.rejects(
      () =>
        ensureFreshToken(
          admin,
          account({ refresh_token: null, token_expires_at: new Date(Date.now() - 1000).toISOString() })
        ),
      (err: Error) => {
        assert.ok(err instanceof TokenExpiredError)
        assert.match(err.message, /reconnect/)
        return true
      }
    )
  })

  test('raises TokenExpiredError for a platform with no refresh support', async () => {
    const admin = fakeAdmin()

    await assert.rejects(
      () =>
        ensureFreshToken(
          admin,
          account({ platform: 'tiktok', token_expires_at: new Date(Date.now() - 1000).toISOString() })
        ),
      TokenExpiredError
    )
  })

  test('propagates a refusal from the platform as TokenExpiredError', async () => {
    const admin = fakeAdmin()
    mock.reply({ status: 400, json: { error_description: 'refresh token revoked' } })

    await assert.rejects(
      () =>
        ensureFreshToken(
          admin,
          account({ token_expires_at: new Date(Date.now() - 1000).toISOString() })
        ),
      (err: Error) => {
        assert.ok(err instanceof TokenExpiredError)
        assert.match(err.message, /revoked/)
        return true
      }
    )
    assert.equal(admin.updates.length, 0, 'must not persist anything on failure')
  })
})
