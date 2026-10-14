import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  captionAsPublished,
  mediaTypeFor,
  preflightResolvedTarget,
  resolveTargetContent,
  sanitizeConfigurations,
  validateConfigurationTargets,
  validateResolvedTarget,
} from '../lib/adapters/overrides'
import { mockAdapter } from '../lib/adapters/mock'
import { validatePost } from '../lib/adapters/limits'
import { imageItem, videoItem } from './helpers/mock-fetch'

const X_ACCOUNT = 'acc-x-1'
const LI_ACCOUNT = 'acc-li-1'

/** The post's own caption and media — the bottom of the precedence chain. */
const post = { caption: 'default caption', mediaUrls: ['https://cdn/a.jpg'] }

function resolve(
  platform: string,
  accountId: string,
  platformConfigurations: unknown = {},
  accountConfigurations: unknown = {}
) {
  return resolveTargetContent({
    platform,
    accountId,
    caption: post.caption,
    mediaUrls: post.mediaUrls,
    platformConfigurations,
    accountConfigurations,
  })
}

const premium = { hasXPremium: true }

describe('override precedence', () => {
  test('with no overrides a target publishes the post itself', () => {
    const resolved = resolve('x', X_ACCOUNT)

    assert.equal(resolved.caption, 'default caption')
    assert.deepEqual(resolved.mediaUrls, post.mediaUrls)
    assert.equal(resolved.captionFrom, 'post')
    assert.equal(resolved.mediaFrom, 'post')
  })

  test('a platform override beats the post default', () => {
    const resolved = resolve('x', X_ACCOUNT, { x: { caption: 'short for X' } })

    assert.equal(resolved.caption, 'short for X')
    assert.equal(resolved.captionFrom, 'platform')
  })

  test('an account override beats the platform override', () => {
    const resolved = resolve(
      'x',
      X_ACCOUNT,
      { x: { caption: 'platform text' } },
      { [X_ACCOUNT]: { caption: 'this account only' } }
    )

    assert.equal(resolved.caption, 'this account only')
    assert.equal(resolved.captionFrom, 'account')
  })

  test('caption and media fall through independently', () => {
    // The account overrides only the caption, so it still takes its platform's
    // media. Resolving the pair as one unit would quietly lose the media.
    const resolved = resolve(
      'x',
      X_ACCOUNT,
      { x: { media: ['https://cdn/x.jpg'] } },
      { [X_ACCOUNT]: { caption: 'account text' } }
    )

    assert.equal(resolved.caption, 'account text')
    assert.equal(resolved.captionFrom, 'account')
    assert.deepEqual(resolved.mediaUrls, ['https://cdn/x.jpg'])
    assert.equal(resolved.mediaFrom, 'platform')
  })

  test('a media-only override leaves the caption alone', () => {
    const resolved = resolve('linkedin', LI_ACCOUNT, {
      linkedin: { media: ['https://cdn/b.jpg', 'https://cdn/c.jpg'] },
    })

    assert.equal(resolved.caption, 'default caption')
    assert.equal(resolved.captionFrom, 'post')
    assert.equal(resolved.mediaUrls.length, 2)
  })

  test('overrides do not leak across platforms or accounts', () => {
    const platformConfigs = { x: { caption: 'for X' } }
    const accountConfigs = { [X_ACCOUNT]: { caption: 'for this X account' } }

    const linkedin = resolve('linkedin', LI_ACCOUNT, platformConfigs, accountConfigs)
    assert.equal(linkedin.caption, 'default caption')

    // Same platform, different account: it takes the platform text, not the
    // other account's.
    const otherXAccount = resolve('x', 'acc-x-2', platformConfigs, accountConfigs)
    assert.equal(otherXAccount.caption, 'for X')
  })

  test('two accounts on one platform can carry different captions', () => {
    const accountConfigs = {
      [X_ACCOUNT]: { caption: 'personal voice' },
      'acc-x-2': { caption: 'company voice' },
    }

    assert.equal(resolve('x', X_ACCOUNT, {}, accountConfigs).caption, 'personal voice')
    assert.equal(resolve('x', 'acc-x-2', {}, accountConfigs).caption, 'company voice')
  })
})

