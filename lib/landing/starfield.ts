/**
 * The arithmetic behind the landing page's sky.
 *
 * Kept apart from the canvas component so it can be tested without a browser:
 * every function here is pure, and the component only feeds it numbers it has
 * read from the DOM and the pointer.
 */

export function clamp(value: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, value))
}

/**
 * Where `value` sits between `from` (0) and `to` (1), clamped. Works either
 * way round, so `remap(y, bottom, top)` reads naturally for things that count
 * up as an element rises through the viewport.
 */
export function remap(value: number, from: number, to: number): number {
  if (from === to) return value >= to ? 1 : 0
  return clamp((value - from) / (to - from))
}

export function smoothstep(from: number, to: number, value: number): number {
  const t = remap(value, from, to)
  return t * t * (3 - 2 * t)
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * Distance from the camera to a star in a field that repeats every `depth`
 * units. Flying forward (camera increasing) brings every star closer until it
 * passes the lens and reappears at the far plane, so a few hundred stars make
 * an endless flight in either scroll direction with no recycling state.
 */
export function wrapDepth(z: number, camera: number, depth: number): number {
  return (((z - camera) % depth) + depth) % depth
}

/**
 * How far a star is pushed by the cursor's "mass": outward from the cursor,
 * strongest at the centre and falling to exactly zero at `radius`, so stars
 * never jump as they cross the edge. Returns the offset and the falloff, which
 * the caller uses to brighten stars bunched up on the ring the way a real
 * gravitational lens concentrates light.
 */
export function lensOffset(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
  maxPush: number
): [dx: number, dy: number, falloff: number] {
  const dx = x - cx
  const dy = y - cy
  const d = Math.hypot(dx, dy)
  if (d >= radius || d < 1e-6 || radius <= 0) return [0, 0, 0]
  const falloff = (1 - d / radius) ** 2
  const push = maxPush * falloff
  return [(dx / d) * push, (dy / d) * push, falloff]
}

/**
 * How much of thread `index` (of `count`) is drawn at section progress `sp`.
 *
 * Threads draw one after another but overlapping, each taking `span` of the
 * section's progress, so the constellation spreads rather than appearing in
 * a single frame or in a rigid sequence.
 */
export function threadProgress(sp: number, index: number, count: number, span = 0.5): number {
  if (count <= 1) return remap(sp, 0, span)
  const start = (index / (count - 1)) * (1 - span)
  return remap(sp, start, start + span)
}
