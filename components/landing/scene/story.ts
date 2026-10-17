import { clamp, easeInOutCubic, smoothstep, threadProgress } from '@/lib/landing/starfield'
import { CHAMPAGNE, GOLD, IVORY, Point } from '@/components/landing/scene/config'

/**
 * The story the sky tells: one gold star — the visitor's post — that travels
 * from the hero to the constellation and threads out to every platform.
 */

/** One platform star, as read from a [data-platform-star] element. */
export type PlatformState = {
  el: HTMLElement
  key: string
  live: boolean
  /** Brightness kick when a delivery pulse lands; decays each frame. */
  flare: number
  /** How lit the star is (0–1) this frame; drives its label's --arrive. */
  lit: number
  /** Last --arrive written, so the DOM is only touched when it changes. */
  arrive: number
}

export function readPlatforms(page: HTMLElement): PlatformState[] {
  const platforms = Array.from(page.querySelectorAll<HTMLElement>('[data-platform-star]')).map((el) => ({
    el,
    key: el.dataset.platformStar ?? '',
    live: el.dataset.live === 'true',
    flare: 0,
    lit: 0,
    arrive: -1,
  }))
  // Live threads draw first: the honest order is the one that ships today.
  return platforms.sort((a, b) => Number(b.live) - Number(a.live))
}

/**
 * Where the post star is, `travel` (0–1) of the way from hero to centre. A
 * gentle arc rather than a straight drop: it reads as a body moving through
 * space, not an element being tweened.
 */
export function postPosition(hero: Point, centre: Point, travel: number, w: number): Point {
  const arc = Math.sin(travel * Math.PI) * Math.min(w * 0.12, 140)
  return {
    x: hero.x + (centre.x - hero.x) * travel + arc,
    y: hero.y + (centre.y - hero.y) * travel,
  }
}

type Frame = { t: number; dt: number; still: boolean }

/**
 * Threads from the post to each platform, delivery pulses on the live ones,
 * the platform stars themselves, and — once all have landed — the figure that
 * joins them. `sp` is the section's scroll progress; `arrived` how settled
 * the post star is at the centre.
 */
export function drawConstellation(
  ctx: CanvasRenderingContext2D,
  platforms: PlatformState[],
  targets: (Point | null)[],
  origin: Point,
  sp: number,
  arrived: number,
  hovered: string | null,
  { t, dt, still }: Frame
) {
  platforms.forEach((p, i) => {
    const target = targets[i]
    if (!target) return
    const prog = still ? 1 : threadProgress(sp, i, platforms.length, 0.55) * arrived
    const isHover = hovered === p.key

    if (prog > 0.001) drawThread(ctx, origin, target, prog, p.live, isHover)
    if (p.live && prog >= 1 && !still) {
      if (drawPulse(ctx, origin, target, t, dt, i)) p.flare = 1
    }
    p.flare *= Math.pow(0.93, dt)

    p.lit = smoothstep(0.82, 1, prog)
    if (p.lit > 0.01) drawPlatformStar(ctx, target, p, isHover, t)
  })

  const figure = still ? 1 : smoothstep(0.85, 1, sp) * arrived
  if (figure > 0.01) drawFigure(ctx, targets, origin, figure)
}

