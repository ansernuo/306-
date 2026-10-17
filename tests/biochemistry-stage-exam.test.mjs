import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)))
const data = read('biochemistry-stage-exam-data')
const banks = [read('biochemistry-data'), ...Array.from({ length: 19 }, (_, i) => read(`biochemistry-lecture${i + 2}-data`)), read('biochemistry-teacher-supplement')]
const q = n => data.groups.find(g => g.stems[0].number === n)
const multiple = [3, 4, 6, 10, 11, 13, 18, 21, 22]

test('all 25 biochemistry exam questions retain original numbering, four choices and source type', () => {
  assert.equal(data.meta.groupCount, 25)
  assert.equal(data.meta.stemCount, 25)
  assert.deepEqual(data.groups.map(g => g.stems[0].number), Array.from({ length: 25 }, (_, i) => i + 1))
  assert.deepEqual(data.groups.filter(g => g.kind === 'X').map(g => g.stems[0].number), multiple)
  const all = [...banks.flatMap(b => b.groups), ...data.groups]
  assert.equal(new Set(all.map(g => g.id)).size, 232)
  assert.equal(all.flatMap(g => g.stems).length, 1010)
  for (const g of data.groups) {
    const s = g.stems[0]
    assert.equal(g.stems.length, 1)
    assert.deepEqual(g.options.map(o => o.key), ['A', 'B', 'C', 'D'])
    assert.ok(g.options.every(o => o.label && o.key === o.displayKey))
    assert.equal(s.answerMode, multiple.includes(s.number) ? '多选' : '单选')
    assert.doesNotMatch([s.text, ...g.options.map(o => o.label)].join(' '), /uusx|每日计划|微信|再相逢|（X）/)
  }
})

test('the source has no answer key: no answers are inferred or labelled as supplied', () => {
  assert.deepEqual(data.meta.missingAnswerQuestions, Array.from({ length: 25 }, (_, i) => i + 1))
  assert.equal(data.meta.answerRows, undefined)
  for (const g of data.groups) {
    assert.match(g.supplementNotice, /原卷未附答案/)
    assert.equal(g.answerSourceName, undefined)
    assert.deepEqual(g.stems[0].answer, [])
    assert.equal(g.stems[0].answerRaw, '')
    assert.equal(g.stems[0].answerState, '暂无参考答案')
  }
})

test('cross-page choices, source page images and notation survive extraction', () => {
  assert.deepEqual(q(5).sourcePages, [1, 2])
  assert.deepEqual(q(16).sourcePages, [3, 4])
  assert.equal(q(5).options[3].label, 'ACP')
  assert.match(q(16).options[1].label, /5-端添加端粒/)
  assert.match(q(16).options[3].label, /线性染色体的合成/)
  assert.match(q(12).options[0].label, /Fe²⁺/)
  assert.match(q(12).options[2].label, /B₆/)
  assert.deepEqual(q(23).options.map(o => o.label), ['ATAATA', 'CCCTGG', 'GATATC', 'GAGTCT'])
  assert.match(q(24).options[0].label, /6× His-Tag/)
  assert.match(q(25).options[3].label, /ddNTP.*终止 DNA 合成/)
  assert.equal(data.pages.length, 5)
  for (const p of data.pages) assert.ok(existsSync(resolve('public', p.image)), p.image)
  for (const g of data.groups) {
    assert.equal(g.page, g.sourcePages[0])
    for (const n of g.sourcePages) assert.ok(data.pages.some(p => p.page === n && p.sourceKey === g.sourceKey))
  }
})

test('stage questions load into real tested chapters, alongside existing lecture and homework data', () => {
  const lectureIds = new Set(banks.flatMap(b => b.lectures || []).map(l => l.id))
  const topics = ['糖代谢', '生物氧化', '脂代谢', '氨基酸与蛋白质', '核苷酸代谢', '胆色素代谢与生物转化', '小基因', '核酸']
  for (const g of data.groups) {
    assert.equal(g.lectureIds.length, 1)
    assert.ok(lectureIds.has(g.lectureIds[0]), g.id)
    assert.equal(g.stems[0].lectureId, g.lectureIds[0])
    assert.ok(topics.includes(g.topic))
  }
  for (const [n, lecture] of [[1, 8], [3, 3], [7, 2], [10, 9], [11, 10], [14, 20], [16, 16], [17, 17], [18, 18], [19, 19], [21, 14], [25, 14]]) {
    assert.deepEqual(q(n).lectureIds, [`lecture-${String(lecture).padStart(2, '0')}`])
  }
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /loadJson\(\(\) => import\('\.\/data\/biochemistry-stage-exam-data\.json'\)\)/)
  assert.match(app, /groups: \[\.\.\.biochemistryTeacherContent\.groups, \.\.\.biochemistryExamContent\.groups\]/)
  assert.match(app, /pages: \[\.\.\.biochemistryTeacherContent\.pages, \.\.\.biochemistryExamContent\.pages\]/)
})
