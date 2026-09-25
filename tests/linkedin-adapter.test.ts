import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { linkedinAdapter } from '../lib/adapters/linkedin'
import { TokenExpiredError } from '../lib/adapters/types'
import { MockFetch, imageItem, videoItem } from './helpers/mock-fetch'

let mock: MockFetch

beforeEach(() => {
  mock = new MockFetch()
  mock.install()
})
afterEach(() => mock.restore())

const base = { accessToken: 'tok', platformAccountId: 'ABC123', mediaType: 'text' as const }

describe('LinkedIn adapter — publishing', () => {
  test('includes the author URN that the previous implementation omitted', async () => {
    mock.reply({ headers: { 'x-restli-id': 'urn:li:share:999' }, json: {} })

    const result = await linkedinAdapter.publish({ ...base, caption: 'hello', media: [] })

    assert.equal(result.success, true)
    assert.equal(result.platformPostId, 'urn:li:share:999')

    const [req] = mock.requests
    const body = req.body as Record<string, any>
    // Without `author` LinkedIn returns 400 on every post.
    assert.equal(body.author, 'urn:li:person:ABC123')
    assert.equal(body.lifecycleState, 'PUBLISHED')
    assert.equal(body.visibility, 'PUBLIC')
    assert.equal(body.distribution.feedDistribution, 'MAIN_FEED')
  })

  test('sends the versioned API headers', async () => {
    mock.reply({ headers: { 'x-restli-id': 'urn:li:share:1' }, json: {} })

    await linkedinAdapter.publish({ ...base, caption: 'hi', media: [] })

    const [req] = mock.requests
    assert.ok(req.headers['linkedin-version'], 'LinkedIn-Version is mandatory on /rest')
    assert.equal(req.headers['x-restli-protocol-version'], '2.0.0')
    assert.equal(req.headers.authorization, 'Bearer tok')
  })

  test('escapes Little Text control characters in the commentary', async () => {
    mock.reply({ headers: { 'x-restli-id': 'urn:li:share:2' }, json: {} })

    await linkedinAdapter.publish({
      ...base,
      caption: 'Check (this) out @ 50% #growth',
      media: [],
    })

    const body = mock.requests[0].body as Record<string, any>
    assert.equal(body.commentary, 'Check \\(this\\) out \\@ 50% \\#growth')
  })

  test('uploads a single image and references its URN', async () => {
    mock
      .reply({ json: { value: { uploadUrl: 'https://upload.li/1', image: 'urn:li:image:IMG1' } } })
      .reply({ json: {} })                                                  // PUT bytes
      .reply({ headers: { 'x-restli-id': 'urn:li:share:3' }, json: {} })   // post

    const result = await linkedinAdapter.publish({
      ...base,
      mediaType: 'image',
      caption: 'photo',
      media: [imageItem()],
    })

    assert.equal(result.success, true)

    const [init, upload, post] = mock.requests
    assert.match(init.url, /\/rest\/images\?action=initializeUpload/)
    assert.equal((init.body as any).initializeUploadRequest.owner, 'urn:li:person:ABC123')

    assert.equal(upload.url, 'https://upload.li/1')
    assert.equal(upload.method, 'PUT')

    assert.deepEqual((post.body as any).content, { media: { id: 'urn:li:image:IMG1' } })
  })

  test('uses multiImage content for several images', async () => {
    mock
      .reply({ json: { value: { uploadUrl: 'https://upload.li/a', image: 'urn:li:image:A' } } })
      .reply({ json: {} })
      .reply({ json: { value: { uploadUrl: 'https://upload.li/b', image: 'urn:li:image:B' } } })
      .reply({ json: {} })
      .reply({ headers: { 'x-restli-id': 'urn:li:share:4' }, json: {} })

    await linkedinAdapter.publish({
      ...base,
      mediaType: 'carousel',
      caption: 'two photos',
      media: [imageItem(), imageItem()],
    })

    const post = mock.requests.at(-1)!
    assert.deepEqual((post.body as any).content, {
      multiImage: { images: [{ id: 'urn:li:image:A' }, { id: 'urn:li:image:B' }] },
    })
  })

  test('uploads video parts and echoes their ETags on finalize', async () => {
    mock
      .reply({
        json: {
          value: {
            video: 'urn:li:video:V1',
            uploadToken: 'utok',
            uploadInstructions: [
              { uploadUrl: 'https://upload.li/p1', firstByte: 0, lastByte: 1023 },
              { uploadUrl: 'https://upload.li/p2', firstByte: 1024, lastByte: 2047 },
            ],
          },
        },
      })
      .reply({ headers: { etag: 'etag-1' }, json: {} })
      .reply({ headers: { etag: 'etag-2' }, json: {} })
      .reply({ json: {} })                                                  // finalize
      .reply({ headers: { 'x-restli-id': 'urn:li:share:5' }, json: {} })   // post

    const result = await linkedinAdapter.publish({
      ...base,
      mediaType: 'video',
      caption: 'clip',
      media: [videoItem(2048)],
    })

    assert.equal(result.success, true)

    const finalize = mock.requests.find((r) => r.url.includes('finalizeUpload'))!
    assert.deepEqual((finalize.body as any).finalizeUploadRequest.uploadedPartIds, ['etag-1', 'etag-2'])
    assert.equal((finalize.body as any).finalizeUploadRequest.video, 'urn:li:video:V1')
  })

  test('fails the post when a video part returns no ETag', async () => {
    mock
      .reply({
        json: {
          value: {
            video: 'urn:li:video:V2',
            uploadInstructions: [{ uploadUrl: 'https://upload.li/p1', firstByte: 0, lastByte: 2047 }],
          },
        },
      })
      .reply({ json: {} }) // no etag header

    const result = await linkedinAdapter.publish({
      ...base,
      mediaType: 'video',
      caption: 'clip',
      media: [videoItem(2048)],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /ETag/)
  })
})

describe('LinkedIn adapter — validation', () => {
  test('rejects text over 3000 characters', async () => {
    const result = await linkedinAdapter.publish({ ...base, caption: 'a'.repeat(3001), media: [] })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /3000/)
    assert.equal(mock.requests.length, 0)
  })

  test('rejects mixing video and images', async () => {
    const result = await linkedinAdapter.publish({
      ...base,
      mediaType: 'carousel',
      caption: 'mixed',
      media: [videoItem(), imageItem()],
    })

    assert.equal(result.success, false)
    assert.match(result.errorMessage!, /cannot mix/)
  })
})

describe('LinkedIn adapter — auth', () => {
  test('reads identity from the OIDC userinfo endpoint', async () => {
    mock.reply({ json: { sub: 'XYZ', name: 'Ada Lovelace', picture: 'https://img' } })

    const profile = await linkedinAdapter.fetchProfile('tok')

    assert.match(mock.requests[0].url, /\/v2\/userinfo$/)
    assert.equal(profile.platformAccountId, 'XYZ')
    assert.equal(profile.displayName, 'Ada Lovelace')
  })

  test('throws TokenExpiredError on 401', async () => {
    mock.reply({ status: 401, json: {} })

    await assert.rejects(
      () => linkedinAdapter.publish({ ...base, caption: 'hi', media: [] }),
      TokenExpiredError
    )
  })
})