function drawThread(ctx: CanvasRenderingContext2D, from: Point, to: Point, prog: number, live: boolean, hover: boolean) {
  const ex = from.x + (to.x - from.x) * prog
  const ey = from.y + (to.y - from.y) * prog
  if (live) {
    // A wide faint stroke under a fine bright one reads as light; a single
    // stroke reads as a line on a diagram.
    ctx.globalAlpha = hover ? 0.22 : 0.1
    ctx.strokeStyle = `rgb(${GOLD})`
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    const g = ctx.createLinearGradient(from.x, from.y, ex, ey)
    g.addColorStop(0, `rgba(${CHAMPAGNE},0.95)`)
    g.addColorStop(1, `rgba(${IVORY},${hover ? 1 : 0.75})`)
    ctx.globalAlpha = 1
    ctx.strokeStyle = g
    ctx.lineWidth = hover ? 1.8 : 1.2
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  } else {
    // Not live yet, and the drawing says so: dashed, pale, no pulse.
    ctx.globalAlpha = hover ? 0.7 : 0.38
    ctx.strokeStyle = `rgb(${IVORY})`
    ctx.lineWidth = 1
    ctx.setLineDash([2, 7])
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

/** A pulse of light down a live thread: the post, delivered. True when it lands. */
function drawPulse(ctx: CanvasRenderingContext2D, from: Point, to: Point, t: number, dt: number, i: number) {
  const phase = (t / 2.4 + i * 0.37) % 1
  const prevPhase = ((t - dt / 60) / 2.4 + i * 0.37) % 1
  const head = easeInOutCubic(phase)
  const tail = Math.max(0, head - 0.08)
  const hx = from.x + (to.x - from.x) * head
  const hy = from.y + (to.y - from.y) * head
  const tx = from.x + (to.x - from.x) * tail
  const ty = from.y + (to.y - from.y) * tail
  const g = ctx.createLinearGradient(tx, ty, hx, hy)
  g.addColorStop(0, `rgba(${CHAMPAGNE},0)`)
  g.addColorStop(1, `rgba(${IVORY},0.95)`)
  ctx.globalAlpha = 1
  ctx.strokeStyle = g
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(tx, ty)
  ctx.lineTo(hx, hy)
  ctx.stroke()
  return phase < prevPhase
}

function drawPlatformStar(ctx: CanvasRenderingContext2D, at: Point, p: PlatformState, hover: boolean, t: number) {
  const energy = (p.live ? 1 : 0.55) * p.lit * (1 + p.flare * 0.9 + (hover ? 0.8 : 0))
  const glowR = (p.live ? 18 : 10) * (1 + p.flare * 0.5 + (hover ? 0.5 : 0))
  const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, glowR)
  g.addColorStop(0, `rgba(${p.live ? CHAMPAGNE : IVORY},${0.55 * energy})`)
  g.addColorStop(1, `rgba(${p.live ? GOLD : IVORY},0)`)
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(at.x, at.y, glowR, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgb(${IVORY})`
  ctx.globalAlpha = clamp(energy)
  ctx.beginPath()
  ctx.arc(at.x, at.y, p.live ? 2.6 : 1.8, 0, Math.PI * 2)
  ctx.fill()
  if (hover) {
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = `rgb(${CHAMPAGNE})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(at.x, at.y, 15 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** Once every thread has landed, the platforms join into a figure. */
function drawFigure(ctx: CanvasRenderingContext2D, targets: (Point | null)[], origin: Point, figure: number) {
  const ring: (Point & { a: number })[] = []
  for (const target of targets) {
    if (target) ring.push({ ...target, a: Math.atan2(target.y - origin.y, target.x - origin.x) })
  }
  ring.sort((a, b) => a.a - b.a)
  ctx.globalAlpha = 0.13 * figure
  ctx.strokeStyle = `rgb(${IVORY})`
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ring.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)))
  ctx.closePath()
  ctx.stroke()
}

/** The post itself: glow, slowly turning diffraction spikes, bright core. */
export function drawPost(ctx: CanvasRenderingContext2D, at: Point, scale: number, w: number, t: number, still: boolean) {
  const { x, y } = at
  const R = clamp(w * 0.0055, 4, 7) * scale
  const breath = still ? 1 : 1 + Math.sin(t * 1.7) * 0.07
  let g = ctx.createRadialGradient(x, y, 0, x, y, R * 10 * breath)
  g.addColorStop(0, `rgba(${CHAMPAGNE},0.42)`)
  g.addColorStop(0.35, `rgba(${GOLD},0.12)`)
  g.addColorStop(1, `rgba(${GOLD},0)`)
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, R * 10 * breath, 0, Math.PI * 2)
  ctx.fill()

  // Diffraction spikes, turning very slowly: the detail that makes it a star
  // seen through glass rather than a dot.
  const spin = still ? 0 : t * 0.08
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0
    const a = spin + (i * Math.PI) / 4
    const len = R * (long ? 7.5 : 3.6) * breath
    const ex = x + Math.cos(a) * len
    const ey = y + Math.sin(a) * len
    const sg = ctx.createLinearGradient(x, y, ex, ey)
    sg.addColorStop(0, `rgba(${IVORY},${long ? 0.85 : 0.5})`)
    sg.addColorStop(1, `rgba(${CHAMPAGNE},0)`)
    ctx.strokeStyle = sg
    ctx.lineWidth = long ? 1.3 : 0.9
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }

  g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.4)
  g.addColorStop(0, 'rgba(255,252,244,1)')
  g.addColorStop(0.45, `rgba(${CHAMPAGNE},0.9)`)
  g.addColorStop(1, `rgba(${GOLD},0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, R * 2.4, 0, Math.PI * 2)
  ctx.fill()
}

/** A faint wake behind the travelling post, shrinking away once it settles. */
export function drawTrail(ctx: CanvasRenderingContext2D, trail: Point[], post: Point, moving: boolean) {
  trail.push(post)
  if (trail.length > 26 || (!moving && trail.length)) trail.shift()
  for (let i = 1; i < trail.length; i++) {
    ctx.globalAlpha = (i / trail.length) * 0.35
    ctx.strokeStyle = `rgb(${CHAMPAGNE})`
    ctx.lineWidth = (i / trail.length) * 3
    ctx.beginPath()
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y)
    ctx.lineTo(trail[i].x, trail[i].y)
    ctx.stroke()
  }
}
