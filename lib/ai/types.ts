/**
 * Shared shapes for caption generation.
 *
 * Kept apart from the OpenRouter client so the prompt builder and the route
 * can be tested without touching anything network-shaped.
 */

/** A user's voice for one platform, as stored in `platform_styles`. */
export type PlatformStyle = {
  platform: string
  /** The user's own steer: audience, angle, words to avoid. */
  instructions: string
  /** Posts the user chose, used as few-shot examples. */
  examples: string[]
  /** OpenRouter model slug for this platform. */
  model: string
  enabled: boolean
}

/** What the caller wants written. */
export type GenerationRequest = {
  style: PlatformStyle
  /** Hard ceiling for this account — X Premium raises it, so it is per call. */
  characterLimit: number
  /**
   * Public URLs of the uploaded media. The model is shown these directly, so
   * a caption can describe what is actually in the infographic.
   */
  imageUrls: string[]
  /** Optional steer for this one post, on top of the stored instructions. */
  brief?: string
}

export type GeneratedCaption = {
  platform: string
  text: string
  model: string
  promptTokens?: number
  completionTokens?: number
}

/** Raised when OpenRouter itself refuses or is unreachable. */
export class GenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerationError'
  }
}
