import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync(new URL('../src/data/politics-selftest-data.json', import.meta.url)))
const practice = JSON.parse(readFileSync(new URL('../src/data/politics-data.json', import.meta.url)))

test('all 17 original matching exercises retain their source pages, item counts and numbering', () => {
  const expected = [[15,11,10],[38,34,6],[49,45,10],[53,49,5],[81,78,10],[93,90,5],[98,95,6],[112,111,9],[124,123,8],[136,135,8],[150,149,8],[172,173,10],[185,186,6],[199,200,7],[211,213,10],[224,226,10],[234,236,8]]
  assert.deepEqual(data.groups.map(g => [g.pdfPage,g.page,g.stems.length]), expected)
  assert.equal(data.groups.flatMap(g=>g.stems).length,136)
  assert.equal(new Set([...data.groups,...practice.groups].map(g=>g.id)).size,24)
  for(const g of data.groups) {
    assert.equal(g.options.length,g.stems.length,g.id)
    assert.deepEqual(g.stems.map(s=>s.number),Array.from({length:g.stems.length},(_,i)=>i+1))
    assert.deepEqual(g.options.map(o=>o.key),Array.from({length:g.options.length},(_,i)=>String.fromCharCode(65+i)))
    assert.deepEqual(g.options.map(o=>o.sourceNumber),g.stems.map(s=>s.number))
    assert.ok(data.referenceImages[g.lectureEvidence.image]?.startsWith('data:image/webp;base64,'))
  }
})
test('unprovided answers cannot be scored or displayed as solutions', () => {
  for(const g of data.groups) {
    assert.equal(g.pendingAnswers,true)
    for(const s of g.stems) {
      assert.deepEqual(s.answer,[])
      assert.equal(s.answerState,'待补答案')
      assert.equal(s.answerMode,'单选')
      assert.ok(s.text.trim())
      assert.ok(!s.explanation && !s.answerDisplay && !s.acceptedAnswers)
    }
    assert.ok(g.options.every(o=>o.label.trim().length))
  }
})
test('column continuations and OCR confusions preserve the visually reviewed source text', () => {
  const page=n=>data.groups.find(g=>g.pdfPage===n)
  assert.equal(page(15).options[0].label,'思维的物质外壳和现实形式')
  assert.equal(page(15).stems[5].text,'具体时空')
  assert.equal(page(38).options[0].label,'实现社会形态更替的重要手段和决定性环节')
  assert.equal(page(81).options[9].label,'没收官僚资本归新民主主义国家所有')
  assert.equal(page(185).options[5].label,'五卅运动')
  assert.equal(page(211).options[3].label,'摇篮、胎记、精神基因')
  assert.equal(page(234).options[1].label,'完备的法律规范体系')
})
