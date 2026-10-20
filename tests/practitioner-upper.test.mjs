import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)))
const med = read('med-practitioner-upper-data')
const surgery = read('surgery-practitioner-upper-data')
const groups = [...med.groups, ...surgery.groups]
const stems = groups.flatMap(g => g.stems)
const group = n => groups.find(g => g.stems.some(s => s.number === n))
const stem = n => stems.find(s => s.number === n)

test('all 197 questions occur once and match every supplied five-answer row', () => {
  assert.equal(med.meta.stemCount, 115)
  assert.equal(surgery.meta.stemCount, 82)
  assert.deepEqual(stems.map(s => s.number), Array.from({ length: 197 }, (_, i) => i + 1))
  const rows = [
    'CACDC','CCCBA','CABCA','BEDAD','CCACD','BCDDE','CABEB','EDEEE','ADDCE','AABED',
    'ACCED','ADBDE','DBACE','BCCCC','EEADB','ABADD','DBEEE','DEDCC','ABAEE','BDDEC',
    'BDECD','EBDAE','AAEBC','EBACA','BDAAE','EDBBC','DEBBE','BBDAA','BCACE','DDBEA',
    'DCEDA','EDCAC','CBEDB','ECBBD','ECDCC','ECDCE','CCBDA','EDADC','ECBDB','AA',
  ]
  assert.deepEqual(rows, Array.from({ length: 40 }, (_, i) => stems.slice(i * 5, i * 5 + 5).map(s => s.answerRaw).join('')))
  for (const s of stems) {
    const options = group(s.number).options.filter(o => !s.optionCategory || o.category === s.optionCategory)
    assert.deepEqual(options.map(o => o.displayKey), [...'ABCDE'], String(s.number))
    assert.ok(options.every(o => o.label.trim().length))
    assert.equal(options.find(o => o.key === s.answer[0])?.displayKey, ({24:'A',103:'A',139:'B',194:'C'})[s.number] || s.answerRaw)
  }
  assert.deepEqual(stem(139).answerCorrection, { from: 'A', to: 'B', source: '用户截图中的作者评论：139选B，气钡灌肠' })
  assert.equal(stem(24).answerRaw, 'C')
  assert.equal(stem(24).answerDisplay, 'A')
  assert.equal(stem(24).answerState, '按截图及明确更正录入')
  assert.equal(group(24).answerRevision, '20261019-q24-A-v3')
  assert.deepEqual(stem(24).answerCorrection, { from:'C', to:'A', source:'用户于2026-10-19明确确认：这道题选A' })
})

test('shared cases retain context, independent options, updates, and source pages', () => {
  assert.equal(groups.filter(g => g.sharedStem).length, 8)
  for (const g of groups.filter(g => g.sharedStem)) {
    assert.equal(g.sharedQuestionCount, g.stems.length)
    assert.ok(g.sharedStem.length > 10)
    assert.equal(g.options.length, g.stems.length * 5)
    assert.equal(new Set(g.options.map(o => o.key)).size, g.options.length)
  }
  assert.match(group(30).sharedStem, /190\/120mmHg/)
  assert.match(stem(31).text, /进一步心脏听诊.*127.*f\s*波/)
  assert.match(stem(187).text, /大小便障碍/)
  assert.deepEqual(group(125).sourcePages, [25, 26])
  assert.deepEqual(group(144).sourcePages, [29, 30])
  assert.deepEqual(group(160).sourcePages, [32, 33])
  assert.match(group(160).sharedStem, /左腰部被刺/)
  assert.doesNotMatch(group(159).options.at(-1).label, /左腰部被刺/)
})

test('ordinary questions and short cases have independent pages with full background', () => {
  assert.equal(med.groups.length, 107)
  assert.equal(surgery.groups.length, 74)
  assert.notEqual(group(26).id, group(27).id)
  for (const n of [5,6,11,12,26,27,36,37,63,64,73,74,100,101,108,109,121,122,125,126,131,132,158,159,163,164,186,187,191,192]) {
    assert.equal(group(n).stems.length, 1, String(n))
    assert.equal(group(n).options.length, 5)
    assert.match(stem(n).text, /[男女][，性]/, String(n))
    assert.ok(!group(n).sharedStem)
  }
  assert.match(stem(26).text, /65.*COPD.*27%/)
  assert.match(stem(27).text, /65.*COPD.*昏睡/)
})

