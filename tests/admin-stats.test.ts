import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAY_MS,
  lastDays,
  dailyOutcomes,
  totals,
  failureRate,
  countBy,
  accountHealth,
  needsAttention,
  compact,
  percent,
  relativeTime,
  niceTicks,
  overduePosts,
  PostRow,
} from '../lib/admin/stats'

const NOW = new Date('2026-10-17T15:00:00Z')

describe('lastDays', () => {
  test('ends today in UTC, oldest first', () => {
    assert.deepEqual(lastDays(3, NOW), ['2026-10-15', '2026-10-16', '2026-10-17'])
  })

  test('crosses month boundaries', () => {
    assert.deepEqual(lastDays(2, new Date('2026-11-01T00:30:00Z')), ['2026-10-31', '2026-11-01'])
  })
})

describe('dailyOutcomes — what went out, and what failed, per day', () => {
  const days = lastDays(3, NOW)
  const posts: PostRow[] = [
    {
      scheduled_for: null,
      created_at: '2026-10-16T09:00:00Z',
      post_targets: [
        { status: 'posted', posted_at: '2026-10-16T09:00:05Z' },
        { status: 'partial', posted_at: '2026-10-16T09:00:06Z' },
        { status: 'failed', posted_at: null },
      ],
    },
    {
      // Failed targets have no posted_at, so they date from the schedule.
      scheduled_for: '2026-10-17T08:00:00Z',
      created_at: '2026-10-10T08:00:00Z',
      post_targets: [{ status: 'failed', posted_at: null }],
    },
    {
      scheduled_for: '2026-10-20T08:00:00Z',
      created_at: '2026-10-17T08:00:00Z',
      post_targets: [{ status: 'pending', posted_at: null }],
    },
    {
      // Outside the window: ignored, not clamped onto the first day.
      scheduled_for: null,
      created_at: '2026-09-01T00:00:00Z',
      post_targets: [{ status: 'posted', posted_at: '2026-09-01T00:00:01Z' }],
    },
    { scheduled_for: null, created_at: '2026-10-17T00:00:00Z', post_targets: null },
  ]

  test('counts partial as delivered and skips pending', () => {
    assert.deepEqual(dailyOutcomes(posts, days), [
      { day: '2026-10-15', delivered: 0, failed: 0 },
      { day: '2026-10-16', delivered: 2, failed: 1 },
      { day: '2026-10-17', delivered: 0, failed: 1 },
    ])
  })

  test('totals and failure rate', () => {
    const t = totals(dailyOutcomes(posts, days))
    assert.deepEqual(t, { delivered: 2, failed: 2 })
    assert.equal(failureRate(t.delivered, t.failed), 0.5)
    assert.equal(failureRate(0, 0), null)
  })
})

describe('countBy', () => {
  test('largest first, ties alphabetical, nulls skipped', () => {
    const rows = ['x', 'linkedin', 'x', null, 'instagram', 'linkedin', 'x']
    assert.deepEqual(countBy(rows, (r) => r), [
      { label: 'x', value: 3 },
      { label: 'linkedin', value: 2 },
      { label: 'instagram', value: 1 },
    ])
  })
})

describe('accountHealth — only flag what cannot renew itself', () => {
  test('a renewable account is never flagged, even when expired', () => {
    const h = accountHealth('2026-10-01T00:00:00Z', true, NOW)
    assert.equal(h, 'renews')
    assert.equal(needsAttention(h), false)
  })

  test('expired, expiring and healthy without a refresh token', () => {
    assert.equal(accountHealth('2026-10-17T14:00:00Z', false, NOW), 'expired')
    assert.equal(accountHealth(new Date(NOW.getTime() + DAY_MS).toISOString(), false, NOW), 'expiring')
    assert.equal(accountHealth(new Date(NOW.getTime() + 10 * DAY_MS).toISOString(), false, NOW), 'healthy')
    assert.equal(accountHealth(null, false, NOW), 'healthy')
  })
})

describe('formatting', () => {
  test('compact', () => {
    assert.equal(compact(950), '950')
    assert.equal(compact(1284), '1,284')
    assert.equal(compact(12_900), '12.9K')
    assert.equal(compact(4_200_000), '4.2M')
  })

  test('percent', () => {
    assert.equal(percent(null), '—')
    assert.equal(percent(0), '0%')
    assert.equal(percent(1), '100%')
    assert.equal(percent(0.0625), '6.3%')
  })

  test('relativeTime', () => {
    assert.equal(relativeTime(null, NOW), 'Never')
    assert.equal(relativeTime('2026-10-17T14:59:30Z', NOW), 'just now')
    assert.equal(relativeTime('2026-10-17T14:30:00Z', NOW), '30 min ago')
    assert.equal(relativeTime('2026-10-17T12:00:00Z', NOW), '3 h ago')
    assert.equal(relativeTime('2026-10-15T15:00:00Z', NOW), '2 d ago')
    assert.equal(relativeTime('2026-08-01T00:00:00Z', NOW), 'Aug 1')
    assert.equal(relativeTime('2026-10-17T18:00:00Z', NOW), 'in 3 h')
  })

  test('niceTicks covers the max with round steps', () => {
    assert.deepEqual(niceTicks(0), [0, 1])
    assert.deepEqual(niceTicks(7), [0, 5, 10])
    assert.deepEqual(niceTicks(12), [0, 5, 10, 15])
    const t = niceTicks(1234)
    assert.equal(t[0], 0)
    assert.ok(t[t.length - 1] >= 1234)
  })
})

describe('overduePosts — scheduled, past due, never picked up', () => {
  test('flags past-due scheduled posts beyond the grace period only', () => {
    const posts = [
      { id: 'a', status: 'scheduled', scheduled_for: '2026-10-17T14:00:00Z' }, // 1 h late
      { id: 'b', status: 'scheduled', scheduled_for: '2026-10-17T14:55:00Z' }, // 5 min: grace
      { id: 'c', status: 'scheduled', scheduled_for: '2026-10-18T09:00:00Z' }, // future
      { id: 'd', status: 'posted', scheduled_for: '2026-10-16T09:00:00Z' }, // done
      { id: 'e', status: 'scheduled', scheduled_for: null },
    ]
    assert.deepEqual(overduePosts(posts, NOW).map((p) => p.id), ['a'])
  })
})
