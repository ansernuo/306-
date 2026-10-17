import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

const bank = JSON.parse(readFileSync(new URL('../src/data/biochemistry-lecture9-data.json', import.meta.url)))
const group = bank.groups.find(g => g.id === 'bio-09-08')
const labels = n => group.stems[n - 1].answer.map(k => group.options.find(o => o.key === k).label)

test('antimetabolites keep six drugs with three clear, fully selectable option sections', () => {
  assert.equal(bank.groups.length, 8)
  assert.equal(bank.groups.flatMap(g => g.stems).length, 43)
  assert.equal(group.stems.length, 6)
  assert.equal(group.stackedOptionCategories, true)
  assert.equal(group.answerLayout, 'rows')
  assert.deepEqual([...new Set(group.options.map(o => o.category))], ['结构类似物', '作用酶', '抑制过程'])
  assert.deepEqual(group.options.map(o => o.key), Array.from({length: 18}, (_, i) => String.fromCharCode(65 + i)))
  for (const s of group.stems) {
    assert.ok(s.text.length < 45)
    assert.equal(s.optionCategory, undefined, 'each drug must allow all three sections')
    assert.equal(s.answerRaw, s.answer.join('、'))
    assert.equal(s.answerMode, '多选')
    assert.deepEqual(new Set(s.answer.map(k => group.options.find(o => o.key === k).category)), new Set(['结构类似物', '作用酶', '抑制过程']))
  }
  assert.doesNotMatch(group.options.map(o => o.label).join(' '), /合成嘌呤核苷酸的酶/)
  assert.equal(group.answerRevision, 'bio-09-antimetabolites-20261017-v2')
})

test('activation, targets and overlapping synthetic processes are distinguished', () => {
  assert.deepEqual(labels(1), ['次黄嘌呤', 'HGPRT（代谢活化酶）', 'PRPP酰胺转移酶', '嘌呤核苷酸从头合成'])
  assert.deepEqual(labels(2), ['次黄嘌呤', '黄嘌呤氧化酶', '嘌呤分解生成尿酸'])
  assert.deepEqual(labels(3), ['胞苷', 'DNA聚合酶', 'DNA链延长'])
  assert.deepEqual(labels(4), ['尿嘧啶', '胸苷酸合酶', 'dTMP合成（dUMP → dTMP）'])
  assert.deepEqual(labels(5), ['叶酸', '二氢叶酸还原酶（DHFR）', '嘌呤核苷酸从头合成', 'dTMP合成（dUMP → dTMP）'])
  assert.deepEqual(labels(6), ['谷氨酰胺', 'CPS-Ⅱ', 'PRPP酰胺转移酶', '嘌呤核苷酸从头合成', '嘧啶核苷酸从头合成'])
})

test('antimetabolite reference opens the actual table, not the old page 3', () => {
  const evidence = group.lectureEvidence
  assert.equal(evidence.sourcePdfPage, 80)
  assert.equal(evidence.sourceBookPage, 65)
  assert.equal(evidence.page, 6)
  assert.match(evidence.pageLabel, /65.*80/)
  assert.match(evidence.image, /lecture-09-page-06.webp$/)
  assert.ok(existsSync(new URL(`../public/${evidence.image}`, import.meta.url)))
})
