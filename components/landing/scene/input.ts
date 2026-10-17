import { clamp } from '@/lib/landing/starfield'

/**
 * Everything the visitor does to the sky: the cursor (gravity lens and
 * tilt), the phone's gyroscope (tilt), clicks (meteors) and hovering a
 * platform star (highlight). Handlers only record; the frame loop reads.
 */

export type InputState = {
  pointer: { x: number; y: number; sx: number; sy: number; inside: boolean; lastMove: number }
  /** Where the tilt is heading, -1…1 on each axis; the frame eases toward it. */
  tiltTargetX: number
  tiltTargetY: number
  /** The data-platform-star key under the cursor or keyboard focus. */
  hovered: string | null
}

export function createInput(): InputState {
  return {
    pointer: { x: -1, y: -1, sx: -1, sy: -1, inside: false, lastMove: 0 },
    tiltTargetX: 0,
    tiltTargetY: 0,
    hovered: null,
  }
}

function starFrom(node: EventTarget | null) {
  return node instanceof Element ? node.closest<HTMLElement>('[data-platform-star]')?.dataset.platformStar ?? null : null
}

/** Wires the listeners and returns the function that removes them. */
export function attachInput(
  page: HTMLElement,
  input: InputState,
  options: { still: boolean; size: () => { w: number; h: number }; onIgnite: (x: number, y: number) => void }
) {
  const { still, size, onIgnite } = options

  function onPointerMove(e: PointerEvent) {
    const p = input.pointer
    p.x = e.clientX
    p.y = e.clientY
    if (p.sx < 0) {
      p.sx = e.clientX
      p.sy = e.clientY
    }
    p.inside = true
    p.lastMove = performance.now()
    if (e.pointerType === 'mouse') {
      const { w, h } = size()
      input.tiltTargetX = (e.clientX / w - 0.5) * 2
      input.tiltTargetY = (e.clientY / h - 0.5) * 2
    }
  }

  function onMouseOut(e: MouseEvent) {
    if (e.relatedTarget) return // still inside the window
    input.pointer.inside = false
    input.tiltTargetX = 0
    input.tiltTargetY = 0
  }

  // Phones tilt the sky with the gyroscope where the browser allows it
  // without a permission prompt. iOS asks first; we would rather not.
  function onOrientation(e: DeviceOrientationEvent) {
    if (e.gamma == null || e.beta == null) return
    input.tiltTargetX = clamp(e.gamma / 30, -1, 1)
    input.tiltTargetY = clamp((e.beta - 45) / 30, -1, 1)
  }

  // Clicking the sky lights a meteor — but never steals a click meant for a
  // control, or ends someone's text selection with a firework.
  function onClick(e: MouseEvent) {
    const target = e.target as Element | null
    if (target?.closest('a, button, input, textarea, select, label, summary')) return
    if (window.getSelection()?.toString()) return
    onIgnite(e.clientX, e.clientY)
  }

  const onOver = (e: Event) => (input.hovered = starFrom(e.target))
  const onOut = (e: MouseEvent) => (input.hovered = starFrom(e.relatedTarget))
  const onBlur = () => (input.hovered = null)

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('mouseout', onMouseOut)
  page.addEventListener('pointerover', onOver)
  page.addEventListener('pointerout', onOut)
  page.addEventListener('focusin', onOver)
  page.addEventListener('focusout', onBlur)
  if (!still) {
    window.addEventListener('click', onClick)
    window.addEventListener('deviceorientation', onOrientation)
  }

  return () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('mouseout', onMouseOut)
    page.removeEventListener('pointerover', onOver)
    page.removeEventListener('pointerout', onOut)
    page.removeEventListener('focusin', onOver)
    page.removeEventListener('focusout', onBlur)
    window.removeEventListener('click', onClick)
    window.removeEventListener('deviceorientation', onOrientation)
  }
}
