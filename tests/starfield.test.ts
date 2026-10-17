import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  clamp,
  remap,
  smoothstep,
  easeInOutCubic,
  wrapDepth,
  lensOffset,
  threadProgress,
} from '../lib/landing/starfield'

describe('wrapDepth — the endless flight', () => {
  test('always lands inside [0, depth), forwards and backwards', () => {
    for (const camera of [-5000, -1, 0, 1, 999, 1000, 123456.7]) {
      for (const z of [0, 1, 500, 999.9]) {
        const d = wrapDepth(z, camera, 1000)
        assert.ok(d >= 0 && d < 1000, `z=${z} camera=${camera} gave ${d}`)
      }
    }
  })

  test('moving the camera forward brings a star closer', () => {
    assert.ok(wrapDepth(600, 100, 1000) < wrapDepth(600, 0, 1000))
  })

  test('a star that passes the camera reappears at the far plane', () => {
    assert.equal(wrapDepth(100, 101, 1000), 999)
  })
})

describe('lensOffset — stars parting around the cursor', () => {
  test('leaves stars outside the radius alone', () => {
    assert.deepEqual(lensOffset(300, 0, 0, 0, 200, 40), [0, 0, 0])
  })

  test('falls to zero at the edge, so nothing jumps as it crosses', () => {
    const [dx, dy] = lensOffset(199.999, 0, 0, 0, 200, 40)
    assert.ok(Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6)
  })

  test('pushes outward, harder the closer the star is', () => {
    const [nearX] = lensOffset(20, 0, 0, 0, 200, 40)
    const [farX] = lensOffset(150, 0, 0, 0, 200, 40)
    const [leftX] = lensOffset(-20, 0, 0, 0, 200, 40)
    assert.ok(nearX > farX && farX > 0)
    assert.ok(leftX < 0)
  })

  test('never pushes further than maxPush', () => {
    const [dx, dy] = lensOffset(0.01, 0.01, 0, 0, 200, 40)
    assert.ok(Math.hypot(dx, dy) <= 40)
  })

  test('is inert at the exact centre rather than dividing by zero', () => {
    assert.deepEqual(lensOffset(5, 5, 5, 5, 200, 40), [0, 0, 0])
  })
})

describe('threadProgress — the constellation drawing out', () => {
  test('every thread starts at 0 and finishes at 1', () => {
    for (let i = 0; i < 6; i++) {
      assert.equal(threadProgress(0, i, 6), 0)
      assert.equal(threadProgress(1, i, 6), 1)
    }
  })

  test('threads start in order', () => {
    const at = 0.3
    const values = Array.from({ length: 6 }, (_, i) => threadProgress(at, i, 6))
    for (let i = 1; i < values.length; i++) assert.ok(values[i] <= values[i - 1])
  })

  test('is monotonic in section progress', () => {
    let prev = -1
    for (let sp = 0; sp <= 1.0001; sp += 0.05) {
      const v = threadProgress(sp, 3, 6)
      assert.ok(v >= prev)
      prev = v
    }
  })

  test('a single thread uses the span alone', () => {
    assert.equal(threadProgress(0.25, 0, 1, 0.5), 0.5)
  })
})

describe('easing helpers', () => {
  test('clamp, remap and smoothstep stay in range and accept reversed bounds', () => {
    assert.equal(clamp(2), 1)
    assert.equal(clamp(-1), 0)
    assert.equal(remap(600, 1000, 600), 1)
    assert.equal(remap(1000, 1000, 600), 0)
    assert.equal(smoothstep(0, 10, 5), 0.5)
  })

  test('easeInOutCubic is pinned at both ends and symmetric', () => {
    assert.equal(easeInOutCubic(0), 0)
    assert.equal(easeInOutCubic(1), 1)
    assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9)
  })
})
