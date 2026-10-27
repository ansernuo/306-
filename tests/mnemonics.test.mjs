import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { blockText, highlightParts, indexMnemonics, mnemonicDirectory, normalizeMnemonicText, previewBlocks, searchMnemonics } from '../src/mnemonic-search.js'

const data = JSON.parse(readFileSync(new URL('../src/data/mnemonics-data.json', import.meta.url)))
const indexed = indexMnemonics(data.items)

test('all source entries are retained, explicitly consolidated, or explicitly excluded', () => {
  const expected = { med: 1011, surgery: 425, pathology: 326, physiology: 449, biochemistry: 346 }
  const lectureIds = new Set(data.curation.lectureAdditions)
  assert.equal(lectureIds.size, 30)
  assert.equal(data.items.length, 2198)
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
    assert.ok(!item.blocks.some(block => /<\/?(?:page|table|h[123])\b|〔PDF|出处：PDF|口诀(?:字|片段)|对应原文考点|本节口诀|原文汇总|讲义汇总|串联语|保留原(?:文|句|表|资料)|原表|原页/.test(blockText(block))), item.id)
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


test('numeric mnemonic search preserves arithmetic operators and number boundaries', () => {
  assert.deepEqual(searchMnemonics(indexed, { subject: 'med', query: '5÷2' }).map(item => item.id), ['med-1100'])
  assert.deepEqual(searchMnemonics(indexed, { subject: 'med', query: '5 / 2' }).map(item => item.id), ['med-1100'])
  assert.deepEqual(searchMnemonics(indexed, { subject: 'med', query: '4×4＝16' }).map(item => item.id), ['med-1307'])
  assert.equal(searchMnemonics(indexed, { subject: 'med', query: '2+3=5', matchMode: 'title' }).length, 3)
  assert.deepEqual(searchMnemonics(indexed, { query: '甲生儿' }).map(item => item.id), ['physiology-115', 'physiology-435'])
})

const surgeryReview = JSON.parse(readFileSync(new URL('../src/data/surgery-mnemonic-review.json', import.meta.url)))

test('surgery review covers the current lecture, annotated source and original classified inventory', () => {
  assert.equal(surgeryReview.source.pageCount, 232)
  assert.deepEqual(surgeryReview.pageCoverage.map(page => page.page), Array.from({ length: 232 }, (_, index) => index + 1))
  assert.deepEqual(surgeryReview.legacyPageCoverage.map(page => page.page), Array.from({ length: 286 }, (_, index) => index + 1))
  assert.equal(new Set(surgeryReview.reviewedIds).size, 425)
  for (const id of surgeryReview.reviewedIds) assert.ok(entry(id), id)
  for (const item of [...surgeryReview.updates, ...surgeryReview.additions]) {
    assert.ok(item.sourcePages.length, item.id)
    assert.ok(item.sourcePages.every(page => page >= 1 && page <= 232), item.id)
    assert.ok(item.legacySourcePages.length && item.evidence, item.id)
  }
  assert.deepEqual(data.curation.reviewedSubjects, {
    med: { pageCount: 482, reviewedCount: 908 },
    surgery: { pageCount: 232, reviewedCount: 425 },
    pathology: { pageCount: 195, reviewedCount: 326 },
    physiology: { pageCount: 383, reviewedCount: 446 },
  })
})

test('surgery corrections retain decimals, exact anatomy and conditional treatment', () => {
  assert.match(content('surgery-14'), /0\.1.*0\.5.*0\.5.*2/)
  assert.match(content('surgery-180'), /0\.6.*2cm/)
  assert.match(content('surgery-336'), /13\.4.*KCl 1 g/)
  assert.match(content('surgery-316'), /腓骨干下1\/3.*第2、3跖骨.*肋骨/)
  assert.match(content('surgery-217'), /1.*2.*3/)
  assert.match(content('surgery-228'), /Bechterew.*颈椎/)
  assert.match(content('surgery-346'), /生发层.*乳头层/)
  assert.match(content('surgery-348'), /第二个24小时.*晶、胶体量减半.*2000 mL不减半/)
  assert.match(content('surgery-359'), /心肌炎/)
  assert.match(content('surgery-294'), /重度Ⅱ.*Ⅲ.*非老年Ⅳ.*内固定.*老年Ⅳ.*置换/)
  assert.match(content('surgery-144'), /Ⅲa.*右肝管.*Ⅲb.*左肝管.*Ⅳ.*左右肝管/)
  assert.match(content('surgery-131'), /0\.6.*5mmol.*15mmol.*pH≤2.*10倍/)
  assert.match(content('biochemistry-88'), /芳香族氨基酸.*假性神经递质.*比值＜1.*肠外营养/)
})

test('lecture import distinguishes leading decimal thresholds from numbered list markers', () => {
  const script = `import json,sys
sys.path.insert(0,'scripts')
from curate_mnemonics import polish
print(json.dumps([polish(s) for s in ['0.1～0.5 mmol/L','0.6–2cm','13.4 mmol K⁺','1.8','1. 低钾血症','1、低钾血症']],ensure_ascii=False))`
  const result = execFileSync('python3', ['-c', script], { cwd: new URL('../', import.meta.url), encoding: 'utf8' })
  assert.deepEqual(JSON.parse(result), ['0.1～0.5 mmol/L', '0.6–2cm', '13.4 mmol K⁺', '1.8', '低钾血症', '低钾血症'])
})

test('missing surgical mnemonics are concise, searchable and independent of adjacent extracts', () => {
  for (const [query, expected] of [['Beyond', /Luminal B/], ['痛吐胀停', /梗阻/], ['咏胃周淋巴结', /16组/], ['么儿要救我', /膝胸位12点.*膝胸位1、9、5点/], ['前列腺肥大', /肛裂.*肛乳头肥大/], ['蓄水池', /黄疸/], ['di—die', /肾蒂损伤/]]) {
    const results = searchMnemonics(indexed, { subject: 'surgery', query, matchMode: 'title' })
    assert.equal(results.length, 1, query)
    assert.match(results[0].scope + content(results[0].id), expected)
  }
  assert.equal(entry('surgery-376').id, 'surgery-376')
  assert.match(content('surgery-376'), /术前1天.*2～3天/)
  assert.match(content('surgery-85'), /切缘/)
  assert.notEqual(entry('surgery-376').id, entry('surgery-85').id)
})

test('surgical consolidations preserve old favorites while removing incorrect classifications', () => {
  for (const oldId of ['surgery-57', 'surgery-121', 'surgery-191', 'surgery-281', 'surgery-315']) {
    const result = searchMnemonics(indexed, { favoritesOnly: true, favorites: [oldId] })
    assert.equal(result.length, 1, oldId)
    assert.equal(result[0].id, entry(oldId).id)
  }
  assert.equal(entry('surgery-121').id, 'med-244')
  assert.match(content('surgery-121'), /态.*奥曲肽/)
  assert.ok(!entry('surgery-168').locations.some(location => location.subject === 'surgery' && location.chapter === '周围血管'))
  assert.equal(entry('surgery-168').id, 'med-213')
  assert.notEqual(entry('surgery-183').id, entry('med-225').id)
})

const pathologyReview = JSON.parse(readFileSync(new URL('../src/data/pathology-mnemonic-review.json', import.meta.url)))
const physiologyReview = JSON.parse(readFileSync(new URL('../src/data/physiology-mnemonic-review.json', import.meta.url)))

test('pathology and physiology audits cover complete lectures and all existing classified records', () => {
  for (const [audit, pageCount, count] of [[pathologyReview, 195, 326], [physiologyReview, 383, 446]]) {
    assert.equal(audit.source.pageCount, pageCount)
    assert.deepEqual(audit.pageCoverage.map(p => p.page), Array.from({ length: pageCount }, (_, index) => index + 1))
    assert.equal(new Set(audit.reviewedIds).size, count)
    for (const id of audit.reviewedIds) assert.ok(entry(id), id)
    for (const item of [...audit.updates, ...audit.additions]) {
      assert.ok(item.evidence, item.id)
      assert.ok(item.sourcePages.length || (item.sourceKind === 'legacy-annotated-diagram' && item.legacySourcePages.length), item.id)
      assert.ok(item.sourcePages.every(p => p >= 1 && p <= pageCount), item.id)
    }
  }
  assert.deepEqual(physiologyReview.legacyPageCoverage.map(p => p.page), Array.from({ length: 437 }, (_, index) => index + 1))
  assert.equal(pathologyReview.additions.length, 1)
  assert.equal(physiologyReview.additions.filter(i => !i.splitFrom).length, 1)
  assert.equal(physiologyReview.additions.filter(i => i.splitFrom).length, 3)
})

test('pathology distinguishes foam cells, giant cells, inclusion locations and body-cell containment', () => {
  assert.match(content('pathology-66'), /巨噬细胞.*平滑肌细胞.*脂质/)
  assert.match(content('pathology-182'), /小胶质细胞.*脂质.*泡沫细胞/)
  assert.match(content('pathology-91'), /上皮细胞融合.*巨噬细胞融合/)
  assert.match(content('pathology-90'), /麻疹.*胞核.*胞质.*合胞病毒.*胞质.*腺病毒.*胞核/)
  assert.match(content('pathology-113'), /包含.*狼疮小体.*风湿小体/)
  assert.match(content('pathology-112'), /肾小球狼疮.*最具/)
  assert.match(content('pathology-285'), /LCA.*白细胞共同抗原/)
  assert.match(content('pathology-318'), /FOS.*JUN.*MYC/)
})

test('missing notes and split mnemonics produce focused searchable results', () => {
  for (const [query, expected] of [['吸血鬼哎', /痢疾.*血吸虫.*溃疡性结肠炎.*大肠癌/], ['流量KB', /维生素K.*B族/], ['胰蛋白酶是胰酶激活的扳机', /肠激酶.*胰蛋白酶/], ['本来染粪便结果把自己染黄了', /胆色素.*黄疸/]]) {
    const results = searchMnemonics(indexed, { query, matchMode: 'title' })
    assert.equal(results.length, 1, query)
    assert.match(results[0].scope + content(results[0].id), expected)
  }
  assert.ok(!content('physiology-280').includes('维生素'))
  assert.ok(!content('physiology-278').includes('黄疸'))
  assert.ok(!content('physiology-341').includes('白内障'))
})

test('physiology restores occupied placeholders and distinguishes unrelated mechanisms', () => {
  assert.match(content('physiology-19'), /球状带.*醛固酮.*束状带.*糖皮质.*网状带.*性激素.*髓质.*儿茶酚胺/)
  assert.match(content('physiology-92'), /cAMP.*DAG.*cGMP.*神经酰胺.*cGAMP.*cADPR.*IP₃.*PIP₃/)
  assert.match(content('physiology-192'), /0期.*速度.*邻旁.*兴奋性.*细胞直径.*闰盘/)
  assert.match(content('physiology-165'), /视交叉上核/)
  assert.match(content('physiology-228'), /声门.*回心血量.*迷走/)
  assert.match(content('physiology-248'), /外周|颈动脉体/)
  assert.match(content('physiology-248'), /脑脊液.*H⁺/)
  assert.match(content('physiology-443'), /孕激素.*排卵后.*高峰/)
  assert.match(content('physiology-351'), /Na⁺-K⁺-2Cl⁻/)
  assert.ok(!content('physiology-351').includes('NKCC2'))
  assert.match(content('physiology-286'), /不溶性钙皂.*减少.*吸收/)
})

test('shared knowledge has one canonical record while aliases, favorites and chapter access survive', () => {
  for (const [oldId, canonical] of [['pathology-270', 'surgery-28'], ['pathology-97', 'med-457'], ['pathology-317', 'surgery-40'], ['physiology-153', 'med-37'], ['physiology-449', 'surgery-38'], ['biochemistry-195', 'pathology-318']]) {
    assert.equal(entry(oldId).id, canonical)
    assert.equal(searchMnemonics(indexed, { favoritesOnly: true, favorites: [oldId] })[0].id, canonical)
  }
  assert.match(content('med-37'), /Ⅻa.*t-PA.*激肽释放酶.*u-PA.*月经血/)
  assert.ok(!content('physiology-446').includes('12月'))
  assert.ok(entry('surgery-39').locations.some(l => l.subject === 'physiology' && l.chapter === '生殖'))
  assert.ok(!entry('surgery-38').aliases?.some(t => /阿姨/.test(t)))
  assert.equal(searchMnemonics(indexed, { query: '比伯', matchMode: 'title' }).length, 1)
})

test('additional context never replaces the surgical mnemonic core or its thresholds', () => {
  assert.match(content('surgery-28'), /T₁≤2.*T₂＞2且≤5.*T₃＞5/)
  assert.match(content('surgery-22'), /上动脉.*贴近.*喉上神经.*下动脉.*远离.*喉返/)
  assert.match(content('surgery-55'), /Ⅰ型.*Ⅱ型.*Ⅲ型.*Ⅳ型/)
  assert.match(content('surgery-64'), /开放.*肝.*闭合.*脾/)
  assert.match(content('surgery-105'), /精索.*疝囊后方/)
  assert.match(content('surgery-106'), /精索.*疝囊前外方/)
})
