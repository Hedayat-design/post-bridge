import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { describeActivity } from '../lib/admin/activity'

describe('describeActivity — the sentence after a member’s name', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['workspace.created', {}, 'created the workspace'],
    ['member.signed_in', {}, 'started working'],
    ['member.added', { name: 'Sam', role: 'editor' }, 'added Sam as editor'],
    ['member.role_changed', { name: 'Sam', from: 'editor', to: 'admin' }, 'changed Sam from editor to admin'],
    ['member.suspended', { name: 'Sam' }, 'suspended Sam'],
    ['member.reactivated', { name: 'Sam' }, 'reactivated Sam'],
    ['member.removed', { name: 'Sam' }, 'removed Sam'],
    ['member.updated', { name: 'Sam' }, 'updated Sam’s details'],
    ['post.scheduled', { targets: 3 }, 'scheduled a post to 3 accounts'],
    ['post.published', { targets: 1 }, 'published a post to 1 account'],
    ['styles.updated', { platform: 'linkedin' }, 'updated the LinkedIn caption style'],
    ['account.connected', { platform: 'x', name: '@acme' }, 'connected X account @acme'],
  ]

  for (const [action, detail, expected] of cases) {
    test(action, () => assert.equal(describeActivity({ action, detail }), expected))
  }

  test('survives a missing or malformed detail', () => {
    assert.equal(describeActivity({ action: 'member.added', detail: null }), 'added  as member')
    assert.equal(describeActivity({ action: 'post.published', detail: { targets: 'many' } }), 'published a post to 0 accounts')
  })

  test('an unknown action falls back to its raw name rather than a blank', () => {
    assert.equal(describeActivity({ action: 'something.new', detail: {} }), 'something.new')
  })
})
