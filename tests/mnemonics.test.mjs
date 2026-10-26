import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blockText, highlightParts, indexMnemonics, mnemonicDirectory, normalizeMnemonicText, previewBlocks, searchMnemonics } from '../src/mnemonic-search.js'

const data = JSON.parse(readFileSync(new URL('../src/data/mnemonics-data.json', import.meta.url)))
const indexed = indexMnemonics(data.items)

test('all source entries are retained, explicitly consolidated, or explicitly excluded', () => {
  const expected = { med: 1011, surgery: 425, pathology: 326, physiology: 449, biochemistry: 346 }
  const lectureIds = new Set(data.curation.lectureAdditions)
  assert.equal(lectureIds.size, 14)
  assert.equal(data.items.length, 2256)
  const covered = [...data.items.map(item => item.id), ...Object.keys(data.curation.merged), ...Object.keys(data.curation.excluded)]
  assert.equal(covered.length, 2557 + lectureIds.size)
  assert.equal(new Set(covered).size, covered.length)
  for (const [subject, count] of Object.entries(expected)) {
    const source = data.sources.find(source => source.subject === subject)
    assert.equal(source.sourceCount, count)
    assert.equal(data.items.filter(item => item.locations.some(location => location.subject === subject)).length, source.count)
    assert.equal(covered.filter(id => id.startsWith(subject + '-') && !lectureIds.has(id)).length, count)
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


const review = JSON.parse(readFileSync(new URL('../src/data/med-mnemonic-review.json', import.meta.url)))
const entry = id => data.items.find(item => item.id === id || item.alternateIds?.includes(id))
const content = id => entry(id).blocks.map(blockText).join(' ')

test('internal medicine review covers the entire lecture and existing classified inventory', () => {
  assert.deepEqual(review.pageCoverage.map(page => page.page), Array.from({ length: 482 }, (_, index) => index + 1))
  assert.equal(review.reviewedIds.length, 908)
  const retained = new Set(data.items.flatMap(item => [item.id, ...(item.alternateIds || [])]))
  for (const id of review.reviewedIds) assert.ok(retained.has(id), id)
  assert.equal(review.additions.filter(item => !item.splitFrom).length, 11)
  for (const item of [...review.additions, ...review.updates]) {
    assert.ok(item.sourcePages.length, item.id)
    assert.ok(item.sourcePages.every(page => page >= 1 && page <= 482), item.id)
    assert.ok(item.evidence, item.id)
  }
})

test('missing lecture mnemonics are searchable with their specific medical scope', () => {
  for (const [query, expected] of [['Selina', /利福平.*C菌群/], ['小艾米', /血小板生成素.*艾曲泊帕.*罗米司亭/], ['赶紧', /肝静脉血栓/], ['洗衣机脱水', /二尖瓣狭窄/], ['麻辣烫伤胃', /Hp/]]) {
    const results = searchMnemonics(indexed, { subject: 'med', query, matchMode: 'title' })
    assert.equal(results.length, 1, query)
    assert.match(results[0].scope + content(results[0].id), expected)
  }
  assert.match(content('med-304'), /内皮.*系膜.*GFR/)
  assert.match(entry('med-304').title, /一筒和四筒/)
})

test('review preserves core numbers and contextual conditions instead of dropping decoding rows', () => {
  assert.match(content('med-13'), /80.*50.*30/)
  assert.match(content('med-10'), /3.*2/)
  assert.match(content('med-140'), /0.5.*1 L/)
  assert.match(content('med-1100'), /2.5.*5.*30.*1.6.*9.*50/)
  assert.match(content('med-1163'), /静脉.*回心血量.*肥厚/)
  assert.match(content('med-1202'), /中毒/)
  assert.match(content('med-401'), /来那度胺/)
  assert.match(content('med-260'), /器官功能障碍/)
  assert.match(content('med-1028'), /Kussmaul征不是单纯压塞/)
})

test('same-meaning copies retain cross-chapter access and old bookmarks', () => {
  for (const [oldId, target] of [['med-997', 'med-1163'], ['med-1050', 'med-254'], ['med-126', 'surgery-21'], ['med-922', 'med-314'], ['physiology-253', 'physiology-66']]) {
    assert.equal(entry(oldId).id, target)
    assert.equal(searchMnemonics(indexed, { favoritesOnly: true, favorites: [oldId] })[0].id, target)
  }
  assert.ok(entry('surgery-21').locations.some(location => location.subject === 'med' && location.chapter === '呼吸系统'))
  assert.match(content('surgery-21'), /肺上沟瘤.*臂丛/)
  assert.ok(entry('physiology-200').locations.some(location => location.subject === 'med' && location.chapter === '内分泌系统'))
  assert.equal(searchMnemonics(indexed, { query: '静止', subject: 'med', matchMode: 'title' }).length, 1)
})

test('different meanings are separated and blood immunophenotypes have focused cards', () => {
  const twoPlusThree = searchMnemonics(indexed, { subject: 'med', query: '2+3=5', matchMode: 'title' })
  assert.ok(twoPlusThree.some(item => /CLL/.test(item.title)))
  assert.ok(twoPlusThree.some(item => /间变性/.test(item.scope)))
  assert.ok(!content('med-476').includes('MM—'))
  assert.match(content('med-1311'), /CD38.*CD138/)
  assert.match(content('med-1313'), /CD23.*CD5/)
  const pang = searchMnemonics(indexed, { query: '胖胖不灵活', matchMode: 'title' })
  assert.equal(pang.length, 2)
  assert.ok(pang.some(item => /心肌病/.test(item.scope)))
  assert.ok(pang.some(item => item.subject === 'physiology'))
})


test('directory includes every secondary chapter without inflating the subject or chapter count', () => {
  const directory = mnemonicDirectory(data.items)
  for (const group of directory) {
    const classified = data.items.filter(item => item.locations.some(location => location.subject === group.subject))
    assert.equal(group.count, classified.length)
    for (const chapter of group.chapters) {
      const matching = classified.filter(item => item.locations.some(location => location.subject === group.subject && location.chapter === chapter.name))
      assert.equal(chapter.count, matching.length)
      assert.deepEqual([...chapter.sections].sort(), [...new Set(matching.flatMap(item => item.locations.filter(location => location.subject === group.subject && location.chapter === chapter.name).map(location => location.section).filter(Boolean)))].sort())
    }
  }
  const med = directory.find(group => group.subject === 'med')
  assert.ok(med.chapters.find(chapter => chapter.name === '呼吸系统').sections.has('串·热型'))
  assert.ok(med.chapters.find(chapter => chapter.name === '循环系统').sections.has('高血压'))
})
