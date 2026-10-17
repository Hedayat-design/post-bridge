import { clamp, lensOffset, smoothstep, wrapDepth } from '@/lib/landing/starfield'
import { CHAMPAGNE, DEPTH, FOCAL, IVORY, Lens, STAR_COLOURS, rand } from '@/components/landing/scene/config'

/**
 * The two star layers: a far, flat field of "dust" that only tilts and
 * drifts, and a near 3D field the camera flies through as you scroll.
 */

export type Star = { x: number; y: number; z: number; r: number; c: number; tw: number; ph: number }
export type Dust = { x: number; y: number; r: number; p: number; c: number; tw: number; ph: number }

function pickColour() {
  const roll = Math.random()
  return roll < 0.7 ? 0 : roll < 0.92 ? 1 : 2
}

/** Seeded in normalised space, so a resize never reshuffles the sky. */
export function seedSky(area: number) {
  const stars: Star[] = Array.from({ length: Math.round(clamp(area / 2600, 180, 520)) }, () => ({
    x: rand(-1, 1),
    y: rand(-1, 1),
    z: rand(0, DEPTH),
    r: rand(0.55, 1.6),
    c: pickColour(),
    tw: rand(0.6, 2.2),
    ph: rand(0, Math.PI * 2),
  }))
  const dust: Dust[] = Array.from({ length: Math.round(clamp(area / 1400, 300, 1100)) }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() < 0.92 ? rand(0.35, 0.8) : rand(0.8, 1.3),
    p: rand(0.2, 1),
    c: Math.random() < 0.85 ? 0 : 1,
    tw: rand(0.4, 1.8),
    ph: rand(0, Math.PI * 2),
  }))
  // Grouped by colour so the draw loops set fillStyle once per group.
  stars.sort((a, b) => a.c - b.c)
  dust.sort((a, b) => a.c - b.c)
  return { stars, dust }
}

type View = { w: number; h: number; t: number; still: boolean; tiltX: number; tiltY: number }

/** The far field: moves only with tilt and a slow scroll drift. */
export function drawDust(ctx: CanvasRenderingContext2D, dust: Dust[], view: View, scrollY: number, lens: Lens) {
  const { w, h, t, still, tiltX, tiltY } = view
  let colour = -1
  for (const d of dust) {
    if (d.c !== colour) {
      colour = d.c
      ctx.fillStyle = `rgb(${STAR_COLOURS[colour]})`
    }
    let x = d.x * w - tiltX * 14 * d.p
    let y = (((d.y * h - scrollY * 0.04 * d.p - tiltY * 10 * d.p) % h) + h) % h
    let glow = 0
    if (lens.strength > 0.01) {
      const [dx, dy, f] = lensOffset(x, y, lens.x, lens.y, lens.radius, lens.push * 0.7)
      x += dx
      y += dy
      glow = f * lens.strength
    }
    const twinkle = still ? 0.8 : 0.62 + 0.38 * Math.sin(t * d.tw + d.ph)
    ctx.globalAlpha = clamp((0.25 + 0.55 * d.p) * twinkle * (1 + glow * 1.4))
    const r = d.r * (1 + glow * 0.6)
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

/**
 * The lens's Einstein ring: light bunched where the push is steepest. Very
 * faint — felt as a presence under the cursor, never seen as a cursor.
 */
export function drawLensRing(ctx: CanvasRenderingContext2D, lens: Lens) {
  if (lens.strength <= 0.01) return
  const g = ctx.createRadialGradient(lens.x, lens.y, lens.radius * 0.3, lens.x, lens.y, lens.radius * 0.85)
  g.addColorStop(0, `rgba(${IVORY},0)`)
  g.addColorStop(0.45, `rgba(${CHAMPAGNE},${0.045 * lens.strength})`)
  g.addColorStop(1, `rgba(${IVORY},0)`)
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.fillRect(lens.x - lens.radius, lens.y - lens.radius, lens.radius * 2, lens.radius * 2)
}

/**
 * The flight: nearer stars larger, brighter and faster, stretched into
 * streaks as the camera speeds up. `z` is the camera depth; `velocity` its
 * change this frame, which sets the streak length.
 */
export function drawFlight(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  view: View,
  z: number,
  velocity: number,
  lens: Lens
) {
  const { w, h, t, still, tiltX, tiltY } = view
  const cx = w / 2
  const cy = h / 2
  const camX = tiltX * w * 0.05
  const camY = tiltY * h * 0.05
  const streak = clamp(velocity * 2.4, -260, 260)
  let colour = -1
  ctx.lineCap = 'round'

  for (const s of stars) {
    const rz = wrapDepth(s.z, z, DEPTH)
    if (rz < 4) continue
    const k = FOCAL / rz
    let x = cx + (s.x * w * 1.25 - camX) * k
    let y = cy + (s.y * h * 1.25 - camY) * k
    if (x < -60 || x > w + 60 || y < -60 || y > h + 60) continue

    if (s.c !== colour) {
      colour = s.c
      ctx.fillStyle = `rgb(${STAR_COLOURS[colour]})`
      ctx.strokeStyle = `rgb(${STAR_COLOURS[colour]})`
    }
    let dx = 0
    let dy = 0
    let glow = 0
    if (lens.strength > 0.01) {
      ;[dx, dy, glow] = lensOffset(x, y, lens.x, lens.y, lens.radius, lens.push)
      x += dx
      y += dy
      glow *= lens.strength
    }
    const fade = smoothstep(DEPTH, DEPTH * 0.55, rz) * smoothstep(18, 80, rz)
    const twinkle = still ? 1 : 0.82 + 0.18 * Math.sin(t * s.tw + s.ph)
    const alpha = clamp(fade * twinkle * (0.35 + 0.65 * (1 - rz / DEPTH)) * (1 + glow))
    if (alpha < 0.02) continue
    const r = clamp(s.r * Math.pow(k, 0.85) * 0.75, 0.3, 3.2)
    ctx.globalAlpha = alpha

    const prz = rz + streak
    if (Math.abs(streak) > 1.5 && prz > 4 && prz < DEPTH) {
      const pk = FOCAL / prz
      ctx.lineWidth = r * 1.6
      ctx.beginPath()
      ctx.moveTo(cx + (s.x * w * 1.25 - camX) * pk + dx, cy + (s.y * h * 1.25 - camY) * pk + dy)
      ctx.lineTo(x, y)
      ctx.stroke()
    } else if (r < 1.1) {
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    } else {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