test('shared option questions retain their choices on separate pages', () => {
  const common = groups.filter(g => g.kind === 'B')
  assert.deepEqual(common.map(g => g.stems.map(s => s.number)), [[170],[171],[172],[183],[184]])
  for (const g of common) {
    assert.equal(g.options.length, 5)
    assert.ok(g.stems.every(s => !s.optionCategory))
  }
  assert.match(stem(170).text, /对侧肾正常/)
  assert.match(stem(171).text, /重度积水伴尿毒症/)
  assert.match(stem(172).text, /虫蚀样改变/)
  assert.match(stem(183).text, /Allis/)
  assert.match(stem(184).text, /Hippocrates/)
})

test('knowledge chapters exist, and all original page references are usable', () => {
  for (const [subject, data] of [['med', med], ['surgery', surgery]]) {
    const base = read(`${subject}-data`)
    for (const g of data.groups) {
      for (const lid of g.lectureIds) assert.ok([...base.lectures, ...(data.lectures || [])].some(l => l.id === lid), `${g.id}: ${lid}`)
      assert.ok(g.stems.every(s => g.lectureIds.includes(s.lectureId)))
      for (const p of g.sourcePages) {
        const page = data.pages.find(x => x.sourceKey === g.sourceKey && x.page === p)
        assert.ok(page)
        assert.ok(existsSync(resolve('public', page.image)))
      }
    }
    assert.equal(new Set([...base.groups, ...data.groups].map(g => g.id)).size, base.groups.length + data.groups.length)
  }
  for (const [n, lid] of [[24,10],[72,21],[89,33],[106,38],[116,30],[119,37],[139,8],[162,19],[172,18],[191,24],[197,25]])
    assert.equal(stem(n).lectureId, `lecture-${String(lid).padStart(2, '0')}`)
  assert.equal(group(116).topic, '外科总论')
  assert.equal(group(139).topic, '小肠与阑尾疾病')
  assert.equal(group(197).topic, '骨科')
})

test('every question links to existing exact lecture pages, and large cases retain all references', () => {
  for (const g of groups) {
    assert.deepEqual(g.lectureEvidence, g.lectureEvidencePages[0])
    assert.equal(new Set(g.lectureEvidencePages.map(e => e.image)).size, g.lectureEvidencePages.length)
    for (const s of g.stems) {
      assert.ok(s.lectureEvidencePages.length, String(s.number))
      for (const ref of s.lectureEvidencePages) {
        const lecture = read(`${ref.sourceSubject}-data`).lectures.find(l => l.number === ref.lectureNumber)
        assert.ok(lecture, `${s.number}: ${ref.title}`)
        assert.equal(ref.sourceFile, lecture.file)
        assert.ok(ref.page > 0 && ref.page <= lecture.pageCount)
        assert.ok(existsSync(resolve('public', ref.image)), `${s.number}: ${ref.image}`)
        const combined = g.lectureEvidencePages.find(e => e.image === ref.image)
        assert.ok(combined.questionNumbers.includes(s.number))
        assert.ok(combined.knowledgePoints.includes(s.knowledgePoint))
      }
    }
  }
  assert.equal(group(30).lectureEvidencePages.length, 3)
  assert.match(group(24).lectureEvidence.image, /med\/lecture-pages\/lecture-10-page-02/)
  assert.match(group(68).lectureEvidence.image, /surgery\/lecture-pages\/lecture-14-page-02/)
  assert.equal(stem(133).lectureId, 'med-lecture-12')
  assert.equal(group(133).lectureEvidence.sourceSubject, 'med')
  assert.equal(stem(156).lectureId, 'lecture-06')
  assert.equal(stem(169).lectureId, 'lecture-12')
  assert.equal(stem(188).lectureId, 'lecture-27')
})

