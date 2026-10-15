import test from 'node:test'
import assert from 'node:assert/strict'
import { matchShortcut, optionShortcut, shortcutCharacter } from '../src/keyboard-shortcuts.js'

test('unmodified letters select uppercase choices while Command selects lowercase choices', () => {
  assert.equal(shortcutCharacter({ key: 'a' }), 'A')
  assert.equal(shortcutCharacter({ key: 'A', shiftKey: true }), 'A')
  assert.equal(shortcutCharacter({ key: 'a', metaKey: true }), 'a')
  for (const modifier of ['ctrlKey', 'altKey', 'isComposing']) {
    assert.equal(shortcutCharacter({ key: 'a', [modifier]: true }), '')
  }
  assert.equal(shortcutCharacter({ key: 'a', keyCode: 229 }), '')
  assert.equal(shortcutCharacter({ key: 'a', metaKey: true, shiftKey: true }), '')
  assert.equal(shortcutCharacter({ key: '3' }), '3')
  assert.equal(shortcutCharacter({ key: '3', metaKey: true }), '')
})

test('displayed numeric labels normalize without losing case or multi-character labels', () => {
  for (const [label, expected] of [['A', 'A'], ['a', 'a'], ['①', '1'], ['⑩', '10'], ['㉚', '30'], ['AA', 'AA']]) {
    assert.equal(optionShortcut(label), expected)
  }
  assert.equal(optionShortcut(undefined), '')
  assert.equal(optionShortcut('q7-A'), '')
})

test('ambiguous prefixes wait for complete labels and uppercase and lowercase remain separate', () => {
  const choices = ['A', 'AA', 'a', '①', '⑩', '㉚'].map(label => ({ label, shortcut: optionShortcut(label) }))
  assert.equal(matchShortcut(choices, 'A').exact.label, 'A')
  assert.equal(matchShortcut(choices, 'A').hasLonger, true)
  assert.equal(matchShortcut(choices, 'AA').exact.label, 'AA')
  assert.equal(matchShortcut(choices, 'a').exact.label, 'a')
  assert.equal(matchShortcut(choices, '1').hasLonger, true)
  assert.equal(matchShortcut(choices, '10').exact.label, '⑩')
  assert.equal(matchShortcut(choices, '3').exact, undefined)
  assert.equal(matchShortcut(choices, '30').exact.label, '㉚')
  assert.equal(matchShortcut(choices, 'Z').matches, false)
})
