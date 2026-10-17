import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  SocialAccount,
  accountCaption,
  appendLinks,
  asConfigurations,
  composeMediaType,
  composeTargets,
  linksToOffer,
  platformCaption,
  postRequestBody,
  replyCountLabel,
  withOverride,
  xReplyError,
  xReplyOptions,
} from '../lib/user/compose'
import { isConfigured, stylesByPlatform } from '../lib/user/styles'

const x: SocialAccount = { id: 'x1', platform: 'x', display_name: '@acme', has_x_premium: false }
const li: SocialAccount = { id: 'li1', platform: 'linkedin', display_name: 'Acme', has_x_premium: null }

describe('caption inheritance', () => {
  test('withOverride sets, keeps empty strings, and deletes on null', () => {
    assert.deepEqual(withOverride({}, 'x', ''), { x: '' })
    assert.deepEqual(withOverride({ x: 'a', li: 'b' }, 'x', null), { li: 'b' })
  })

  test('a platform inherits the default; an account inherits its platform', () => {
    assert.deepEqual(platformCaption({}, 'hello', 'x'), { text: 'hello', overridden: false })
    assert.deepEqual(platformCaption({ x: 'hi' }, 'hello', 'x'), { text: 'hi', overridden: true })
    assert.deepEqual(accountCaption({}, { x: 'hi' }, 'hello', 'x1', 'x'), { text: 'hi', overridden: false })
    assert.deepEqual(accountCaption({ x1: 'yo' }, { x: 'hi' }, 'hello', 'x1', 'x'), { text: 'yo', overridden: true })
  })
})

describe('composeTargets', () => {
  test('measures each account against its own caption, after X strips links', () => {
    const [tx, tli] = composeTargets({
      accounts: [x, li],
      caption: 'Launch day https://acme.dev',
      platformConfigurations: {},
      accountConfigurations: asConfigurations({ li1: 'LinkedIn only' }),
      mediaCount: 0,
    })
    assert.equal(tx.strippedALink, true)
    assert.ok(tx.published.length < tx.typed.length)
    assert.equal(tx.limit, 280)
    assert.equal(tli.source, 'account')
    assert.equal(tli.published, 'LinkedIn only')
  })

  test('offers stripped links not already in the first comment', () => {
    const targets = composeTargets({
      accounts: [x],
      caption: 'See https://a.dev and https://b.dev',
      platformConfigurations: {},
      accountConfigurations: {},
      mediaCount: 0,
    })
    assert.deepEqual(linksToOffer(targets, 'already https://a.dev'), ['https://b.dev'])
    assert.equal(appendLinks('  thanks ', ['https://b.dev']), 'thanks https://b.dev')
    assert.equal(appendLinks('', ['https://b.dev']), 'https://b.dev')
  })
})

describe('X replies', () => {
  test('a blank first comment is no comment; a blank thread row is kept and rejected', () => {
    assert.deepEqual(xReplyOptions('  ', []), {})
    const options = xReplyOptions('', [''])
    assert.deepEqual(options, { thread: [''] })
    assert.notEqual(xReplyError([x], options), null)
    assert.equal(xReplyError([x], {}), null)
  })

  test('reply count wording', () => {
    assert.equal(replyCountLabel('', []), 'No replies')
    assert.equal(replyCountLabel('hi', []), '1 reply under the post')
    assert.equal(replyCountLabel('hi', ['a']), '2 replies under the post')
  })
})

describe('postRequestBody', () => {
  test('drops overrides for unselected targets and replies without an X account', () => {
    const body = postRequestBody({
      caption: 'hi',
      mediaUrls: [],
      mediaType: 'text',
      scheduleAt: '',
      selected: ['li1'],
      selectedPlatforms: ['linkedin'],
      platformConfigurations: asConfigurations({ x: 'gone', linkedin: 'kept' }),
      accountConfigurations: asConfigurations({ x1: 'gone' }),
      xOptions: { firstComment: 'link' },
      hasXAccount: false,
    })
    assert.deepEqual(body.platformConfigurations, { linkedin: { caption: 'kept' } })
    assert.deepEqual(body.accountConfigurations, {})
    assert.deepEqual(body.platformOptions, {})
    assert.equal(body.scheduledFor, null)
  })

  test('media type from the chosen files', () => {
    assert.equal(composeMediaType([]), 'text')
    assert.equal(composeMediaType([{ type: 'image/png' }]), 'image')
    assert.equal(composeMediaType([{ type: 'image/png' }, { type: 'image/jpeg' }]), 'carousel')
    assert.equal(composeMediaType([{ type: 'image/png' }, { type: 'video/mp4' }]), 'video')
  })
})

describe('caption styles', () => {
  test('every platform gets a style; only real content counts as configured', () => {
    const styles = stylesByPlatform([{ platform: 'x', instructions: '', examples: null, model: '', enabled: true }])
    assert.deepEqual(styles.x.examples, [])
    assert.ok(styles.linkedin)
    assert.equal(isConfigured(styles.x), false)
    assert.equal(isConfigured({ ...styles.x, examples: ['  '] }), false)
    assert.equal(isConfigured({ ...styles.x, examples: ['a post'] }), true)
    assert.equal(isConfigured(undefined), false)
  })
})