describe('what counts as an override', () => {
  test('an empty caption is a real override, not an absent one', () => {
    // "Text on X, image-only on Instagram" has to be expressible.
    const resolved = resolve('instagram', 'acc-ig', { instagram: { caption: '' } })

    assert.equal(resolved.caption, '')
    assert.equal(resolved.captionFrom, 'platform')
  })

  test('an empty media list is a real override', () => {
    const resolved = resolve('x', X_ACCOUNT, { x: { media: [] } })

    assert.deepEqual(resolved.mediaUrls, [])
    assert.equal(resolved.mediaFrom, 'platform')
  })

  test('null, and a missing key, both fall through', () => {
    const fromNull = resolve('x', X_ACCOUNT, { x: { caption: null, media: null } })
    assert.equal(fromNull.caption, post.caption)
    assert.equal(fromNull.captionFrom, 'post')
    assert.deepEqual(fromNull.mediaUrls, post.mediaUrls)

    assert.equal(resolve('x', X_ACCOUNT, { x: {} }).captionFrom, 'post')
  })

  test('a wrongly typed value is ignored rather than published', () => {
    // These come out of a jsonb column, so nothing guarantees their shape.
    // Falling back to the post's caption is recoverable; publishing "42" is not.
    const resolved = resolve('x', X_ACCOUNT, { x: { caption: 42, media: 'https://cdn/a.jpg' } })

    assert.equal(resolved.caption, post.caption)
    assert.deepEqual(resolved.mediaUrls, post.mediaUrls)
  })

  test('a media list with a non-string entry is dropped whole', () => {
    // Publishing a *subset* of someone's media is a silently wrong post.
    const resolved = resolve('x', X_ACCOUNT, { x: { media: ['https://cdn/a.jpg', 7] } })

    assert.deepEqual(resolved.mediaUrls, post.mediaUrls)
    assert.equal(resolved.mediaFrom, 'post')
  })

  test('junk in place of the configurations map cannot break resolution', () => {
    for (const junk of [null, undefined, 'nope', 42, [], [{ caption: 'x' }]]) {
      assert.equal(resolve('x', X_ACCOUNT, junk, junk).caption, post.caption)
    }
  })

  test('sanitizeConfigurations keeps the usable overrides and nothing else', () => {
    const clean = sanitizeConfigurations({
      x: { caption: 'keep', media: ['https://cdn/a.jpg'] },
      linkedin: { caption: 7 },
      instagram: { caption: '' },
      tiktok: 'not an object',
      youtube: {},
    })

    assert.deepEqual(clean, {
      x: { caption: 'keep', media: ['https://cdn/a.jpg'] },
      instagram: { caption: '' },
    })
  })
})

describe('validation runs against the resolved caption', () => {
  const tooLongForX = 'a'.repeat(400)

  test('the headline case: one post, two captions, both valid', () => {
    const configs = {
      x: { caption: 'Shipped it.' },
      linkedin: { caption: 'A'.repeat(2500) },
    }

    const onX = resolve('x', X_ACCOUNT, configs)
    const onLinkedin = resolve('linkedin', LI_ACCOUNT, configs)

    assert.equal(validateResolvedTarget({ platform: 'x', caption: onX.caption, media: [] }), null)
    assert.equal(
      validateResolvedTarget({ platform: 'linkedin', caption: onLinkedin.caption, media: [] }),
      null
    )
  })

  test('a too-long platform override is rejected even though the default fits', () => {
    const resolved = resolve('x', X_ACCOUNT, { x: { caption: tooLongForX } })

    const error = validateResolvedTarget({ platform: 'x', caption: resolved.caption, media: [] })
    assert.match(error ?? '', /allows 280/)
  })

  test('a short override rescues a default that is too long', () => {
    // Validating the post's own caption would reject this, which is exactly
    // the bug per-platform captions would otherwise introduce.
    const resolved = resolveTargetContent({
      platform: 'x',
      accountId: X_ACCOUNT,
      caption: tooLongForX,
      mediaUrls: [],
      platformConfigurations: { x: { caption: 'fits fine' } },
    })

    assert.equal(validateResolvedTarget({ platform: 'x', caption: resolved.caption, media: [] }), null)
    assert.match(validatePost('x', tooLongForX, []) ?? '', /allows 280/)
  })

  test('an account override is measured against that account’s own ceiling', () => {
    const resolved = resolve('x', X_ACCOUNT, {}, { [X_ACCOUNT]: { caption: 'b'.repeat(1000) } })
    const args = { platform: 'x', caption: resolved.caption, media: [] }

    assert.match(validateResolvedTarget(args) ?? '', /allows 280/)
    assert.equal(
      validateResolvedTarget({ ...args, capabilities: premium }),
      null,
      'the same text is valid on a Premium account'
    )
  })

  test('a media override is validated against the platform that gets it', () => {
    // Instagram requires media, so emptying it for Instagram alone must fail
    // there and leave the other platforms untouched.
    const configs = { instagram: { media: [] } }

    const onInstagram = resolve('instagram', 'acc-ig', configs)
    const onX = resolve('x', X_ACCOUNT, configs)

    assert.match(
      validateResolvedTarget({
        platform: 'instagram',
        caption: onInstagram.caption,
        media: [],
      }) ?? '',
      /requires media/
    )
    assert.equal(
      validateResolvedTarget({ platform: 'x', caption: onX.caption, media: [imageItem()] }),
      null
    )
  })

  test('a YouTube disclosure still applies to the overridden caption', () => {
    // platform_options is a separate column from the overrides; resolving a
    // caption must not drop the per-platform rules that go with it.
    const resolved = resolve('youtube', 'acc-yt', { youtube: { caption: 'new description' } })

    const error = validateResolvedTarget({
      platform: 'youtube',
      caption: resolved.caption,
      media: [videoItem()],
      options: { youtube: { tags: ['x'.repeat(600)] } },
    })

    assert.match(error ?? '', /YouTube tags total/)
  })
})

