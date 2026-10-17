import { clamp, smoothstep } from '@/lib/landing/starfield'

/**
 * The Milky Way photograph is the farthest layer: it barely tilts, turns a
 * few degrees over the whole page, leans in as you near the end, and dims
 * behind the long copy, where reading matters more than sky.
 *
 * Pure: returns the styles; the scene writes them.
 */
export function photoStyle(progress: number, tiltX: number, tiltY: number, warpVel: number) {
  const warpEnergy = clamp(Math.abs(warpVel) / 30)
  const scale = 1.1 + progress * 0.22 + warpEnergy * 0.05
  const rotate = -6 + progress * 12
  return {
    transform: `translate3d(${(-tiltX * 10).toFixed(2)}px, ${(-tiltY * 8 - progress * 50).toFixed(2)}px, 0) rotate(${rotate.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
    opacity: (0.8 - 0.18 * smoothstep(0.12, 0.4, progress) + 0.15 * smoothstep(0.78, 1, progress)).toFixed(3),
  }
}
