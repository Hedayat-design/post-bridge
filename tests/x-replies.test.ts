import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { xAdapter } from '../lib/adapters/x'
import { mockAdapter } from '../lib/adapters/mock'
import { TokenExpiredError } from '../lib/adapters/types'
import {
  plannedXReplies,
  sanitizePlatformOptions,
  validatePost,
  X_PREMIUM_TEXT_LIMIT,
  X_THREAD_MAX_ENTRIES,
} from '../lib/adapters/limits'
import { containsLink, extractLinks, stripLinks } from '../lib/adapters/x-links'
import { MockFetch, imageItem } from './helpers/mock-fetch'

let mock: MockFetch

beforeEach(() => {
  mock = new MockFetch()
  mock.install()
})
afterEach(() => mock.restore())

const base = { accessToken: 'tok', platformAccountId: '123', mediaType: 'text' as const }

/** Queues `n` successful tweet responses with predictable ids. */
function queueTweets(ids: string[]) {
  for (const id of ids) mock.reply({ json: { data: { id } } })
}

/** The /2/tweets requests, in the order they were sent. */
function tweets() {
  return mock.requests.filter((r) => r.url.endsWith('/2/tweets'))
}

describe('X first comment', () => {
  test('replies to the main tweet once it is live', async () => {
    queueTweets(['main-1', 'reply-1'])

    const result = await xAdapter.publish({
      ...base,
      caption: 'the main tweet',
      media: [],
      platformOptions: { x: { firstComment: 'more here' } },
    })

    assert.equal(result.success, true)
    assert.equal(result.platformPostId, 'main-1')
    assert.deepEqual(result.replyPostIds, ['reply-1'])
    assert.equal(result.partialErrorMessage, undefined)

    const [main, reply] = tweets()
    assert.deepEqual(main.body, { text: 'the main tweet' })
    assert.deepEqual(reply.body, {
      text: 'more here',
      reply: { in_reply_to_tweet_id: 'main-1' },
    })
  })

  test('is not sent at all when the main tweet is rejected', async () => {
    mock.reply({ status: 403, json: { detail: 'duplicate content' } })

    const result = await xAdapter.publish({
      ...base,
      caption: 'main',
      media: [],
      platformOptions: { x: { firstComment: 'link goes here' } },
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /duplicate content/)
    assert.equal(tweets().length, 1, 'a reply to a tweet that does not exist is a stray post')
  })

  test('hangs off the tweet, not off the uploaded media', async () => {
    mock
      .reply({ json: { data: { id: 'media-1' } } }) // INIT
      .reply({ json: {} })                          // APPEND
      .reply({ json: { data: { id: 'media-1' } } }) // FINALIZE
    queueTweets(['main-m', 'reply-m'])

    const result = await xAdapter.publish({
      ...base,
      mediaType: 'image',
      caption: 'photo post',
      media: [imageItem()],
      platformOptions: { x: { firstComment: 'see also' } },
    })

    assert.equal(result.success, true)
    const [main, reply] = tweets()
    assert.deepEqual(main.body, { text: 'photo post', media: { media_ids: ['media-1'] } })
    // The reply is text only — it must not re-attach the main tweet's media.
    assert.deepEqual(reply.body, { text: 'see also', reply: { in_reply_to_tweet_id: 'main-m' } })
  })
})

describe('X thread', () => {
  test('chains each entry to the one before it', async () => {
    queueTweets(['main-t', 't-1', 't-2', 't-3'])

    const result = await xAdapter.publish({
      ...base,
      caption: 'tweet 1 of 4',
      media: [],
      platformOptions: { x: { thread: ['tweet 2', 'tweet 3', 'tweet 4'] } },
    })

    assert.equal(result.success, true)
    assert.equal(result.platformPostId, 'main-t')
    assert.deepEqual(result.replyPostIds, ['t-1', 't-2', 't-3'])

    assert.deepEqual(
      tweets().map((r) => (r.body as any).reply?.in_reply_to_tweet_id),
      [undefined, 'main-t', 't-1', 't-2'],
      'each reply must point at the previous tweet, not at the root'
    )
    assert.deepEqual(
      tweets().map((r) => (r.body as any).text),
      ['tweet 1 of 4', 'tweet 2', 'tweet 3', 'tweet 4']
    )
  })

  test('runs after the first comment, as one chain', async () => {
    queueTweets(['main-c', 'fc', 'th-1', 'th-2'])

    const result = await xAdapter.publish({
      ...base,
      caption: 'opening tweet',
      media: [],
      platformOptions: {
        x: { firstComment: 'https://example.com', thread: ['part two', 'part three'] },
      },
    })

    assert.deepEqual(result.replyPostIds, ['fc', 'th-1', 'th-2'])
    assert.deepEqual(
      tweets().map((r) => (r.body as any).text),
      ['opening tweet', 'https://example.com', 'part two', 'part three'],
      'the first comment sits directly under the main tweet; the thread continues from it'
    )
    assert.deepEqual(
      tweets().map((r) => (r.body as any).reply?.in_reply_to_tweet_id),
      [undefined, 'main-c', 'fc', 'th-1']
    )
  })

  test('an empty options object posts nothing extra', async () => {
    queueTweets(['solo'])

    const result = await xAdapter.publish({
      ...base,
      caption: 'just the one',
      media: [],
      platformOptions: { x: {} },
    })

    assert.equal(result.success, true)
    assert.equal(tweets().length, 1)
    assert.equal(result.replyPostIds, undefined)
  })
})

describe('X links — stripped from the post, kept in the replies', () => {
  test('the main tweet loses its link and the first comment keeps it', async () => {
    queueTweets(['main-l', 'reply-l'])

    await xAdapter.publish({
      ...base,
      caption: 'read the launch post https://post-bridge.com/blog',
      media: [],
      platformOptions: { x: { firstComment: 'Full write-up: https://post-bridge.com/blog' } },
    })

    const [main, reply] = tweets()
    assert.equal((main.body as any).text, 'read the launch post')
    // The entire point of the first comment: the link the tweet gave up.
    assert.equal((reply.body as any).text, 'Full write-up: https://post-bridge.com/blog')
  })

  test('thread entries keep their links too, bare domains included', async () => {
    queueTweets(['m', 'r1', 'r2'])

    await xAdapter.publish({
      ...base,
      caption: 'see example.com for details',
      media: [],
      platformOptions: { x: { thread: ['docs at example.com/docs', 'and www.example.com'] } },
    })

    const [main, r1, r2] = tweets()
    assert.equal((main.body as any).text, 'see for details')
    assert.equal((r1.body as any).text, 'docs at example.com/docs')
    assert.equal((r2.body as any).text, 'and www.example.com')
  })

  test('a caption that is only a link still publishes when a reply carries it', async () => {
    // Stripping leaves nothing, so the post has to stand on its media.
    mock
      .reply({ json: { data: { id: 'media-x' } } })
      .reply({ json: {} })
      .reply({ json: { data: { id: 'media-x' } } })
    queueTweets(['main-only', 'reply-only'])

    const result = await xAdapter.publish({
      ...base,
      mediaType: 'image',
      caption: 'https://post-bridge.com',
      media: [imageItem()],
      platformOptions: { x: { firstComment: 'https://post-bridge.com' } },
    })

    assert.equal(result.success, true)
    assert.equal((tweets()[0].body as any).text, '')
    assert.equal((tweets()[1].body as any).text, 'https://post-bridge.com')
  })
})

describe('X partial failure — the tweet is live, a reply is not', () => {
  test('reports success with the real tweet id and the reply error', async () => {
    queueTweets(['main-p'])
    mock.reply({ status: 400, json: { detail: 'reply not permitted' } })

    const result = await xAdapter.publish({
      ...base,
      caption: 'this one went out',
      media: [],
      platformOptions: { x: { firstComment: 'but this did not' } },
    })

    // Not a flat failure: the tweet cannot be unsent, and a retry would
    // double-post it.
    assert.equal(result.success, true)
    assert.equal(result.platformPostId, 'main-p')
    assert.deepEqual(result.replyPostIds, [])
    assert.match(result.partialErrorMessage!, /first comment failed/)
    assert.match(result.partialErrorMessage!, /reply not permitted/)
    assert.equal(result.errorMessage, undefined)
  })

  test('stops the chain at the failure and keeps the ids that went out', async () => {
    queueTweets(['main-s', 'th-1'])
    mock.reply({ status: 500, json: { detail: 'over capacity' } })

    const result = await xAdapter.publish({
      ...base,
      caption: 'root',
      media: [],
      platformOptions: { x: { thread: ['two', 'three', 'four'] } },
    })

    assert.equal(result.success, true)
    assert.deepEqual(result.replyPostIds, ['th-1'])
    // Entry 2 failed, so 3 and 4 are never attempted — they would reply to a
    // tweet that does not exist.
    assert.match(result.partialErrorMessage!, /thread entry 2 failed/)
    assert.equal(tweets().length, 3)
  })

  test('names the failing thread entry correctly with no first comment', async () => {
    queueTweets(['main-n'])
    mock.reply({ status: 400, json: { detail: 'nope' } })

    const result = await xAdapter.publish({
      ...base,
      caption: 'root',
      media: [],
      platformOptions: { x: { thread: ['two'] } },
    })

    assert.match(result.partialErrorMessage!, /thread entry 1 failed/)
    assert.doesNotMatch(result.partialErrorMessage!, /first comment/)
  })

  test('a token that dies mid-chain does not throw — the tweet is already live', async () => {
    queueTweets(['main-401'])
    mock.reply({ status: 401, json: { title: 'Unauthorized' } })

    const result = await xAdapter.publish({
      ...base,
      caption: 'published before the token died',
      media: [],
      platformOptions: { x: { firstComment: 'orphaned reply' } },
    })

    // TokenExpiredError here would mark the target failed and prompt a
    // reconnect-and-retry, double-posting a tweet that is already up.
    assert.equal(result.success, true)
    assert.equal(result.platformPostId, 'main-401')
    assert.match(result.partialErrorMessage!, /first comment failed/)
  })

  test('still throws TokenExpiredError when the main tweet itself is rejected', async () => {
    mock.reply({ status: 401, json: { title: 'Unauthorized' } })

    await assert.rejects(
      () =>
        xAdapter.publish({
          ...base,
          caption: 'nothing published',
          media: [],
          platformOptions: { x: { firstComment: 'never sent' } },
        }),
      TokenExpiredError
    )
  })
})

describe('X reply validation — before the main tweet goes out', () => {
  test('an over-long thread entry is caught before anything publishes', async () => {
    const result = await xAdapter.publish({
      ...base,
      caption: 'fine',
      media: [],
      platformOptions: { x: { thread: ['ok', 'a'.repeat(281)] } },
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /thread entry 2 is 281 characters/)
    // Catching it up front is the whole point: a mid-chain rejection would
    // leave a half-published thread that cannot be rolled back.
    assert.equal(mock.requests.length, 0)
  })

  test('an over-long first comment is rejected', async () => {
    const result = await xAdapter.publish({
      ...base,
      caption: 'fine',
      media: [],
      platformOptions: { x: { firstComment: 'a'.repeat(281) } },
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /first comment is 281 characters/)
    assert.equal(mock.requests.length, 0)
  })

  test('Premium raises the ceiling for replies as well as the post', () => {
    const long = 'a'.repeat(1000)

    assert.match(
      validatePost('x', 'hi', [], {}, { x: { firstComment: long } }) ?? '',
      /first comment is 1000 characters; X allows 280/
    )
    assert.equal(
      validatePost('x', 'hi', [], { hasXPremium: true }, { x: { firstComment: long } }),
      null
    )
    assert.equal(
      validatePost(
        'x',
        'hi',
        [],
        { hasXPremium: true },
        { x: { thread: ['a'.repeat(X_PREMIUM_TEXT_LIMIT)] } }
      ),
      null
    )
  })

  test('rejects a blank reply rather than breaking the chain on it', () => {
    assert.match(validatePost('x', 'hi', [], {}, { x: { firstComment: '  ' } }) ?? '', /empty/)
    assert.match(
      validatePost('x', 'hi', [], {}, { x: { thread: ['one', ''] } }) ?? '',
      /thread entry 2 is empty/
    )
  })

  test('rejects a thread longer than X allows', () => {
    const tooMany = Array.from({ length: X_THREAD_MAX_ENTRIES + 1 }, (_, i) => `part ${i}`)

    assert.match(
      validatePost('x', 'hi', [], {}, { x: { thread: tooMany } }) ?? '',
      new RegExp(`limited to ${X_THREAD_MAX_ENTRIES} replies`)
    )
    assert.equal(
      validatePost('x', 'hi', [], {}, { x: { thread: tooMany.slice(0, X_THREAD_MAX_ENTRIES) } }),
      null
    )
  })

  test('X options on another platform are ignored', () => {
    assert.equal(
      validatePost('linkedin', 'hi', [], {}, { x: { firstComment: 'a'.repeat(5000) } }),
      null
    )
  })
})

describe('plannedXReplies — the order every adapter reads', () => {
  test('first comment, then thread entries, labelled 1-based', () => {
    assert.deepEqual(plannedXReplies({ firstComment: 'fc', thread: ['a', 'b'] }), [
      { label: 'first comment', text: 'fc' },
      { label: 'thread entry 1', text: 'a' },
      { label: 'thread entry 2', text: 'b' },
    ])
  })

  test('is empty with no options at all', () => {
    assert.deepEqual(plannedXReplies(), [])
    assert.deepEqual(plannedXReplies({}), [])
  })

  test('keeps an explicitly empty first comment so validation can reject it', () => {
    // Dropping it here would let a blank reply reach X, which rejects it
    // after the main tweet is already live.
    assert.deepEqual(plannedXReplies({ firstComment: '' }), [
      { label: 'first comment', text: '' },
    ])
  })
})

describe('mock mode matches the live reply behaviour', () => {
  const x = mockAdapter('x')

  test('returns one reply id per planned reply, in order', async () => {
    const result = await x.publish({
      ...base,
      caption: 'demo post',
      media: [],
      platformOptions: { x: { firstComment: 'link', thread: ['two', 'three'] } },
    })

    assert.equal(result.success, true)
    assert.equal(result.replyPostIds?.length, 3)
    assert.equal(new Set(result.replyPostIds).size, 3, 'ids must be distinct')
  })

  test('enforces the same reply rules as the live adapter', async () => {
    const options = { x: { thread: ['a'.repeat(281)] } }

    const live = await xAdapter.publish({ ...base, caption: 'hi', media: [], platformOptions: options })
    const demo = await x.publish({ ...base, caption: 'hi', media: [], platformOptions: options })

    assert.equal(live.success, false)
    assert.equal(demo.success, false)
    assert.equal(demo.errorMessage, live.errorMessage)
  })

  test('[replyfail] reproduces the partial state', async () => {
    const result = await x.publish({
      ...base,
      caption: 'live tweet [replyfail]',
      media: [],
      platformOptions: { x: { firstComment: 'this one fails' } },
    })

    assert.equal(result.success, true)
    assert.ok(result.platformPostId, 'the post is live, so it must carry an id')
    assert.deepEqual(result.replyPostIds, [])
    assert.match(result.partialErrorMessage!, /first comment failed/)
  })

  test('[replyfail] without replies is an ordinary success', async () => {
    const result = await x.publish({ ...base, caption: 'plain [replyfail]', media: [] })

    assert.equal(result.success, true)
    assert.equal(result.partialErrorMessage, undefined)
  })
})

describe('extractLinks — what the composer offers to move', () => {
  test('finds scheme URLs, www hosts and bare domains', () => {
    assert.deepEqual(extractLinks('see https://post-bridge.com/blog now'), [
      'https://post-bridge.com/blog',
    ])
    assert.deepEqual(extractLinks('try www.example.com'), ['www.example.com'])
    assert.deepEqual(extractLinks('docs at example.com/docs'), ['example.com/docs'])
  })

  test('what it returns is exactly what stripLinks removes', () => {
    const caption = 'launch post https://post-bridge.com and mirror at example.org/x'

    const links = extractLinks(caption)
    assert.equal(links.length, 2)
    assert.equal(containsLink(caption), true)

    // Nothing it reported survives in the post body, and nothing it missed is
    // left behind. If the two ever disagree the composer either offers a link
    // the post keeps, or keeps one it claims to have moved.
    const published = stripLinks(caption)
    for (const link of links) assert.ok(!published.includes(link), `${link} should be gone`)

    let remaining = caption
    for (const link of links) remaining = remaining.replace(link, '')
    assert.deepEqual(extractLinks(remaining), [])
  })

  test('does not report a scheme URL twice via its www tail', () => {
    assert.deepEqual(extractLinks('go to https://www.example.com/path'), [
      'https://www.example.com/path',
    ])
  })

  test('drops exact repeats but keeps distinct links', () => {
    assert.deepEqual(extractLinks('a example.com b example.com'), ['example.com'])
    assert.deepEqual(extractLinks('a example.com b example.org'), ['example.com', 'example.org'])
  })

  test('is empty for prose a loose regex would mangle', () => {
    assert.deepEqual(extractLinks('Node.js, e.g. this. P.S. Come in'), [])
    assert.deepEqual(extractLinks('mail support@post-bridge.com'), [])
    assert.deepEqual(extractLinks('no links at all'), [])
  })
})

describe('sanitizePlatformOptions — what reaches the platform verbatim', () => {
  test('keeps well-formed X replies', () => {
    assert.deepEqual(
      sanitizePlatformOptions({ x: { firstComment: 'link', thread: ['a', 'b'] } }),
      { x: { firstComment: 'link', thread: ['a', 'b'] } }
    )
  })

  test('drops a thread whole when one entry is not a string', () => {
    // Publishing a subset of someone's thread is a silently wrong post.
    assert.deepEqual(sanitizePlatformOptions({ x: { thread: ['ok', 42] } }), {})
    assert.deepEqual(sanitizePlatformOptions({ x: { firstComment: 'kept', thread: ['ok', null] } }), {
      x: { firstComment: 'kept' },
    })
  })

  test('drops a non-string first comment rather than coercing it', () => {
    assert.deepEqual(sanitizePlatformOptions({ x: { firstComment: 42 } }), {})
  })

  test('ignores anything that is not an options object', () => {
    for (const bad of [null, undefined, 'x', 7, ['x'], { x: 'nope' }, { x: [] }]) {
      assert.deepEqual(sanitizePlatformOptions(bad), {}, `should ignore ${JSON.stringify(bad)}`)
    }
  })

  test('keeps the TikTok and YouTube disclosures, dropping unknown privacy', () => {
    assert.deepEqual(
      sanitizePlatformOptions({
        tiktok: { isAigc: true, privacyStatus: 'private', allowDuet: 'yes' },
        youtube: { containsSyntheticMedia: true, tags: ['a'], title: 'T' },
      }),
      {
        tiktok: { isAigc: true, privacyStatus: 'private' },
        youtube: { containsSyntheticMedia: true, tags: ['a'], title: 'T' },
      }
    )

    // An unrecognised privacy value is dropped, not guessed at.
    assert.deepEqual(sanitizePlatformOptions({ tiktok: { privacyStatus: 'friends' } }), {})
  })

  test('what survives sanitizing is what the adapter validates', async () => {
    const options = sanitizePlatformOptions({ x: { thread: ['a'.repeat(281)] } })

    const result = await xAdapter.publish({ ...base, caption: 'hi', media: [], platformOptions: options })
    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /thread entry 1 is 281 characters/)
  })
})
