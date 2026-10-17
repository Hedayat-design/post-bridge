/**
 * Shared constants and types for the landing page's sky.
 *
 * Tune the feel here: how deep the star field is, how strong the perspective,
 * how far the camera travels per pixel scrolled.
 */

/** Depth of the repeating 3D star field, in world units. */
export const DEPTH = 1000
/** Perspective strength: a star at this depth is drawn at its true size. */
export const FOCAL = 380
/** How far the camera flies per pixel scrolled. */
export const SCROLL_TO_Z = 0.9

// rgb triplets, kept as strings so a fillStyle is one concatenation.
export const GOLD = '201,154,71'
export const CHAMPAGNE = '230,193,122'
export const IVORY = '245,235,221'
/** Star tints: white, blue, gold. Index is a star's `c`. */
export const STAR_COLOURS = ['236,240,255', '170,195,255', CHAMPAGNE]

export type Point = { x: number; y: number }

/** Where the cursor's "mass" is this frame, for the gravity lens. */
export type Lens = { x: number; y: number; radius: number; push: number; strength: number }

export function rand(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo)
}
