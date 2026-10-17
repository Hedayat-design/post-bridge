'use client'

import { useEffect, useRef } from 'react'
import { clamp, easeInOutCubic, remap, smoothstep } from '@/lib/landing/starfield'
import { Lens, Point, SCROLL_TO_Z, rand } from '@/components/landing/scene/config'
import { drawDust, drawFlight, drawLensRing, seedSky } from '@/components/landing/scene/sky'
import { drawConstellation, drawPost, drawTrail, postPosition, readPlatforms } from '@/components/landing/scene/story'
import { Burst, Meteor, createMeteor, drawBursts, drawMeteors } from '@/components/landing/scene/meteors'
import { photoStyle } from '@/components/landing/scene/photo'
import { attachInput, createInput } from '@/components/landing/scene/input'
import { observeReveals } from '@/components/landing/scene/reveals'

/**
 * The landing page's sky — the one client island on an otherwise static page.
 *
 * This file only wires the parts together; each lives in its own module:
 *
 *   config.ts   depth, perspective, colours
 *   sky.ts      dust (far field), lens ring, the 3D flight
 *   story.ts    the gold post star, its trail, threads, platform stars
 *   meteors.ts  shooting stars and click bursts
 *   photo.ts    the Milky Way photograph's motion
 *   input.ts    pointer, tilt, gyroscope, clicks, hover
 *   reveals.ts  fading [data-reveal] content in
 *
 * It reads positions from the sections' data-* hooks (data-anchor,
 * data-constellation, data-platform-star, data-warp, data-read) rather than
 * owning the layout, so copy can change without touching the animation. One
 * requestAnimationFrame loop writes to the canvas and a few CSS variables —
 * never React state — so scrolling never re-renders the tree.
 */