describe('resolved captions and X link stripping', () => {
  test('captionAsPublished strips for X only', () => {
    assert.equal(captionAsPublished('x', 'read foo.com now'), 'read now')
    assert.equal(captionAsPublished('linkedin', 'read foo.com now'), 'read foo.com now')
  })

  test('an override that only breaks 280 because of a URL still publishes', () => {
    // Stripping has to happen after resolution and before measuring.
    const caption = 'a'.repeat(270) + ' https://example.com/' + 'b'.repeat(200)
    const resolved = resolve('x', X_ACCOUNT, { x: { caption } })

    assert.ok(resolved.caption.length > 280)
    assert.equal(
      validateResolvedTarget({ platform: 'x', caption: resolved.caption, media: [] }),
      null
    )
  })

  test('the same override is measured with its link on LinkedIn', () => {
    const caption = 'a'.repeat(2900) + ' https://example.com/' + 'b'.repeat(200)
    const resolved = resolve('linkedin', LI_ACCOUNT, { linkedin: { caption } })

    assert.match(
      validateResolvedTarget({ platform: 'linkedin', caption: resolved.caption, media: [] }) ?? '',
      /allows 3000/
    )
  })

  test('an X override that is nothing but a link is rejected, not posted blank', () => {
    const resolved = resolve('x', X_ACCOUNT, { x: { caption: 'https://example.com', media: [] } })

    assert.match(
      validateResolvedTarget({ platform: 'x', caption: resolved.caption, media: [] }) ?? '',
      /needs text or media/
    )
  })

  test('stripping does not rescue a caption that is long without its link', () => {
    const resolved = resolve('x', X_ACCOUNT, { x: { caption: 'a'.repeat(300) + ' foo.com' } })

    assert.match(
      validateResolvedTarget({ platform: 'x', caption: resolved.caption, media: [] }) ?? '',
      /Text is 300 characters/
    )
  })
})

describe('create-time pre-flight', () => {
  test('agrees with publish-time validation on the caption rules', () => {
    // The composer checks captions before anything is uploaded; publish checks
    // again with the real bytes. The wording has to match or the user is told
    // two different things about one caption.
    const caption = 'a'.repeat(400)

    assert.equal(
      preflightResolvedTarget({ platform: 'x', caption, mediaCount: 0 }),
      validateResolvedTarget({ platform: 'x', caption, media: [] })
    )
  })

  test('counts media without needing its content type', () => {
    assert.equal(
      preflightResolvedTarget({ platform: 'instagram', caption: 'hi', mediaCount: 0 }),
      'Instagram requires media'
    )
    assert.equal(
      preflightResolvedTarget({ platform: 'instagram', caption: 'hi', mediaCount: 1 }),
      null
    )
  })

  test('measures X after stripping, like the publish path', () => {
    const caption = 'a'.repeat(275) + ' https://example.com/' + 'b'.repeat(50)

    assert.equal(preflightResolvedTarget({ platform: 'x', caption, mediaCount: 0 }), null)
  })

  test('an empty resolved caption with no media is rejected per target', () => {
    assert.match(
      preflightResolvedTarget({ platform: 'x', caption: '', mediaCount: 0 }) ?? '',
      /needs text or media/
    )
  })
})

