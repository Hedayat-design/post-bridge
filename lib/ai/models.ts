/**
 * Model constants safe to import from the browser.
 *
 * Deliberately separate from openrouter.ts: that module reads
 * OPENROUTER_API_KEY and builds the request, and a client component importing
 * it would pull server-only code into the browser bundle. This file holds
 * nothing but values the styles form needs to show.
 */

/**
 * Used when a platform's style leaves the model blank.
 *
 * Must accept images — the caption is written from the uploaded graphic, so a
 * text-only model makes the feature pointless. Verified against OpenRouter's
 * /models listing and with a real call, not guessed.
 *
 * The `:free` variant of this model exists but is gated: OpenRouter answers
 * "only available on agentic harnesses", so a normal web app cannot use it.
 * This is the same model on the paid tier, around $0.003 a caption.
 */
export const DEFAULT_MODEL = 'thinkingmachines/inkling'