export function SpaceScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvasNode = canvasRef.current
    const photoNode = photoRef.current
    const context = canvasNode?.getContext('2d')
    const pageNode = canvasNode?.closest<HTMLElement>('.space-page')
    if (!canvasNode || !photoNode || !context || !pageNode) return
    const canvas: HTMLCanvasElement = canvasNode
    const photo: HTMLDivElement = photoNode
    const ctx: CanvasRenderingContext2D = context
    const page: HTMLElement = pageNode

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches

    // ---- what the sections expose ----
    const heroAnchor = page.querySelector('[data-anchor="hero"]')
    const centreAnchor = page.querySelector('[data-anchor="centre"]')
    const constellation = page.querySelector<HTMLElement>('[data-constellation]')
    const platforms = readPlatforms(page)
    const warps = Array.from(page.querySelectorAll<HTMLElement>('[data-warp]')).map((el) => ({
      el,
      strength: Number(el.dataset.warp) || 1,
      above: null as boolean | null,
    }))
    const readEls = Array.from(page.querySelectorAll<HTMLElement>('[data-read]'))

    // ---- state ----
    let w = 0
    let h = 0
    const sky = seedSky(window.innerWidth * window.innerHeight)
    const input = createInput()
    let lensStrength = 0
    let tiltX = 0
    let tiltY = 0

    let camZ = window.scrollY * SCROLL_TO_Z
    let drift = 0
    let warpOffset = 0
    let warpVel = 0
    let prevZ = camZ
    let lastScrollY = window.scrollY

    const meteors: Meteor[] = []
    const bursts: Burst[] = []
    let nextAmbient = performance.now() + rand(5000, 9000)
    const trail: Point[] = []
    const born = performance.now()
    let raf = 0
    let last = performance.now()

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      requestFrame()
    }

    function ignite(x: number, y: number, ambient: boolean) {
      const now = performance.now()
      meteors.push(createMeteor(x, y, ambient, now))
      if (!ambient) bursts.push({ x, y, born: now })
      requestFrame()
    }

    function frame(now: number) {
      raf = 0
      const dt = Math.min(now - last, 50) / 16.667 // in 60fps frames
      last = now
      const t = (now - born) / 1000
      const scrollY = window.scrollY
      const progress = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - h))

      // ---- reads: every layout read before any write ----
      const hero = centreOf(heroAnchor)
      const centre = centreOf(centreAnchor)
      const box = constellation?.getBoundingClientRect()
      const targets = platforms.map((p) => centreOf(p.el))
      const warpTops = warps.map((s) => s.el.getBoundingClientRect().top)
      const readRects = readEls.map((el) => el.getBoundingClientRect())

      // ---- camera: follows the scroll, drifts when idle, warps at sections ----
      if (!still) {
        camZ += (scrollY * SCROLL_TO_Z - camZ) * Math.min(1, 0.085 * dt)
        drift += 0.14 * dt
        warpOffset += warpVel * dt
        warpVel *= Math.pow(0.93, dt)
      }
      const z = camZ + drift + warpOffset
      const velocity = (z - prevZ) / Math.max(dt, 0.001)
      prevZ = z
      const scrollDir = Math.sign(scrollY - lastScrollY)
      lastScrollY = scrollY

      // A section crossing 60% of the viewport kicks the camera into a short
      // warp: forwards on the way down, backwards on the way back up.
      warps.forEach((s, i) => {
        const above = warpTops[i] < h * 0.6
        if (s.above !== null && above !== s.above && !still) {
          warpVel += (scrollDir >= 0 ? 1 : -1) * 9 * s.strength
        }
        s.above = above
      })

      // ---- pointer, lens, tilt ----
      const p = input.pointer
      const idle = now - p.lastMove > 2600
      const lensTarget = !still && !coarse && p.inside && !idle ? 1 : 0
      lensStrength += (lensTarget - lensStrength) * Math.min(1, 0.06 * dt)
      if (p.sx >= 0) {
        p.sx += (p.x - p.sx) * Math.min(1, 0.14 * dt)
        p.sy += (p.y - p.sy) * Math.min(1, 0.14 * dt)
      }
      if (!still) {
        tiltX += (input.tiltTargetX - tiltX) * Math.min(1, 0.045 * dt)
        tiltY += (input.tiltTargetY - tiltY) * Math.min(1, 0.045 * dt)
      }
      const radius = Math.min(w, h) * 0.24
      const lens: Lens = { x: p.sx, y: p.sy, radius, push: radius * 0.3 * lensStrength, strength: lensStrength }
      const view = { w, h, t, still, tiltX, tiltY }

      // ---- draw, back to front ----
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      drawDust(ctx, sky.dust, view, scrollY, lens)
      drawLensRing(ctx, lens)
      drawFlight(ctx, sky.stars, view, z, velocity, lens)

      // The post star: from the hero to the constellation's centre as you scroll.
      const reach = centre ? centre.y + scrollY - h * 0.5 : 0
      const travel = still ? 0 : easeInOutCubic(remap(scrollY, h * 0.06, Math.max(h * 0.2, reach)))
      const intro = still ? 1 : easeInOutCubic(remap(t, 0.15, 1.6))
      const post = hero && centre ? postPosition(hero, centre, travel, w) : null

      // Constellation progress: 0 as it rises into view, 1 once its middle is
      // a little above the centre of the screen.
      const sp = box ? remap(box.top + box.height / 2, h * 0.95, h * 0.42) : 0
      const arrived = still ? 1 : smoothstep(0.8, 1, travel)
      const origin = still ? centre : post
      if (origin && box && box.bottom > -120 && box.top < h + 120) {
        drawConstellation(ctx, platforms, targets, origin, sp, arrived, input.hovered, { t, dt, still })
      }

      // The post itself, drawn last so it sits over its own threads.
      if (still) {
        // No travel without motion: the post simply sits in both places.
        if (hero) drawPost(ctx, hero, 1, w, t, still)
        if (centre) drawPost(ctx, centre, 1.1, w, t, still)
      } else if (post) {
        drawTrail(ctx, trail, post, travel > 0.001 && travel < 0.999)
        if (intro > 0) {
          // Ignites on load: a brief flare, then settles to its resting size.
          const flash = intro < 1 ? 1 + Math.sin(intro * Math.PI) * 0.9 : 1
          drawPost(ctx, post, intro * flash * (1 + arrived * 0.12), w, t, still)
        }
      }

      if (!still && now > nextAmbient) {
        ignite(rand(w * 0.15, w * 0.95), rand(h * 0.04, h * 0.4), true)
        nextAmbient = now + rand(7000, 15000)
      }
      drawMeteors(ctx, meteors, now)
      drawBursts(ctx, bursts, now)

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      // ---- writes ----
      if (!still) {
        const style = photoStyle(progress, tiltX, tiltY, warpVel)
        photo.style.transform = style.transform
        photo.style.opacity = style.opacity
      }
      // Platform labels fade in with their star; written only when changed.
      for (const platform of platforms) {
        const arrive = Math.round(platform.lit * 50) / 50
        if (arrive !== platform.arrive) {
          platform.arrive = arrive
          platform.el.style.setProperty('--arrive', String(arrive))
        }
      }
      // Scroll-read statements: each word brightens as you pass it.
      readEls.forEach((el, i) => {
        const r = readRects[i]
        const read = still ? 1 : remap(r.top + r.height * 0.5, h * 0.9, h * 0.35)
        el.style.setProperty('--read', read.toFixed(3))
      })

      if (!still) raf = requestAnimationFrame(frame)
    }

    function requestFrame() {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const stopReveals = observeReveals(page)
    const detachInput = attachInput(page, input, {
      still,
      size: () => ({ w, h }),
      onIgnite: (x, y) => ignite(x, y, false),
    })
    resize()
    window.addEventListener('resize', resize)
    if (still) window.addEventListener('scroll', requestFrame, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      stopReveals()
      detachInput()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', requestFrame)
    }
  }, [])

  return (
    <>
      <div ref={photoRef} aria-hidden className="space-photo" />
      <div aria-hidden className="space-vignette" />
      <canvas ref={canvasRef} aria-hidden className="space-canvas" />
    </>
  )
}

function centreOf(el: Element | null): Point | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
