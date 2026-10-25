import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blockText, highlightParts, indexMnemonics, normalizeMnemonicText, previewBlocks, searchMnemonics } from '../src/mnemonic-search.js'

const data = JSON.parse(readFileSync(new URL('../src/data/mnemonics-data.json', import.meta.url)))
const indexed = indexMnemonics(data.items)

test('all five exported libraries are complete and each item has a stable unique ID and knowledge', () => {
  const expected = { med: 1011, surgery: 425, pathology: 326, physiology: 449, biochemistry: 346 }
  assert.equal(data.items.length, 2557)
  assert.equal(new Set(data.items.map(item => item.id)).size, data.items.length)
  for (const [subject, count] of Object.entries(expected)) {
    assert.equal(data.items.filter(item => item.subject === subject).length, count)
    assert.equal(data.sources.find(source => source.subject === subject).count, count)
  }
  for (const item of data.items) {
    assert.ok(item.title.trim())
    assert.ok(item.chapter.trim())
    assert.ok(item.blocks.length)
    assert.ok(item.blocks.every(block => blockText(block)))
    assert.ok(!item.blocks.some(block => /<\/?(?:page|table|h[123])\b|〔PDF|出处：PDF/.test(blockText(block))), item.id)
  }
})

test('lookup searches mnemonic names, aliases and hidden medical knowledge with title matches first', () => {
  assert.match(searchMnemonics(indexed, { query: '呱呱一定摆平' })[0].title, /瓜瓜一定摆平/)
  const jia = searchMnemonics(indexed, { query: '甲生儿' })
  assert.ok(jia.some(item => item.title === '甲生儿'))
  assert.ok(jia.some(item => item.title === '甲生儿糖糖'))
  assert.ok(searchMnemonics(indexed, { query: '胍乙啶' }).some(item => item.title.includes('瓜瓜一定摆平')))
  assert.ok(searchMnemonics(indexed, { query: '促红细胞生成素' }).length > 0)
  assert.ok(searchMnemonics(indexed, { query: '肌酐' }).length > 0)
  assert.equal(searchMnemonics(indexed, { query: '不存在的口诀987987' }).length, 0)
})

test('normalization accepts full-width, subscript, spaces and punctuation without changing English case meaning', () => {
  assert.equal(normalizeMnemonicText('ＣＤ４＋ T细胞'), normalizeMnemonicText('cd4t细胞'))
  assert.equal(normalizeMnemonicText('H₂O'), normalizeMnemonicText('H2O'))
  const ascii = searchMnemonics(indexed, { query: 'epo' }).map(item => item.id)
  assert.deepEqual(searchMnemonics(indexed, { query: 'ＥＰＯ' }).map(item => item.id), ascii)
})

test('subject, chapter, multiple keywords and saved-only filters compose', () => {
  const results = searchMnemonics(indexed, { subject: 'physiology', query: '甲生儿 红细胞' })
  assert.ok(results.length > 0)
  assert.ok(results.every(item => item.subject === 'physiology'))
  const first = results[0]
  assert.ok(searchMnemonics(indexed, { chapter: `${first.subject}:${first.chapter}` }).every(item => item.chapter === first.chapter && item.subject === first.subject))
  assert.deepEqual(searchMnemonics(indexed, { favoritesOnly: true, favorites: [first.id] }).map(item => item.id), [first.id])
})

test('a match buried in the full entry is brought into the visible preview', () => {
  const item = indexed.find(item => item.blocks.length > 6 && blockText(item.blocks.at(-1)).length > 10)
  const query = blockText(item.blocks.at(-1)).slice(-8)
  assert.ok(previewBlocks(item, query).some(block => blockText(block).includes(query)))
})

test('highlights preserve text and span subscript, punctuation and multiple term boundaries', () => {
  for (const [text, query] of [['甲状腺激素', '甲状腺'], ['H₂O和ＥＰＯ', 'h2o epo'], ['肾上腺素／去甲肾上腺素', '肾上腺素'], ['<img onerror=alert(1)>', 'img']]) {
    const parts = highlightParts(text, query)
    assert.equal(parts.map(part => part.text).join(''), text)
    assert.ok(parts.some(part => part.match))
  }
})
