import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { xAdapter } from '../lib/adapters/x'
import { TokenExpiredError } from '../lib/adapters/types'
import { MockFetch, imageItem, videoItem } from './helpers/mock-fetch'

let mock: MockFetch

beforeEach(() => {
  mock = new MockFetch()
  mock.install()
})
afterEach(() => mock.restore())

const base = { accessToken: 'tok', platformAccountId: '123', mediaType: 'text' as const }

describe('X adapter — publishing', () => {
  test('posts text with no media upload', async () => {
    mock.reply({ json: { data: { id: '1800000000' } } })

    const result = await xAdapter.publish({ ...base, caption: 'hello world', media: [] })

    assert.equal(result.success, true)
    assert.equal(result.platformPostId, '1800000000')
    assert.equal(mock.requests.length, 1, 'should not touch the media endpoint')

    const [req] = mock.requests
    assert.match(req.url, /\/2\/tweets$/)
    assert.deepEqual(req.body, { text: 'hello world' })
    assert.equal(req.headers.authorization, 'Bearer tok')
  })

  test('uploads an image through INIT/APPEND/FINALIZE and attaches it', async () => {
    mock
      .reply({ json: { data: { id: 'media-1' } } })          // INIT
      .reply({ json: {} })                                    // APPEND
      .reply({ json: { data: { id: 'media-1' } } })          // FINALIZE
      .reply({ json: { data: { id: 'tweet-1' } } })          // tweet

    const result = await xAdapter.publish({
      ...base,
      mediaType: 'image',
      caption: 'with a photo',
      media: [imageItem()],
    })

    assert.equal(result.success, true)

    const [init, append, finalize, tweet] = mock.requests

    assert.equal(init.form.command, 'INIT')
    assert.equal(init.form.total_bytes, '1024')
    assert.equal(init.form.media_type, 'image/jpeg')
    assert.equal(init.form.media_category, 'tweet_image')

    assert.equal(append.form.command, 'APPEND')
    assert.equal(append.form.media_id, 'media-1')
    assert.equal(append.form.segment_index, '0')
    // The bytes must actually be in the request; the old code sent a URL.
    assert.equal(append.form.media, '<blob:1024>')

    assert.equal(finalize.form.command, 'FINALIZE')
    assert.equal(finalize.form.media_id, 'media-1')

    assert.deepEqual(tweet.body, { text: 'with a photo', media: { media_ids: ['media-1'] } })
  })

  test('splits media larger than the 4MB chunk size across APPEND calls', async () => {
    const big = imageItem(9 * 1024 * 1024) // 9MB -> 3 chunks
    mock
      .reply({ json: { data: { id: 'm' } } })
      .reply({ json: {} })
      .reply({ json: {} })
      .reply({ json: {} })
      .reply({ json: { data: { id: 'm' } } })
      .reply({ json: { data: { id: 't' } } })

    await xAdapter.publish({ ...base, mediaType: 'image', caption: 'big', media: [big] })

    const appends = mock.requests.filter((r) => r.form.command === 'APPEND')
    assert.equal(appends.length, 3)
    assert.deepEqual(appends.map((a) => a.form.segment_index), ['0', '1', '2'])
  })

  test('waits for video transcoding before tweeting', async () => {
    mock
      .reply({ json: { data: { id: 'vid-1' } } })                                       // INIT
      .reply({ json: {} })                                                              // APPEND
      .reply({ json: { data: { processing_info: { state: 'in_progress', check_after_secs: 0 } } } }) // FINALIZE
      .reply({ json: { data: { processing_info: { state: 'succeeded' } } } })          // STATUS
      .reply({ json: { data: { id: 'tweet-v' } } })                                     // tweet

    const result = await xAdapter.publish({
      ...base,
      mediaType: 'video',
      caption: 'clip',
      media: [videoItem()],
    })

    assert.equal(result.success, true)
    const status = mock.requests.find((r) => r.url.includes('command=STATUS'))
    assert.ok(status, 'should poll STATUS while processing')
    assert.equal(mock.requests.at(-1)!.url.endsWith('/2/tweets'), true)
  })

  test('surfaces a transcoding failure instead of posting', async () => {
    mock
      .reply({ json: { data: { id: 'vid-2' } } })
      .reply({ json: {} })
      .reply({ json: { data: { processing_info: { state: 'failed', error: { message: 'corrupt file' } } } } })

    const result = await xAdapter.publish({
      ...base,
      mediaType: 'video',
      caption: 'bad clip',
      media: [videoItem()],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /corrupt file/)
  })
})

describe('X adapter — validation', () => {
  test('rejects text over 280 characters without calling the API', async () => {
    const result = await xAdapter.publish({ ...base, caption: 'a'.repeat(281), media: [] })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /281 characters/)
    assert.equal(mock.requests.length, 0)
  })

  test('rejects more than 4 images', async () => {
    const result = await xAdapter.publish({
      ...base,
      mediaType: 'carousel',
      caption: 'too many',
      media: [imageItem(), imageItem(), imageItem(), imageItem(), imageItem()],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /at most 4 images/)
    assert.equal(mock.requests.length, 0)
  })

  test('rejects a video alongside other media', async () => {
    const result = await xAdapter.publish({
      ...base,
      mediaType: 'video',
      caption: 'mixed',
      media: [videoItem(), imageItem()],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /only one video/)
  })

  test('rejects a completely empty post', async () => {
    const result = await xAdapter.publish({ ...base, caption: '   ', media: [] })

    assert.equal(result.success, false)
    assert.equal(mock.requests.length, 0)
  })
})

describe('X adapter — auth', () => {
  test('throws TokenExpiredError on 401 so the caller can prompt a reconnect', async () => {
    mock.reply({ status: 401, json: { title: 'Unauthorized' } })

    await assert.rejects(
      () => xAdapter.publish({ ...base, caption: 'hi', media: [] }),
      TokenExpiredError
    )
  })

  test('reads the profile into an account id and handle', async () => {
    mock.reply({
      json: { data: { id: '42', username: 'someone', name: 'Some One', profile_image_url: 'https://img' } },
    })

    const profile = await xAdapter.fetchProfile('tok')

    assert.equal(profile.platformAccountId, '42')
    assert.equal(profile.displayName, '@someone')
    assert.equal(profile.avatarUrl, 'https://img')
  })

  test('refreshes with HTTP Basic auth and returns the rotated refresh token', async () => {
    process.env.X_CLIENT_ID = 'cid'
    process.env.X_CLIENT_SECRET = 'csec'
    mock.reply({ json: { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 7200 } })

    const refreshed = await xAdapter.refreshToken!('old-rt')

    const [req] = mock.requests
    const expected = Buffer.from('cid:csec').toString('base64')
    assert.equal(req.headers.authorization, `Basic ${expected}`)
    assert.equal(req.form.grant_type, 'refresh_token')
    assert.equal(req.form.refresh_token, 'old-rt')

    assert.equal(refreshed.accessToken, 'new-at')
    assert.equal(refreshed.refreshToken, 'new-rt')
    assert.equal(refreshed.expiresInSeconds, 7200)
  })
})
