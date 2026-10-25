import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blockText, highlightParts, indexMnemonics, normalizeMnemonicText, previewBlocks, searchMnemonics } from '../src/mnemonic-search.js'

const data = JSON.parse(readFileSync(new URL('../src/data/mnemonics-data.json', import.meta.url)))
const indexed = indexMnemonics(data.items)

test('all source entries are retained, explicitly consolidated, or explicitly excluded', () => {
  const expected = { med: 1011, surgery: 425, pathology: 326, physiology: 449, biochemistry: 346 }
  assert.equal(data.items.length, 2363)
  const covered = [...data.items.map(item => item.id), ...Object.keys(data.curation.merged), ...Object.keys(data.curation.excluded)]
  assert.equal(covered.length, 2557)
  assert.equal(new Set(covered).size, 2557)
  for (const [subject, count] of Object.entries(expected)) {
    const source = data.sources.find(source => source.subject === subject)
    assert.equal(source.sourceCount, count)
    assert.equal(data.items.filter(item => item.locations.some(location => location.subject === subject)).length, source.count)
    assert.equal(covered.filter(id => id.startsWith(subject + '-')).length, count)
  }
  for (const item of data.items) {
    assert.ok(item.title.trim())
    assert.ok(item.chapter.trim())
    assert.ok(item.blocks.length)
    assert.ok(item.blocks.every(block => blockText(block)))
    assert.ok(!item.blocks.some(block => block.kind === 'context'), item.id)
    assert.ok(!item.blocks.some(block => /<\/?(?:page|table|h[123])\b|〔PDF|出处：PDF|口诀(?:字|片段)|对应原文考点|本节口诀|原文汇总|讲义汇总|串联语|保留原|原表|原页/.test(blockText(block))), item.id)
    assert.ok(item.blocks.every(block => blockText(block).length < 180), item.id)
  }
})

test('direct mnemonic lookup excludes neighbouring mnemonics and lecture paragraphs', () => {
  const expected = ['physiology-115', 'physiology-435']
  assert.deepEqual(searchMnemonics(indexed, { query: '甲生儿' }).map(item => item.id), expected)
  assert.deepEqual(searchMnemonics(indexed, { query: '甲生' }).map(item => item.id), expected)
  assert.equal(searchMnemonics(indexed, { query: '甲生儿', matchMode: 'knowledge' }).length, 0)
  assert.ok(searchMnemonics(indexed, { query: 'EPO', matchMode: 'knowledge' }).some(item => item.id === 'physiology-115'))
  assert.ok(!blockText(data.items.find(item => item.id === 'physiology-115').blocks[0]).includes('减少酸雨'))
})

test('converted table has four compact definitions and no source headers or whitespace', () => {
  const item = data.items.find(item => item.id === 'med-903')
  assert.match(item.scope, /IgM/)
  assert.equal(item.blocks.length, 4)
  for (const block of item.blocks) {
    assert.equal(block.kind, 'mapping')
    assert.match(blockText(block), /→/)
    assert.ok(!/\n| {2,}|口诀字|对应原文/.test(blockText(block)))
  }
  assert.match(item.blocks.map(blockText).join(' '), /ABO.*冷抗体.*类风湿.*支原体/)
})

test('same knowledge across subjects is one record accessible from both classifications', () => {
  for (const subject of ['pathology', 'physiology']) {
    const items = searchMnemonics(indexed, { subject, query: '红白夹心升糖' })
    assert.equal(items.length, 1)
    assert.equal(items[0].subject, subject)
    assert.equal(items[0].id, 'physiology-297')
  }
  assert.equal(searchMnemonics(indexed, { query: '红白夹心升糖' }).length, 1)
  assert.equal(searchMnemonics(indexed, { favoritesOnly: true, favorites: ['pathology-111'] })[0].id, 'physiology-297')
  assert.equal(searchMnemonics(indexed, { query: '老高闭闭闭' }).length, 1)
  assert.equal(searchMnemonics(indexed, { query: '上下班' }).length, 1)
})

test('clinical limits and qualifiers survive condensation', () => {
  const content = id => data.items.find(item => item.id === id).blocks.map(blockText).join(' ')
  assert.match(content('physiology-115'), /局部缺氧.*EPO/)
  assert.match(content('med-275'), /3日.*2周/)
  assert.match(content('med-392'), /85g\/L.*3个.*2.65mmol\/L/)
  assert.match(content('med-1190'), /二尖瓣狭窄.*不用硝普钠/)
  assert.match(content('physiology-207'), /265.*5.5.*双肾动脉狭窄.*妊娠.*低血压/)
  assert.match(content('biochemistry-299'), /并非所有/)
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
