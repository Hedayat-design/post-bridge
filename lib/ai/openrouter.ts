import { DEFAULT_MODEL } from './models'
import { buildMessages, cleanCaption } from './prompt'
import { GeneratedCaption, GenerationError, GenerationRequest } from './types'

/**
 * OpenRouter client.
 *
 * Server-only. The key is read from the environment on every call rather than
 * captured at module load, so a route cannot accidentally close over a stale
 * value, and so importing this file from the client would fail loudly rather
 * than quietly shipping a secret.
 *
 * Docs: https://openrouter.ai/docs/api-reference/chat-completion
 */
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

/** Generation is slow but not unbounded; a hung request must not hold a route open. */
const TIMEOUT_MS = 60_000

export function openRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}

export async function generateCaption(request: GenerationRequest): Promise<GeneratedCaption> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new GenerationError(
      'OPENROUTER_API_KEY is not set, so captions cannot be generated.'
    )
  }

  const model = request.style.model.trim() || DEFAULT_MODEL

  // AbortSignal.timeout is not in the project's lib target, so the controller
  // is wired by hand.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter attributes usage to an app with these; they are optional
        // and purely informational on their dashboard.
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
        'X-Title': 'Post Bridge',
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(request),
        // Captions are short, but a reasoning model spends output tokens
        // thinking before it writes, and those count against this cap. Too
        // low and the caption is truncated mid-sentence rather than refused,
        // which is the worse failure because it looks like a bad caption.
        max_tokens: 2000,
        temperature: 0.8,
      }),
    })
  } catch (e) {
    throw new GenerationError(
      (e as Error).name === 'AbortError'
        ? `The model did not respond within ${TIMEOUT_MS / 1000}s`
        : `Could not reach OpenRouter: ${(e as Error).message}`
    )
  } finally {
    clearTimeout(timer)
  }

  const data = await res.json().catch(() => ({} as any))

  if (!res.ok) {
    // OpenRouter reports both its own errors and the upstream provider's here.
    throw new GenerationError(
      data?.error?.message ?? `OpenRouter returned ${res.status}`
    )
  }

  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new GenerationError('The model returned an empty caption')
  }

  return {
    platform: request.style.platform,
    text: cleanCaption(raw),
    model,
    promptTokens: data?.usage?.prompt_tokens,
    completionTokens: data?.usage?.completion_tokens,
  }
}
