import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { buildMessages, buildSystemPrompt, cleanCaption } from '../lib/ai/prompt'
import { generateCaption } from '../lib/ai/openrouter'
import { DEFAULT_MODEL } from '../lib/ai/models'
import { GenerationError, PlatformStyle } from '../lib/ai/types'
import { captionLimitFor, monthStart, quotaState } from '../lib/ai/quota'
import { MockFetch } from './helpers/mock-fetch'

let mock: MockFetch
const saved = { ...process.env }

beforeEach(() => {
  mock = new MockFetch()
  mock.install()
  process.env.OPENROUTER_API_KEY = 'or-test-key'
})
afterEach(() => {
  mock.restore()
  process.env = { ...saved }
})

function style(overrides: Partial<PlatformStyle> = {}): PlatformStyle {
  return {
    platform: 'x',
    instructions: '',
    examples: [],
    model: '',
    enabled: true,
    ...overrides,
  }
}

const request = (overrides: Partial<Parameters<typeof generateCaption>[0]> = {}) => ({
  style: style(),
  characterLimit: 280,
  imageUrls: ['https://storage.example/chart.png'],
  ...overrides,
})

describe('system prompt', () => {
  test('states the platform and its hard character limit', () => {
    const prompt = buildSystemPrompt(style(), 280)

    assert.match(prompt, /X/)
    assert.match(prompt, /under 280 characters/)
    assert.match(prompt, /hard limit/i)
  })

  test('carries the Premium limit when the account has it', () => {
    assert.match(buildSystemPrompt(style(), 25_000), /under 25000 characters/)
  })

  test("puts the author's instructions after our platform note", () => {
    const prompt = buildSystemPrompt(
      style({ instructions: 'Never use the word "excited".' }),
      280
    )

    // When the two disagree the author's wording should be what the model
    // read most recently, so it has to come last.
    assert.ok(
      prompt.indexOf('Never use the word') > prompt.indexOf('How X behaves'),
      "the author's instructions must follow the platform note"
    )
    assert.match(prompt, /take priority/i)
  })

  test('includes every example, numbered and separated', () => {
    const prompt = buildSystemPrompt(
      style({ examples: ['first post', 'second\nwith a newline'] }),
      280
    )

    assert.match(prompt, /Example 1/)
    assert.match(prompt, /first post/)
    assert.match(prompt, /Example 2/)
    assert.match(prompt, /second\nwith a newline/)
    // Voice, not topic — otherwise every post becomes about the examples.
    assert.match(prompt, /not their subject matter/i)
  })

  test('omits the examples section entirely when there are none', () => {
    assert.doesNotMatch(buildSystemPrompt(style(), 280), /Example 1/)
  })

  test('forbids inventing figures that are not in the image', () => {
    assert.match(buildSystemPrompt(style(), 280), /Never invent a statistic/i)
  })

  test('gives each platform its own note', () => {
    const x = buildSystemPrompt(style({ platform: 'x' }), 280)
    const linkedin = buildSystemPrompt(style({ platform: 'linkedin' }), 3000)

    assert.match(x, /show more/)
    assert.match(linkedin, /see more/)
    assert.notEqual(x, linkedin)
  })

  test('still produces a usable prompt for a platform with no note', () => {
    const prompt = buildSystemPrompt(style({ platform: 'facebook' }), 63206)
    assert.match(prompt, /Facebook/)
    assert.match(prompt, /under 63206 characters/)
  })
})

describe('messages sent to the model', () => {
  test('attaches every image so the caption can describe them', () => {
    const messages = buildMessages(
      request({ imageUrls: ['https://a/1.png', 'https://a/2.png'] }) as any
    )

    assert.equal(messages[0].role, 'system')
    assert.equal(messages[1].role, 'user')

    const images = (messages[1].content as any[]).filter((p) => p.type === 'image_url')
    assert.deepEqual(images.map((i) => i.image_url.url), ['https://a/1.png', 'https://a/2.png'])
  })

  test('folds a per-post brief into the user turn', () => {
    const messages = buildMessages(request({ brief: 'angle it at founders' }) as any)
    const text = (messages[1].content as any[]).find((p) => p.type === 'text')

    assert.match(text.text, /angle it at founders/)
  })

  test('says nothing about a brief when there is none', () => {
    const messages = buildMessages(request({ brief: '   ' }) as any)
    const text = (messages[1].content as any[]).find((p) => p.type === 'text')

    assert.equal(text.text, 'Write the caption for this post.')
  })
})

