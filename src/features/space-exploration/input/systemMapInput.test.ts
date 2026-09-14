import assert from 'node:assert/strict'
import test from 'node:test'
import { SystemMapInput } from './systemMapInput'

test('small movement is a tap and a second nearby tap is a double tap', () => {
  const input = new SystemMapInput()
  input.pointerDown({ id: 1, x: 10, y: 10 })
  assert.deepEqual(input.pointerMove({ id: 1, x: 12, y: 11 }), [])
  assert.deepEqual(input.pointerUp({ id: 1, x: 12, y: 11 }), [{ type: 'tap', x: 12, y: 11 }])
  input.pointerDown({ id: 1, x: 13, y: 12 })
  assert.equal(input.pointerUp({ id: 1, x: 13, y: 12 })[0]?.type, 'doubletap')
})

test('drag beyond the threshold orbits and wheel zooms', () => {
  const input = new SystemMapInput()
  input.pointerDown({ id: 1, x: 0, y: 0 })
  const drag = input.pointerMove({ id: 1, x: 20, y: 4 })
  assert.deepEqual(drag, [{ type: 'orbit', dx: 20, dy: 4 }])
  assert.deepEqual(input.pointerUp({ id: 1, x: 20, y: 4 }), [])
  assert.deepEqual(input.wheel(120), [{ type: 'zoom', deltaY: 120 }])
})

test('ctrl plus left drag pans instead of orbiting', () => {
  const input = new SystemMapInput()
  input.pointerDown({ id: 1, x: 20, y: 20, pan: true })
  assert.deepEqual(
    input.pointerMove({ id: 1, x: 44, y: 32, pan: true }),
    [{ type: 'pan', dx: 24, dy: 12 }]
  )
})

test('disabled input ignores further gestures after clear', () => {
  const input = new SystemMapInput()
  input.pointerDown({ id: 1, x: 0, y: 0 })
  input.setEnabled(false)
  assert.deepEqual(input.pointerMove({ id: 1, x: 40, y: 0 }), [])
  assert.deepEqual(input.wheel(-80), [])
  input.setEnabled(true)
  assert.deepEqual(input.wheel(-80), [{ type: 'zoom', deltaY: -80 }])
})

test('slow one-pixel events accumulate into a drag with the same total displacement as a fast drag', () => {
  for (const pan of [false, true]) {
    const input = new SystemMapInput()
    input.pointerDown({ id: 1, x: 0, y: 0, pan })
    let total = 0
    for (let x = 1; x <= 40; x++) {
      for (const gesture of input.pointerMove({ id: 1, x, y: 0, pan })) {
        assert.equal(gesture.type, pan ? 'pan' : 'orbit')
        if (gesture.type === 'pan' || gesture.type === 'orbit') total += gesture.dx
      }
    }
    assert.equal(total, 40)
    assert.deepEqual(input.pointerUp({ id: 1, x: 40, y: 0 }), [])
  }
})

test('small jitter remains a tap, and clear removes the previous drag origin', () => {
  const input = new SystemMapInput()
  input.pointerDown({ id: 1, x: 0, y: 0 })
  for (const x of [1, 2, 1, 0, -1, -2, 0]) assert.deepEqual(input.pointerMove({ id: 1, x, y: 0 }), [])
  assert.equal(input.pointerUp({ id: 1, x: 0, y: 0 })[0]?.type, 'tap')
  input.clear(); input.pointerDown({ id: 2, x: 100, y: 100 })
  assert.deepEqual(input.pointerMove({ id: 2, x: 101, y: 100 }), [])
})
