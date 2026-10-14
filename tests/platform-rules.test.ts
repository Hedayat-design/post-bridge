import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { xAdapter } from '../lib/adapters/x'
import { mockAdapter } from '../lib/adapters/mock'
import { stripLinks, containsLink } from '../lib/adapters/x-links'
import {
  effectiveTextLimit,
  validatePost,
  validatePlatformOptions,
  X_PREMIUM_TEXT_LIMIT,
  YOUTUBE_TAGS_MAX_CHARS,
} from '../lib/adapters/limits'
import { MockFetch, videoItem, imageItem } from './helpers/mock-fetch'

let mock: MockFetch

beforeEach(() => {
  mock = new MockFetch()
  mock.install()
})
afterEach(() => mock.restore())

const base = { accessToken: 'tok', platformAccountId: '123', mediaType: 'text' as const }

describe('X link stripping', () => {
  test('removes scheme URLs, www and bare domains', () => {
    assert.equal(stripLinks('Check out https://example.com/post now'), 'Check out now')
    assert.equal(stripLinks('Visit www.example.com today'), 'Visit today')
    assert.equal(stripLinks('Read foo.com/path for more'), 'Read for more')
    assert.equal(stripLinks('New release at foo.io'), 'New release at')
    assert.equal(stripLinks('visit post-bridge.com now'), 'visit now')
  })

  test('leaves email addresses intact', () => {
    // A naive pattern strips the domain out of the middle and leaves
    // "support@post-" behind, which is worse than leaving the link in.
    assert.equal(
      stripLinks('Email support@post-bridge.com for help'),
      'Email support@post-bridge.com for help'
    )
    assert.equal(stripLinks('mail a.b@c-d.com please'), 'mail a.b@c-d.com please')
  })

  test('leaves prose that merely looks like a domain', () => {
    assert.equal(stripLinks('I love Node.js and TypeScript'), 'I love Node.js and TypeScript')
    assert.equal(stripLinks('P.S. Come to the launch'), 'P.S. Come to the launch')
    assert.equal(stripLinks('e.g. this is fine'), 'e.g. this is fine')
    assert.equal(stripLinks('Hey @jack check #build'), 'Hey @jack check #build')
  })

  test('tidies the whitespace a removed link leaves behind', () => {
    assert.equal(stripLinks('Link https://a.com , then text'), 'Link, then text')
    assert.equal(stripLinks('multi\n\nhttps://x.com/y\n\nline'), 'multi\n\nline')
  })

  test('a caption that was only a link comes back empty', () => {
    assert.equal(stripLinks('https://only-a-link.com'), '')
  })

  test('containsLink reports what stripLinks would remove', () => {
    assert.equal(containsLink('go to foo.com'), true)
    assert.equal(containsLink('no link here'), false)
  })

  test('the tweet body sent to X has the link removed', async () => {
    mock.reply({ json: { data: { id: 'tweet-1' } } })

    const result = await xAdapter.publish({
      ...base,
      caption: 'Shipped a thing: https://example.com/launch',
      media: [],
    })

    assert.equal(result.success, true)
    assert.deepEqual(mock.requests[0].body, { text: 'Shipped a thing:' })
  })

  test('a caption over 280 only because of a long URL still publishes', async () => {
    mock.reply({ json: { data: { id: 'tweet-2' } } })

    const caption = 'a'.repeat(270) + ' https://example.com/' + 'b'.repeat(200)
    assert.ok(caption.length > 280)

    const result = await xAdapter.publish({ ...base, caption, media: [] })

    assert.equal(result.success, true, 'should measure the stripped text, not what was typed')
    assert.deepEqual(mock.requests[0].body, { text: 'a'.repeat(270) })
  })

  test('a caption that is nothing but a link is rejected, not posted blank', async () => {
    const result = await xAdapter.publish({
      ...base,
      caption: 'https://example.com',
      media: [],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage ?? '', /needs text or media/)
    assert.equal(mock.requests.length, 0, 'must not call X with an empty tweet')
  })

  test('the mock adapter applies the same stripping as the live X adapter', async () => {
    // Mock mode is only trustworthy if it measures what production measures.
    const caption = 'a'.repeat(275) + ' https://example.com/' + 'b'.repeat(50)

    const onX = await mockAdapter('x').publish({ ...base, caption, media: [] })
    assert.equal(onX.success, true, 'X strips the link, so the post fits')

    const onLinkedin = await mockAdapter('linkedin').publish({ ...base, caption, media: [] })
    assert.equal(onLinkedin.success, true, 'LinkedIn keeps the link and allows 3000 chars')
  })
})

describe('X Premium caption limit', () => {
  test('a standard account is held to 280 characters', () => {
    assert.equal(effectiveTextLimit('x'), 280)
    assert.equal(effectiveTextLimit('x', { hasXPremium: false }), 280)
  })

  test('a Premium account is allowed 25,000', () => {
    assert.equal(effectiveTextLimit('x', { hasXPremium: true }), X_PREMIUM_TEXT_LIMIT)
  })

  test('Premium does not change other platforms', () => {
    assert.equal(effectiveTextLimit('linkedin', { hasXPremium: true }), 3000)
  })

  test('validatePost rejects 1,000 chars without Premium and accepts them with it', () => {
    const caption = 'a'.repeat(1000)

    assert.match(validatePost('x', caption, []) ?? '', /allows 280/)
    assert.equal(validatePost('x', caption, [], { hasXPremium: true }), null)
  })

  test('even a Premium account is capped at 25,000', () => {
    const caption = 'a'.repeat(X_PREMIUM_TEXT_LIMIT + 1)
    assert.match(validatePost('x', caption, [], { hasXPremium: true }) ?? '', /allows 25000/)
  })

  test('the adapter publishes a 1,000-char post for a Premium account', async () => {
    mock.reply({ json: { data: { id: 'tweet-3' } } })

    const caption = 'a'.repeat(1000)
    const result = await xAdapter.publish({
      ...base,
      caption,
      media: [],
      accountCapabilities: { hasXPremium: true },
    })

    assert.equal(result.success, true)
    assert.equal(mock.requests.length, 1)
  })

  test('the adapter still rejects a 1,000-char post without Premium', async () => {
    const result = await xAdapter.publish({ ...base, caption: 'a'.repeat(1000), media: [] })

    assert.equal(result.success, false)
    assert.equal(mock.requests.length, 0, 'should not spend an API call on a known-bad post')
  })

  test('fetchProfile reads Premium off the profile', async () => {
    mock.reply({
      json: { data: { id: '42', username: 'jack', subscription_type: 'Premium' } },
    })

    const profile = await xAdapter.fetchProfile('tok')

    assert.equal(profile.hasXPremium, true)
    assert.match(mock.requests[0].url, /subscription_type/)
  })

  test('an unrecognised subscription_type field cannot break connecting an account', async () => {
    // X answers 400 for an unknown user.field. Account connection must still
    // succeed, falling back to the stricter non-Premium limit.
    mock
      .reply({ status: 400, json: { title: 'Invalid Request' } })
      .reply({ json: { data: { id: '42', username: 'jack' } } })

    const profile = await xAdapter.fetchProfile('tok')

    assert.equal(profile.platformAccountId, '42')
    assert.equal(profile.hasXPremium, false)
    assert.equal(mock.requests.length, 2, 'should retry without the optional field')
  })
})

describe('TikTok and YouTube disclosures', () => {
  test('a post can carry the TikTok AI-generated declaration', () => {
    const error = validatePost(
      'tiktok',
      'clip',
      [videoItem()],
      {},
      { tiktok: { isAigc: true, discloseBrandedContent: true } }
    )
    assert.equal(error, null)
  })

  test('TikTok rejects branded content on a private post', () => {
    const error = validatePlatformOptions(
      'tiktok',
      { tiktok: { discloseBrandedContent: true, privacyStatus: 'private' } },
      [videoItem()]
    )
    assert.match(error ?? '', /branded content on a private post/)
  })

  test('TikTok Duet and Stitch are video-only', () => {
    assert.match(
      validatePlatformOptions('tiktok', { tiktok: { allowDuet: true } }, [imageItem()]) ?? '',
      /video posts only/
    )
    assert.equal(
      validatePlatformOptions('tiktok', { tiktok: { allowDuet: true } }, [videoItem()]),
      null
    )
  })

  test('an invalid TikTok privacy value is caught before upload', () => {
    assert.match(
      validatePlatformOptions(
        'tiktok',
        { tiktok: { privacyStatus: 'friends' as never } },
        [videoItem()]
      ) ?? '',
      /must be "public" or "private"/
    )
  })

  test('a post can carry the YouTube synthetic-media and paid-promotion flags', () => {
    const error = validatePost(
      'youtube',
      'my video',
      [videoItem()],
      {},
      { youtube: { containsSyntheticMedia: true, hasPaidProductPlacement: true } }
    )
    assert.equal(error, null)
  })

  test('YouTube tags are capped at 500 characters in total', () => {
    const tooMany = Array.from({ length: 60 }, () => 'a'.repeat(10)) // 600 chars
    assert.match(
      validatePlatformOptions('youtube', { youtube: { tags: tooMany } }, [videoItem()]) ?? '',
      new RegExp('limit is ' + YOUTUBE_TAGS_MAX_CHARS)
    )

    const fine = Array.from({ length: 10 }, () => 'a'.repeat(10)) // 100 chars
    assert.equal(
      validatePlatformOptions('youtube', { youtube: { tags: fine } }, [videoItem()]),
      null
    )
  })

  test('options for one platform do not leak into another', () => {
    assert.equal(
      validatePlatformOptions('youtube', { tiktok: { allowDuet: true } }, [imageItem()]),
      null
    )
  })

  test('mock mode enforces the same disclosure rules as the live path', async () => {
    const result = await mockAdapter('tiktok').publish({
      ...base,
      mediaType: 'video',
      caption: 'clip',
      media: [videoItem()],
      platformOptions: { tiktok: { discloseBrandedContent: true, privacyStatus: 'private' } },
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage ?? '', /branded content on a private post/)
  })
})