test('all questions have authored explanations; uncertain supplied answers are not silently replaced', () => {
  assert.deepEqual(stems.filter(s => s.answerState === '待原题页核对').map(s => s.number), [72,74,89,90,162,172])
  for (const s of stems) {
    assert.ok(s.explanation.length > 25, String(s.number))
    assert.ok(s.knowledgePoint.length > 3)
    assert.equal(s.knowledgeConnections.length, 1)
    assert.match(s.explanationOrigin, /非.*官方/)
    assert.doesNotMatch(s.text, /ttsx|每日计划|加油鸭|ACA/)
    for (const match of s.explanation.matchAll(/(?:本卷选|故选|所列选|本题选)([A-E])/g))
      assert.equal(match[1], s.answerDisplay, `explanation/key mismatch: ${s.number}`)
    if (s.answerState === '待原题页核对') assert.ok(s.reviewReason)
    for (const ref of s.explanationReferences || []) assert.match(ref.url, /^https:\/\//)
  }
  assert.equal(stem(103).answerRaw, 'E')
  assert.equal(stem(103).answerDisplay, 'A')
  assert.deepEqual(stem(103).answer, ['q103-A'])
  assert.equal(group(103).answerSourceLabel, '截图及用户更正')
  assert.equal(group(103).answerRevision, '20261020-q103-A-v3')
  assert.deepEqual(group(103).stems.map(s => s.answerDisplay), ['D', 'A', 'C'])
  assert.deepEqual(stem(103).answerCorrection, { from:'E', to:'A', source:'用户于2026-10-20明确确认：第102～104题题组的第二小题选A' })
  assert.match(stem(103).explanation, /本题选A.*0.9%生理盐水.*不需常规补碳酸氢钠.*不能.*选择E/)
  assert.equal(stem(103).explanationReferences[0].url, 'https://doi.org/10.2337/dci24-0032')
})

test('confirmed question106 E is graded normally and invalidates the old pending attempt', () => {
  assert.equal(stem(106).answerRaw, 'E')
  assert.deepEqual(stem(106).answer, ['q106-E'])
  assert.equal(stem(106).answerDisplay, 'E')
  assert.equal(stem(106).answerState, '按截图及明确更正录入')
  assert.ok(!stem(106).reviewReason)
  assert.deepEqual(stem(106).answerConfirmation, { answer:'E', source:'用户于2026-10-20明确确认：第105～107题题组的第二小题选E' })
  assert.equal(group(106).answerRevision, '20261020-q106-E-confirmed-v3')
  assert.equal(group(106).answerSourceLabel, '截图及用户确认')
  assert.deepEqual(group(106).stems.map(s => s.answerDisplay), ['D', 'E', 'B'])
  assert.ok(group(106).stems.every(s => s.answerState !== '待原题页核对'))
  assert.ok(!med.meta.pendingQuestions.includes(106))
  assert.match(stem(106).explanation, /本题选E（玻璃体切割术）/)
  assert.doesNotMatch(stem(106).explanation, /待复核|难认定|争议/)
})

test('question194 uses local MRI C after X-ray localisation, with a fresh grading revision', () => {
  assert.equal(stem(194).answerRaw, 'D')
  assert.deepEqual(stem(194).answer, ['C'])
  assert.equal(stem(194).answerDisplay, 'C')
  assert.equal(group(194).options.find(o => o.key === 'C').label, '右髋关节 MRI')
  assert.equal(group(194).answerRevision, '20261020-q194-C-v3')
  assert.equal(group(194).answerSourceLabel, '用户确认答案')
  assert.equal(stem(194).answerState, '按截图及明确更正录入')
  assert.deepEqual(stem(194).answerCorrection, { from:'D', to:'C', source:'用户于2026-10-20明确确认：X线已定位右股骨颈及转子区域病灶，第194题选C' })
  assert.match(stem(194).explanation, /本题选C.*位置已经明确.*局部MRI/)
  assert.match(group(194).title, /局部MRI评估/)
  assert.ok(group(194).lectureEvidence.knowledgePoints.includes(stem(194).knowledgePoint))
})
