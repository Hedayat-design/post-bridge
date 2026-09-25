import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createPkcePair, sealState, openState } from '../lib/oauth'

before(() => {
  process.env.OAUTH_STATE_SECRET = 'test-secret-do-not-use-in-production'
})

const sample = () => ({
  nonce: 'abc123',
  verifier: 'v'.repeat(43),
  userId: 'user-uuid',
  platform: 'x',
  issuedAt: Date.now(),
})

describe('PKCE', () => {
  test('challenge is the base64url SHA-256 of the verifier', () => {
    const { verifier, challenge } = createPkcePair()

    const expected = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    assert.equal(challenge, expected)
  })

  test('verifier meets the RFC 7636 length and charset rules', () => {
    const { verifier } = createPkcePair()

    assert.ok(verifier.length >= 43 && verifier.length <= 128)
    assert.match(verifier, /^[A-Za-z0-9\-._~]+$/)
  })

  test('each call produces a fresh pair', () => {
    assert.notEqual(createPkcePair().verifier, createPkcePair().verifier)
  })
})

describe('OAuth state sealing', () => {
  test('round-trips intact', () => {
    const state = sample()
    const opened = openState(sealState(state))

    assert.deepEqual(opened, state)
  })

  test('rejects a tampered user id — the whole point of signing', () => {
    const sealed = sealState(sample())
    const [payload] = sealed.split('.')

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    decoded.userId = 'someone-elses-uuid'
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url')

    // Attacker swaps the payload but cannot recompute the HMAC.
    assert.equal(openState(`${forgedPayload}.${sealed.split('.')[1]}`), null)
  })

  test('rejects a bad signature', () => {
    const [payload] = sealState(sample()).split('.')
    assert.equal(openState(`${payload}.not-a-real-mac`), null)
  })

  test('rejects state older than 10 minutes', () => {
    const stale = { ...sample(), issuedAt: Date.now() - 11 * 60 * 1000 }
    assert.equal(openState(sealState(stale)), null)
  })

  test('rejects missing or malformed input', () => {
    assert.equal(openState(undefined), null)
    assert.equal(openState(''), null)
    assert.equal(openState('no-dot-separator'), null)
  })

  test('a state signed with a different secret does not verify', () => {
    const sealed = sealState(sample())

    process.env.OAUTH_STATE_SECRET = 'a-different-secret'
    const opened = openState(sealed)
    process.env.OAUTH_STATE_SECRET = 'test-secret-do-not-use-in-production'

    assert.equal(opened, null)
  })
})
