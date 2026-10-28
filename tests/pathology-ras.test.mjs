import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyReviewedEvidence, lectureForStem } from '../src/med-lecture-evidence.js'

const root = new URL('../', import.meta.url)
const bank = JSON.parse(readFileSync(new URL('src/data/pathology-data.json', root)))
const review = JSON.parse(readFileSync(new URL('src/data/pathology-reviewed-lecture-evidence.json', root)))
const group = bank.groups.find(g => g.id === 'p36-g1')
const ras = group.stems.find(s => s.text === 'RAS')

test('RAS includes colorectal L, excludes mantle-cell K, and retains all six choices', () => {
  assert.deepEqual(ras.answer, ['E', 'F', 'H', 'J', 'L', '①'])
  assert.equal(ras.answerMode, '多选')
  assert.equal(ras.sourceText, 'RAS（EFHJL①）')
  assert.deepEqual(ras.answer.map(k => group.options.find(o => o.key === k).label), [
    '胰腺癌', '白血病', '膀胱癌', '肺癌', '大肠癌', '小G蛋白',
  ])
  assert.ok(!ras.answer.includes('K'))
  assert.ok(group.sourceText.includes('RAS（EFHJL①）'))
  assert.ok(!group.sourceText.includes('RAS（EFHJK①）'))
})

test('the other eight oncogene answers and all option identities stay unchanged', () => {
  assert.equal(group.options.length, 22)
  assert.equal(group.options.find(o => o.key === 'K').label, '套细胞淋巴瘤')
  assert.equal(group.options.find(o => o.key === 'L').label, '大肠癌')
  assert.deepEqual(group.stems.filter(s => s.text !== 'RAS').map(s => [s.text, s.answer.join('')]), [
    ['PDGF', 'AC'], ['BRAF', 'N②'], ['ABL', 'BI③'], ['ERBB2/HER2', 'DGJQ③'],
    ['KIT', 'MR③'], ['c-MYC', 'O'], ['MYC', 'S'], ['CyclinD1', 'KT'],
  ])
  assert.equal(bank.groups.length, 77)
  assert.equal(bank.groups.flatMap(g => g.stems).length, 315)
})

test('RAS retains its exact lecture page and no longer displays a pending discrepancy', () => {
  const updated = applyReviewedEvidence({groups:[group]}, review).groups[0]
  const page = lectureForStem(updated, 1)
  assert.equal(page.page, 221)
  assert.equal(page.sourceFile, '27病理精编版合集【带导图】.pdf')
  assert.ok(existsSync(new URL(`public/${page.image}`, root)))
  assert.equal(updated.lectureEvidenceNotice, undefined)
  assert.equal(review.groups[group.id].notice, undefined)
  assert.match(review.groups[group.id].reviewNote, /已修正本题答案/)
})

test('only this group receives a fresh answer-storage revision, keeping stable favorite and note IDs', () => {
  assert.equal(group.id, 'p36-g1')
  assert.equal(group.answerRevision, 'ras-colorectal-20261028-v2')
  assert.equal(bank.groups.find(g => g.id === 'p36-g2').answerRevision, undefined)
  assert.equal(bank.groups.find(g => g.id === 'p23-g1').answerRevision, 'ulcer-locations-20261025-v2')
})

test('manual reconstruction and finalization both preserve the RAS fix on repeated builds', () => {
  const result = spawnSync('python3', ['-c', `
import sys, json, copy
sys.path.insert(0, 'scripts')
from pathology_manual_pages import manual_groups_for_page, repair_ras_tumors
from finalize_pathology_content import repair_and_restore
with open('src/data/pathology-data.json') as f:
    bank = json.load(f)
actual = next(g for g in bank['groups'] if g['id'] == 'p36-g1')
manual = manual_groups_for_page(36)[0]
assert manual['answerRevision'] == actual['answerRevision']
assert manual['options'] == actual['options']
for a, b in zip(manual['stems'], actual['stems'], strict=True):
    for key in ('text', 'answer', 'answerMode', 'sourceText'):
        assert a[key] == b[key], key
before = copy.deepcopy(actual)
repair_ras_tumors(actual)
assert before == actual
restored = repair_and_restore(copy.deepcopy(bank['groups']))
assert next(g for g in restored if g['id'] == 'p36-g1') == actual
`], {cwd:root,encoding:'utf8'})
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