describe('overrides that name nothing the post is going to', () => {
  const selected = { selectedPlatforms: ['x'], selectedAccountIds: [X_ACCOUNT] }

  test('accepts overrides for the selected platform and account', () => {
    assert.equal(
      validateConfigurationTargets({
        platformConfigurations: { x: { caption: 'hi' } },
        accountConfigurations: { [X_ACCOUNT]: { caption: 'hi' } },
        ...selected,
      }),
      null
    )
  })

  test('rejects an override for a platform that is not selected', () => {
    // Otherwise the user customises a caption and it silently never publishes.
    assert.match(
      validateConfigurationTargets({
        platformConfigurations: { linkedin: { caption: 'hi' } },
        accountConfigurations: {},
        ...selected,
      }) ?? '',
      /no LinkedIn account is selected/
    )
  })

  test('rejects an unknown platform key', () => {
    assert.match(
      validateConfigurationTargets({
        platformConfigurations: { bluesky: { caption: 'hi' } },
        accountConfigurations: {},
        ...selected,
      }) ?? '',
      /Unknown platform in overrides: bluesky/
    )
  })

  test('rejects an override for an account that is not selected', () => {
    assert.match(
      validateConfigurationTargets({
        platformConfigurations: {},
        accountConfigurations: { 'acc-x-2': { caption: 'hi' } },
        ...selected,
      }) ?? '',
      /account that is not selected/
    )
  })
})

describe('media type follows the resolved media', () => {
  test('derives the type each target actually sends', () => {
    assert.equal(mediaTypeFor([]), 'text')
    assert.equal(mediaTypeFor([imageItem()]), 'image')
    assert.equal(mediaTypeFor([imageItem(), imageItem()]), 'carousel')
    assert.equal(mediaTypeFor([videoItem()]), 'video')
  })

  test("a target that overrode its media no longer matches the post's type", () => {
    // posts.media_type describes the default media only, which is why the type
    // is derived per target rather than read off the post.
    const resolved = resolve('linkedin', LI_ACCOUNT, { linkedin: { media: [] } })

    assert.deepEqual(resolved.mediaUrls, [])
    assert.equal(mediaTypeFor([]), 'text')
  })
})

describe('mock mode sees the same resolved caption', () => {
  const base = { accessToken: 'tok', platformAccountId: 'x1', mediaType: 'text' as const }

  test('publishes the resolved override, not the post default', async () => {
    const resolved = resolve('x', X_ACCOUNT, { x: { caption: 'short for X' } })

    const result = await mockAdapter('x').publish({ ...base, caption: resolved.caption, media: [] })

    assert.equal(result.success, true)
  })

  test('rejects a resolved caption with the shared rule’s own message', async () => {
    const resolved = resolve('x', X_ACCOUNT, { x: { caption: 'a'.repeat(400) } })

    const result = await mockAdapter('x').publish({ ...base, caption: resolved.caption, media: [] })
    const shared = validateResolvedTarget({ platform: 'x', caption: resolved.caption, media: [] })

    assert.equal(result.success, false)
    // If these diverge a demo passes where production fails.
    assert.equal(result.errorMessage, shared)
  })

  test('strips links out of a resolved override before measuring', async () => {
    const caption = 'a'.repeat(275) + ' https://example.com/' + 'b'.repeat(50)
    const resolved = resolve('x', X_ACCOUNT, { x: { caption } })

    const result = await mockAdapter('x').publish({ ...base, caption: resolved.caption, media: [] })

    assert.equal(result.success, true)
  })

  test('accepts a long resolved caption for a Premium account', async () => {
    const resolved = resolve('x', X_ACCOUNT, {}, { [X_ACCOUNT]: { caption: 'b'.repeat(1000) } })

    const standard = await mockAdapter('x').publish({
      ...base,
      caption: resolved.caption,
      media: [],
    })
    const withPremium = await mockAdapter('x').publish({
      ...base,
      caption: resolved.caption,
      media: [],
      accountCapabilities: premium,
    })

    assert.equal(standard.success, false)
    assert.equal(withPremium.success, true)
  })
})
