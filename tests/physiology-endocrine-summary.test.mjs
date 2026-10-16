import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url)))
const data = load('../src/data/physiology-endocrine-summary-data.json')
const approved = load('../physiology/endocrine-summary-reviewed.json')
const base = load('../src/data/physiology-data.json')
const homework = load('../src/data/physiology-teacher-supplement.json')
const exam = load('../src/data/physiology-stage-exam-data.json')

test('11 merged groups and all 70 approved questions are preserved exactly', () => {
  assert.equal(data.groups.length, 11)
  assert.equal(data.groups.reduce((n, g) => n + g.stems.length, 0), 70)
  assert.equal(data.meta.siteIntegrated, true)
  const all = [...base.groups, ...homework.groups, ...exam.groups, ...data.groups]
  assert.equal(new Set(all.map(g => g.id)).size, all.length)
  data.groups.forEach((g, index) => {
    const original = approved.groups[index]
    assert.equal(g.id, original.id)
    assert.deepEqual(g.options, original.options)
    assert.deepEqual(g.stems.map(s => [s.text, s.answer, s.answerRaw, s.answerMode]),
      original.stems.map(s => [s.text, s.answer, s.answerRaw, s.answerMode]))
    for (const s of g.stems) {
      assert.doesNotMatch(s.text, /本讲义|本组|归入此类/)
      assert.deepEqual(s.answer, Array.from(s.answerRaw))
      assert.ok(s.answer.every(a => g.options.some(o => o.key === a)))
    }
    assert.equal(g.stems[0].explanation, original.explanation)
    assert.equal(g.hideSource, true) // No claim that these are original workbook pages.
    assert.notEqual(g.supplement, true) // Do not misattribute self-authored questions to the teacher.
  })
})

test('the new groups join only lecture 40 and link real source pages', () => {
  const lecture = base.lectures.find(l => l.id === 'lecture-40')
  assert.equal(data.meta.sourceSha256, lecture.sourceSha256)
  assert.deepEqual(data.pages.map(p => p.page), [4, 5, 6])
  for (const g of data.groups) {
    assert.deepEqual(g.lectureIds, ['lecture-40'])
    assert.equal(g.topic, '内分泌')
    assert.ok(existsSync(resolve('public', g.lectureEvidence.image)))
    for (const n of g.sourcePages) {
      const page = data.pages.find(p => p.page === n && p.sourceKey === g.sourceKey)
      assert.ok(page, `${g.id}: page ${n}`)
      assert.ok(existsSync(resolve('public', page.image)))
    }
  }
})

test('merge remapping retains easily missed and dose-dependent answers', () => {
  const answers = number => data.groups[number - 1].stems.map(s => s.answerRaw)
  assert.deepEqual(answers(1), ['AB', 'CDEFGHI', 'JKLM', 'NOP'])
  assert.deepEqual(answers(2), ['A', 'B', 'C', 'D', 'E', 'F', 'GHI', 'IJK'])
  assert.deepEqual(answers(6), ['ACDEF', 'ABCDE'])
  assert.deepEqual(answers(8), ['ABCDE', 'ABCD', 'C', 'C', 'D', 'DEFGH', 'E', 'D', 'GH'])
  assert.deepEqual(answers(9), ['ABCD', 'E', 'FG', 'H', 'I', 'F'])
  assert.deepEqual(answers(10), ['ABCDEFGHI', 'AB', 'ADEG', 'G'])
})
