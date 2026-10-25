import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const bank = JSON.parse(readFileSync(new URL('src/data/pathology-data.json', root)))
const group = bank.groups.find(g => g.id === 'p23-g1')

test('ulcer locations have unique shared options without duplicate B/H or D/J', () => {
  assert.deepEqual(group.options.map(o => o.key), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'K'])
  assert.equal(new Set(group.options.map(o => o.label)).size, group.options.length)
  assert.equal(group.options.find(o => o.key === 'B').label, '直肠和乙状结肠')
  assert.equal(group.options.find(o => o.key === 'D').label, '胃窦小弯侧')
  assert.equal(bank.groups.length, 77)
  assert.equal(bank.groups.flatMap(g => g.stems).length, 315)
})

test('all ten location answers agree with lecture 21 page 6', () => {
  assert.deepEqual(group.stems.map(s => [s.text, s.answer.join('')]), [
    ['肠结核', 'A'], ['肠伤寒', 'F'], ['细菌性痢疾', 'B'], ['阿米巴', 'G'],
    ['溃疡性结肠炎', 'B'], ['克罗恩病', 'C'], ['消化性溃疡', 'DI'],
    ['胃癌溃疡型', 'D'], ['胃泌素瘤', 'K'], ['应激性溃疡', 'E'],
  ])
  for (const stem of group.stems) {
    assert.equal(stem.answerMode, stem.text === '消化性溃疡' ? '多选' : '单选')
    assert.equal(stem.sourceText, `${stem.text}（${stem.answer.join('')}）`)
    assert.ok(stem.answer.every(k => group.options.some(o => o.key === k)))
    assert.equal(stem.lectureEvidence.lectureId, 'lecture-21')
    assert.equal(stem.lectureEvidence.page, 6)
    assert.ok(existsSync(new URL(`public/${stem.lectureEvidence.image}`, root)))
  }
})

test('only the repaired group gets a new answer revision; neighboring group stays intact', () => {
  assert.equal(group.id, 'p23-g1')
  assert.equal(group.answerRevision, 'ulcer-locations-20261025-v2')
  const neighbor = bank.groups.find(g => g.id === 'p23-g2')
  assert.equal(neighbor.answerRevision, undefined)
  assert.deepEqual(neighbor.stems.map(s => s.answer.join('')), ['A', 'F', 'B', 'G', 'H', 'C', 'I', 'D', 'J', 'E'])
})

test('manual rebuild and finalizer preserve the same repair and are repeatable', () => {
  const result = spawnSync('python3', ['-c', `
import sys, json, copy
sys.path.insert(0, 'scripts')
from pathology_manual_pages import manual_groups_for_page, repair_ulcer_locations
from finalize_pathology_content import repair_and_restore
with open('src/data/pathology-data.json') as f:
    bank = json.load(f)
actual = next(g for g in bank['groups'] if g['id'] == 'p23-g1')
manual = manual_groups_for_page(23)[0]
for key in ('options', 'sourceText', 'answerRevision'):
    assert manual[key] == actual[key], key
for a, b in zip(manual['stems'], actual['stems'], strict=True):
    for key in ('text', 'answer', 'answerMode', 'sourceText'):
        assert a[key] == b[key], key
before = copy.deepcopy(actual)
repair_ulcer_locations(actual)
assert actual == before
restored = repair_and_restore(copy.deepcopy(bank['groups']))
assert next(g for g in restored if g['id'] == 'p23-g1') == before
print('manual rebuild, finalizer, and repeated repair passed')
`], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
