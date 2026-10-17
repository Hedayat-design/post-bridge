import { LIMITS } from '../adapters/limits'
import { GenerationRequest, PlatformStyle } from './types'

/**
 * Turns a stored style into the messages OpenRouter is sent.
 *
 * This file is the whole "how it writes" decision, kept away from transport so
 * it can be read and tested on its own.
 */

/**
 * What each platform rewards, as a factual note rather than an instruction to
 * "go viral" — a model told to chase virality writes clickbait, while a model
 * told how a platform's feed actually behaves writes something native to it.
 *
 * Deliberately short. The user's own examples carry far more signal than any
 * description we could write, so this only fills the gap before they have
 * added examples.
 */
const PLATFORM_NOTES: Record<string, string> = {
  x: 'Short, declarative, one idea. The first line has to work alone, because the rest is hidden behind "show more". No hashtags. Links are stripped from the post body and belong in a reply.',
  linkedin: 'The first two lines are all that shows before "see more", so the hook carries the post. Line breaks over paragraphs. Concrete specifics and numbers over adjectives. A closing question invites comments.',
  instagram: 'The image does the work; the caption adds context or a story. An opening line that earns the tap on "more". Hashtags are acceptable here, grouped at the end.',
  facebook: 'Conversational and a little longer. Plain language, no jargon. Posts that ask something get replies.',
  tiktok: 'Very short, spoken rather than written. It captions a video that is already playing, so it adds a hook or a punchline rather than describing.',
  youtube: 'A title that reads as a promise, then a description that delivers it. Front-load the searchable words.',
}

/**
 * The system prompt. Assembled from the platform note, the user's own
 * instructions and their example posts.
 *
 * Order matters: the user's instructions come after our note so that when the
 * two disagree, the user's wording is the thing the model read most recently
 * and is most likely to follow.
 */
export function buildSystemPrompt(style: PlatformStyle, characterLimit: number): string {
  const label = LIMITS[style.platform]?.label ?? style.platform
  const note = PLATFORM_NOTES[style.platform]

  const parts: string[] = [
    `You write social posts for ${label}. You are given an image and you write the caption that ships with it.`,
  ]

  if (note) parts.push(`How ${label} behaves: ${note}`)

  if (style.instructions.trim()) {
    parts.push(`The author's own instructions, which take priority over everything above:\n${style.instructions.trim()}`)
  }

  if (style.examples.length) {
    // Numbered and fenced so a multi-line example cannot be mistaken for the
    // end of the list.
    const examples = style.examples
      .map((example, i) => `--- Example ${i + 1} ---\n${example}`)
      .join('\n\n')
    parts.push(
      `Posts this author has written and is happy with. Match their voice, rhythm and punctuation habits — not their subject matter:\n\n${examples}`
    )
  }

  parts.push(
    [
      'Rules:',
      `- Stay under ${characterLimit} characters. This is a hard limit.`,
      '- Return only the caption. No preamble, no quotes around it, no "Here is".',
      '- Never invent a statistic, a quote or a result that is not visible in the image.',
      '- Do not mention that you are an AI or that the image was provided to you.',
    ].join('\n')
  )

  return parts.join('\n\n')
}

/** OpenRouter takes OpenAI-shaped messages; images ride as image_url parts. */
export type ChatMessage = {
  role: 'system' | 'user'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export function buildMessages(request: GenerationRequest): ChatMessage[] {
  const system = buildSystemPrompt(request.style, request.characterLimit)

  const userParts: ChatMessage['content'] = []

  const brief = request.brief?.trim()
  userParts.push({
    type: 'text',
    text: brief
      ? `Write the caption for this post. Additional steer for this one: ${brief}`
      : 'Write the caption for this post.',
  })

  for (const url of request.imageUrls) {
    userParts.push({ type: 'image_url', image_url: { url } })
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: userParts },
  ]
}

/**
 * Models wrap captions in quotes or open with "Here's a caption:" often
 * enough that stripping it is worth doing centrally. A caption that is
 * genuinely quoted end to end keeps its quotes only if it also contains
 * other quotes, which is the one case where stripping would corrupt it.
 */
export function cleanCaption(raw: string): string {
  let text = raw.trim()

  text = text.replace(/^(?:here(?:'s| is)[^\n:]*:|caption:)\s*/i, '').trim()

  const wrapped = /^"([\s\S]+)"$/.exec(text) ?? /^'([\s\S]+)'$/.exec(text)
  if (wrapped && !wrapped[1].includes('"')) text = wrapped[1].trim()

  return text
}
