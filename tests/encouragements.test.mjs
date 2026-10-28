import test from 'node:test'
import assert from 'node:assert/strict'
import { drawEncouragement, encouragements } from '../src/encouragements.js'

test('each reader gets a shuffled deck with no repeats across a whole round', () => {
  const messages = []
  let raw = null
  for (let i = 0; i < encouragements.length; i++) {
    const drawn = drawEncouragement(raw)
    messages.push(drawn.message)
    raw = JSON.stringify(drawn.state)
  }
  assert.equal(new Set(messages).size, encouragements.length)
  assert.notEqual(drawEncouragement(raw).message, messages.at(-1))
  assert.notEqual(drawEncouragement(null, () => 0).message, drawEncouragement(null, () => 0.999).message)
})

test('reload continues the saved deck; invalid saved decks recover safely', () => {
  const first = drawEncouragement(null, () => 0)
  const next = drawEncouragement(JSON.stringify(first.state), () => { throw Error('must not reshuffle a saved deck') })
  assert.notEqual(first.message, next.message)
  for (const raw of ['broken', '{}', '{"version":2,"remaining":[-1]}', '{"version":2,"remaining":[0,0]}']) {
    assert.ok(encouragements.includes(drawEncouragement(raw).message))
  }
})

test('a new round never repeats the preceding last message even with the same shuffle', () => {
  const first = drawEncouragement(null, () => 0)
  const empty = JSON.stringify({ ...first.state, remaining: [] })
  assert.notEqual(drawEncouragement(empty, () => 0).message, first.message)
})
