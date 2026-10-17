import { clamp, smoothstep } from '@/lib/landing/starfield'
import { CHAMPAGNE, IVORY, rand } from '@/components/landing/scene/config'

/** Shooting stars — on click and, now and then, on their own. */

export type Meteor = { x: number; y: number; vx: number; vy: number; born: number; life: number; bright: number }
export type Burst = { x: number; y: number; born: number }

/**
 * A meteor starting at (x, y). Mostly parallel to the galaxy's band, so it
 * reads as part of the sky rather than as a cursor effect. Ambient ones are
 * slower and dimmer than the ones a click lights.
 */
export function createMeteor(x: number, y: number, ambient: boolean, now: number): Meteor {
  const angle = ((Math.random() < 0.6 ? 150 : 32) + rand(-12, 12)) * (Math.PI / 180)
  const speed = ambient ? rand(700, 950) : rand(1000, 1300)
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    born: now,
    life: ambient ? rand(0.7, 1) : rand(0.85, 1.15),
    bright: ambient ? 0.55 : 1,
  }
}

/** Draws every live meteor and drops the burnt-out ones from the array. */
export function drawMeteors(ctx: CanvasRenderingContext2D, meteors: Meteor[], now: number) {
  for (let i = meteors.length - 1; i >= 0; i--) {
    const s = meteors[i]
    const age = (now - s.born) / 1000
    const life = age / s.life
    if (life >= 1) {
      meteors.splice(i, 1)
      continue
    }
    const travelled = 1 - Math.pow(1 - life, 1.6) // decelerates as it burns out
    const hx = s.x + s.vx * s.life * travelled * 0.75
    const hy = s.y + s.vy * s.life * travelled * 0.75
    const speed = Math.hypot(s.vx, s.vy)
    const tailLen = Math.min(age * speed, 230) * (1 - life * 0.6)
    const tx = hx - (s.vx / speed) * tailLen
    const ty = hy - (s.vy / speed) * tailLen
    const a = clamp(life / 0.08) * (1 - smoothstep(0.55, 1, life)) * s.bright
    const g = ctx.createLinearGradient(tx, ty, hx, hy)
    g.addColorStop(0, `rgba(${IVORY},0)`)
    g.addColorStop(0.7, `rgba(${CHAMPAGNE},${0.35 * a})`)
    g.addColorStop(1, `rgba(255,252,244,${a})`)
    ctx.globalAlpha = 1
    ctx.strokeStyle = g
    ctx.lineWidth = 1.7
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(hx, hy)
    ctx.stroke()
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 6)
    hg.addColorStop(0, `rgba(255,252,244,${a})`)
    hg.addColorStop(1, `rgba(${CHAMPAGNE},0)`)
    ctx.fillStyle = hg
    ctx.beginPath()
    ctx.arc(hx, hy, 6, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** The ring and sparks where a click lit a meteor; drops finished ones. */
export function drawBursts(ctx: CanvasRenderingContext2D, bursts: Burst[], now: number) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]
    const life = (now - b.born) / 600
    if (life >= 1) {
      bursts.splice(i, 1)
      continue
    }
    const eased = 1 - Math.pow(1 - life, 3)
    ctx.strokeStyle = `rgb(${CHAMPAGNE})`
    ctx.lineWidth = 1
    ctx.globalAlpha = (1 - life) * 0.55
    ctx.beginPath()
    ctx.arc(b.x, b.y, 4 + eased * 34, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = (1 - life) * 0.7
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2 + 0.3
      const r0 = 4 + eased * 14
      const r1 = 4 + eased * 26
      ctx.beginPath()
      ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0)
      ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1)
      ctx.stroke()
    }
  }
}
