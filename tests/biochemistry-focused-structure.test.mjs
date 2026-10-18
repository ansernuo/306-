import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

const banks = Array.from({ length: 20 }, (_, i) => JSON.parse(readFileSync(new URL(
  `../src/data/${i ? `biochemistry-lecture${i + 1}-data` : 'biochemistry-data'}.json`, import.meta.url))))
const groups = banks.flatMap(b => b.groups)
const get = id => { const g = groups.find(g => g.id === id); assert.ok(g, id); return g }
const family = id => groups.filter(g => g.sourceGroupId === id)
const labels = (id, index) => {
  const g = get(id)
  return g.stems[index].answer.map(k => g.options.find(o => o.key === k).label)
}

test('all twenty chapters were reviewed, including preserved standalone questions', () => {
  assert.equal(banks.length, 20)
  assert.deepEqual(banks.map(b => b.meta.groupCount), [9,17,11,7,13,17,19,14,15,6,8,21,6,21,23,19,19,19,13,11])
  for (const b of banks) {
    assert.equal(b.meta.structureReviewVersion, 'bio-focused-20261017-v1')
    assert.equal(b.meta.structureReviewedAt, '2026-10-18')
    assert.equal(b.meta.stemCount, b.groups.flatMap(g => g.stems).length)
  }
  assert.equal(new Set(groups.filter(g => g.answerRevision === 'bio-focused-20261017-v1').map(g => g.sourceGroupId)).size, 103)
  const fill = groups.flatMap(g => g.stems).filter(s => s.answerMode === '填空')
  assert.equal(fill.length, 60)
})

test('new split groups retain their chapter, source page and lecture instead of becoming orphan questions', () => {
  for (const g of groups.filter(g => g.id.includes('-focus-'))) {
    const source = get(g.sourceGroupId)
    assert.equal(g.page, source.page, g.id)
    assert.equal(g.topic, source.topic, g.id)
    assert.deepEqual(g.lectureIds, source.lectureIds, g.id)
    assert.deepEqual(g.lectureEvidence, source.lectureEvidence, g.id)
    assert.equal(g.answerRevision, 'bio-focused-20261017-v1')
    assert.ok(g.options.length >= 2 && g.options.length <= 11, g.id)
    assert.equal(g.stackedOptionCategories, undefined)
    if (g.lectureEvidence?.image) assert.ok(existsSync(new URL(`../public/${g.lectureEvidence.image}`, import.meta.url)))
    assert.deepEqual(g.stems.map(s => s.number), g.stems.map((_, i) => i + 1))
  }
})

test('screenshot group separates nucleosomes, denaturation and Tm without duplicate correct synonyms', () => {
  assert.equal(family('bio-15-04').length, 5)
  assert.deepEqual(labels('bio-15-04', 0), ['H2A', 'H2B', 'H3', 'H4'])
  assert.deepEqual(labels('bio-15-04', 1), ['H1'])
  const physical = get('bio-15-04-focus-3')
  assert.equal(physical.options.filter(o => /增色效应|260 nm处吸光度增加/.test(o.label)).length, 1)
  assert.equal(get('bio-15-04-focus-4').stems[0].answerMode, '单选')
  assert.equal(get('bio-15-04-focus-4').stems[0].answer.length, 1)
  assert.deepEqual(new Set(labels('bio-15-04-focus-5', 0)), new Set(['长度↑', 'GC 含量↑', '溶液离子强度↑']))
  assert.ok(family('bio-15-04').every(g => g.options.length <= 5))
  assert.doesNotMatch(family('bio-15-04').flatMap(g => g.stems.map(s => s.text)).join(' '), /有关的内容|高级.*变性/)
})

test('different biochemical dimensions use independent answer pools across chapters', () => {
  assert.equal(family('bio-02-04').length, 3)
  assert.equal(family('bio-03-04').length, 2)
  assert.equal(family('bio-04-01').length, 3)
  assert.equal(family('bio-07-05').length, 2)
  assert.equal(family('bio-09-06').length, 4)
  assert.equal(family('bio-11-03').length, 3)
  assert.equal(family('bio-12-07').length, 4)
  assert.deepEqual(labels('bio-12-07', 0), ['Vmax不变'])
  assert.deepEqual(labels('bio-12-07-focus-2', 0), ['Km升高'])
  assert.deepEqual(labels('bio-12-07-focus-2', 1), ['Km不变'])
  assert.deepEqual(labels('bio-12-07-focus-2', 2), ['Km降低'])
  assert.equal(family('bio-17-04').length, 2)
  assert.equal(family('bio-20-06').length, 4)
})

test('redundant and circular prompts are removed without replacing them by answer hints', () => {
  assert.equal(get('bio-10-02').stems.length, 3)
  assert.equal(get('bio-14-12').stems.length, 8)
  assert.equal(get('bio-14-16').stems.length, 4)
  assert.doesNotMatch(get('bio-14-16').options.map(o => o.label).join(' '), /最直接|特异、快速|大规模/)
  assert.deepEqual(get('bio-15-06').options.map(o => o.label), ['L形', '三叶草形'])
  assert.deepEqual(get('bio-19-03').stems.map(s => s.answer.length), [1,1,1,1])
  assert.equal(get('bio-18-07').stems.length, 3)
  assert.ok(get('bio-07-10-focus-3').stems.every(s => !s.text.includes('①疾病')))
})
