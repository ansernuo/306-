import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const load = n => JSON.parse(readFileSync(new URL(`../src/data/${n}.json`, import.meta.url)))
const banks = [load('biochemistry-data'), ...Array.from({ length: 19 }, (_, i) => load(`biochemistry-lecture${i + 2}-data`)), load('biochemistry-teacher-supplement')]
const groups = new Map(banks.flatMap(b => b.groups).map(g => [g.id, g]))
const group = id => { assert.ok(groups.has(id), id); return groups.get(id) }
const stem = (id, n) => { const s = group(id).stems.find(s => s.number === n); assert.ok(s, `${id}/${n}`); return s }
const labels = (id, n) => stem(id, n).answer.map(key => group(id).options.find(o => o.key === key).label)

test('all 20 lectures and homework keep valid IDs, counts, answer types and option scopes', () => {
  assert.equal(groups.size, 207)
  assert.equal(banks.flatMap(b => b.groups.flatMap(g => g.stems)).length, 985)
  for (const bank of banks) {
    assert.equal(bank.meta.groupCount, bank.groups.length)
    assert.equal(bank.meta.stemCount, bank.groups.reduce((n, g) => n + g.stems.length, 0))
    for (const g of bank.groups) {
      assert.equal(new Set(g.options.map(o => o.key)).size, g.options.length, g.id)
      assert.equal(new Set(g.stems.map(s => s.number)).size, g.stems.length, g.id)
      assert.equal(new Set(g.stems.map(s => `${s.optionCategory || ''}:${s.text.replace(/\s/g, '')}`)).size, g.stems.length, g.id)
      for (const s of g.stems) {
        assert.ok(s.answer.length, `${g.id}/${s.number}`)
        if (s.answerMode === '填空') {
          if (s.answerDisplay !== undefined) assert.equal(s.answerDisplay, s.answer.join('；'), `${g.id}/${s.number}: displayed answer`)
          assert.equal((s.text.match(/_{3,}/g) || []).length, s.answer.length)
          for (const a of s.acceptedAnswers || []) assert.equal(a.length, s.answer.length)
          continue
        }
        const options = g.options.filter(o => !s.optionCategory || o.category === s.optionCategory)
        for (const k of s.answer) assert.ok(options.some(o => o.key === k), `${g.id}/${s.number}: ${k}`)
        if (s.answerMode === '排序') continue
        assert.equal(s.answerMode, s.answer.length > 1 ? '多选' : '单选')
        let raw = s.answerRaw.match(/[A-Z]+/g) || []
        if (!options.some(o => o.key.length > 1)) raw = raw.join('').split('')
        assert.deepEqual(raw, s.answer.map(k => options.find(o => o.key === k).displayKey || k))
      }
      if (g.lectureEvidence?.image) assert.ok(existsSync(new URL(`../public/${g.lectureEvidence.image}`, import.meta.url)), g.id)
    }
  }
})

test('vitamin display alphabet is synchronized without reshuffling its approved pool', () => {
  const g = group('bio-13-03')
  assert.equal(g.options.length, 41)
  for (const s of g.stems) {
    assert.equal(s.answerRaw, s.answer.map(k => g.options.find(o => o.key === k).displayKey || k).join('、'))
  }
  assert.equal(group('bio-13-01').stems[2].answer.length, 4, 'preserve ADEK lecture classification with molecular-form qualification')
})

test('shared biochemical mechanisms receive complete answers', () => {
  assert.ok(stem('bio-18-03', 6).answer.includes('F'), 'EF-G is a GTPase')
  assert.ok(stem('bio-17-05', 1).answer.includes('I'), 'cap participates in translation initiation')
  assert.ok(stem('bio-17-05', 2).answer.includes('I'), 'polyA also participates in translation initiation')
  assert.deepEqual(new Set(stem('bio-08-02', 3).answer), new Set(['A', 'B', 'D', 'G', 'M']))
  assert.deepEqual(stem('bio-07-10', 2).answer, ['P'], 'Trp has the highest molar absorbance, not two tied maxima')
  assert.match(labels('bio-03-04', 4).join(' '), /内质网/)
})

test('drug targets and RNA recognition describe the actual chemistry', () => {
  assert.match(labels('bio-09-07', 4).join(' '), /尿嘧啶/)
  assert.match(labels('bio-09-08', 3).join(' '), /DNA聚合酶/)
  assert.doesNotMatch(labels('bio-09-08', 2).join(' '), /合成嘌呤核苷酸/)
  assert.match(labels('bio-18-08', 3).join(' '), /ADP-核糖基化/)
  assert.match(labels('bio-18-08', 4).join(' '), /脱嘌呤/)
  assert.match(labels('bio-17-08', 4).join(' '), /rut/)
  assert.match(labels('bio-20-06', 4).join(' '), /不是碱基切除修复的同义词/)
})

test('duplicate translation questions are merged while both mechanisms remain', () => {
  const g = group('bio-18-08')
  assert.equal(g.stems.length, 12)
  assert.deepEqual(g.stems.map(s => s.number), Array.from({ length: 12 }, (_, i) => i + 1))
  assert.equal(g.stems.filter(s => s.text === '白喉毒素').length, 1)
  assert.equal(g.stems.filter(s => s.text === '伊短菌素').length, 1)
  assert.deepEqual(new Set(stem(g.id, 3).answer), new Set(['M', 'I', 'K']))
  assert.match(labels(g.id, 12).join(' '), /eIF2/)
})

test('question structure distinguishes a definition, an example and a measurement', () => {
  assert.deepEqual(stem('bio-08-04', 1).answer, ['D', 'H'])
  assert.deepEqual(stem('bio-08-04', 4).answer, ['C'])
  assert.deepEqual(stem('bio-20-01', 4).answer, ['G'])
  assert.deepEqual(stem('bio-20-01', 5).answer, ['C'])
  assert.match(stem('bio-20-01', 2).text, /CDS/)
  assert.match(stem('biochemistry-teacher-01-16', 16).text, /ρ依赖性/)
  assert.match(stem('biochemistry-teacher-01-27', 27).text, /特异性/)
  for (const id of ['biochemistry-teacher-01-16', 'biochemistry-teacher-01-27', 'biochemistry-teacher-01-28']) {
    assert.equal(group(id).title, group(id).stems[0].text)
  }
})

test('unordered fill-in lists accept all valid permutations and protect stored answers', () => {
  for (const [id, n, count] of [['bio-15-fill-03', 15, 5], ['bio-15-fill-04', 20, 5], ['bio-15-fill-04', 24, 1], ['bio-15-fill-04', 25, 5]]) {
    assert.equal(stem(id, n).acceptedAnswers.length, count)
    assert.equal(group(id).answerRevision, 'bio-review-20261017')
  }
  assert.deepEqual(stem('bio-16-fill-02', 11).answer, ['相同', '连续', '相反', '不连续', '冈崎片段'])
  assert.equal(group('bio-18-08').answerRevision, 'bio-review-20261017')
})