describe('cleanCaption', () => {
  test('strips a preamble the model added', () => {
    assert.equal(cleanCaption("Here's a caption:\nThe real post"), 'The real post')
    assert.equal(cleanCaption('Here is the caption for X: The real post'), 'The real post')
    assert.equal(cleanCaption('Caption: The real post'), 'The real post')
  })

  test('unwraps a caption the model quoted whole', () => {
    assert.equal(cleanCaption('"The real post"'), 'The real post')
  })

  test('keeps quotes that are part of the caption', () => {
    // Stripping here would corrupt the post rather than tidy it.
    const quoted = '"Ship it," they said. "What could go wrong?"'
    assert.equal(cleanCaption(quoted), quoted)
  })

  test('leaves an ordinary caption untouched', () => {
    assert.equal(cleanCaption('  Just a normal post.  '), 'Just a normal post.')
  })
})

describe('OpenRouter client', () => {
  test('posts the model, messages and auth header', async () => {
    mock.reply({ json: { choices: [{ message: { content: 'A tidy caption' } }] } })

    const result = await generateCaption(
      request({ style: style({ model: 'some/model' }) }) as any
    )

    assert.equal(result.text, 'A tidy caption')
    assert.equal(result.model, 'some/model')

    const [req] = mock.requests
    assert.match(req.url, /openrouter\.ai\/api\/v1\/chat\/completions$/)
    assert.equal(req.headers.authorization, 'Bearer or-test-key')
    assert.equal((req.body as any).model, 'some/model')
    assert.equal((req.body as any).messages.length, 2)
  })

  test('falls back to the default model when the style has none', async () => {
    mock.reply({ json: { choices: [{ message: { content: 'x' } }] } })

    const result = await generateCaption(request() as any)

    assert.equal(result.model, DEFAULT_MODEL)
    assert.equal((mock.requests[0].body as any).model, DEFAULT_MODEL)
  })

  test('caps output tokens so a runaway response cannot bill forever', async () => {
    mock.reply({ json: { choices: [{ message: { content: 'x' } }] } })
    await generateCaption(request() as any)

    assert.ok((mock.requests[0].body as any).max_tokens <= 2000)
  })

  test('reports usage back for the generation log', async () => {
    mock.reply({
      json: {
        choices: [{ message: { content: 'x' } }],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
      },
    })

    const result = await generateCaption(request() as any)

    assert.equal(result.promptTokens, 120)
    assert.equal(result.completionTokens, 30)
  })

  test("surfaces OpenRouter's own error message", async () => {
    mock.reply({ status: 402, json: { error: { message: 'Insufficient credits' } } })

    await assert.rejects(() => generateCaption(request() as any), (e: Error) => {
      assert.ok(e instanceof GenerationError)
      assert.match(e.message, /Insufficient credits/)
      return true
    })
  })

  test('treats an empty completion as a failure rather than an empty caption', async () => {
    mock.reply({ json: { choices: [{ message: { content: '   ' } }] } })

    await assert.rejects(() => generateCaption(request() as any), /empty caption/)
  })

  test('refuses to call out when no API key is configured', async () => {
    delete process.env.OPENROUTER_API_KEY

    await assert.rejects(() => generateCaption(request() as any), /OPENROUTER_API_KEY/)
    assert.equal(mock.requests.length, 0, 'must not reach the network without a key')
  })
})

describe('generation quota', () => {
  test('each plan has its own monthly ceiling', () => {
    assert.equal(captionLimitFor('free'), 15)
    assert.equal(captionLimitFor('starter'), 300)
    assert.equal(captionLimitFor('creator'), 1000)
    assert.equal(captionLimitFor('pro'), Infinity)
  })

  test('an unknown or missing plan gets the free ceiling', () => {
    assert.equal(captionLimitFor(undefined), 15)
    assert.equal(captionLimitFor('enterprise'), 15)
  })

  test('reports what is left and when it is spent', () => {
    assert.deepEqual(quotaState(3, 'free'), {
      used: 3,
      limit: 15,
      remaining: 12,
      exceeded: false,
    })
    assert.equal(quotaState(15, 'free').exceeded, true)
    // Over the line (a plan downgrade) must not report negative headroom.
    assert.equal(quotaState(40, 'free').remaining, 0)
  })

  test('pro is never exceeded', () => {
    const state = quotaState(10_000, 'pro')
    assert.equal(state.exceeded, false)
    assert.equal(state.remaining, Infinity)
  })

  test('the window starts at the first of the month in UTC', () => {
    const start = monthStart(new Date('2026-03-18T22:30:00Z'))

    assert.equal(start.toISOString(), '2026-03-01T00:00:00.000Z')
  })
})
