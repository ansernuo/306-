import test from 'node:test'
import assert from 'node:assert/strict'
import { fillNavigationTarget } from '../src/fill-navigation.js'

const rows = [['first-left', 'first-right'], ['second-left', 'second-right'], ['third-only']]

test('W and E move between stems, keeping the blank column when available', () => {
  assert.equal(fillNavigationTarget(rows, 0, 'first-right', 'e'), 'second-right')
  assert.equal(fillNavigationTarget(rows, 1, 'second-right', 'w'), 'first-right')
  assert.equal(fillNavigationTarget(rows, 1, 'second-right', 'e'), 'third-only')
  assert.equal(fillNavigationTarget(rows, 2, 'third-only', 'w'), 'second-left')
})

test('A and D still move through every blank, including across stems', () => {
  assert.equal(fillNavigationTarget(rows, 0, 'first-left', 'd'), 'first-right')
  assert.equal(fillNavigationTarget(rows, 0, 'first-right', 'd'), 'second-left')
  assert.equal(fillNavigationTarget(rows, 1, 'second-left', 'a'), 'first-right')
})

test('navigation stops at the group boundaries and can enter a focused stem', () => {
  for (const key of ['a', 'w']) assert.equal(fillNavigationTarget(rows, 0, 'first-left', key), 'first-left')
  for (const key of ['d', 'e']) assert.equal(fillNavigationTarget(rows, 2, 'third-only', key), 'third-only')
  assert.equal(fillNavigationTarget(rows, 1, null, 'd'), 'second-left')
  assert.equal(fillNavigationTarget(rows, 1, null, 'a'), 'second-right')
  assert.equal(fillNavigationTarget(rows, 1, null, 'w'), 'first-left')
  assert.equal(fillNavigationTarget(rows, 1, null, 'e'), 'third-only')
})

test('other keys and missing fill rows do not become fill navigation', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Shift', 'W', 'E', 'x']) {
    assert.equal(fillNavigationTarget(rows, 0, 'first-left', key), null)
  }
  assert.equal(fillNavigationTarget([], 0, null, 'e'), null)
})
