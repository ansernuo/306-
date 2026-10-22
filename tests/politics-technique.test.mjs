import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=name=>JSON.parse(readFileSync(new URL(`../src/data/${name}.json`,import.meta.url)))
const data=read('politics-technique-data')
test('technique homework covers eight source matching sets, all judgements and explicit fill exercises by subject',()=>{
 assert.equal(data.groups.length,21)
 const count=kind=>data.groups.filter(g=>g.kindLabel===kind).flatMap(g=>g.stems).length
 assert.equal(count('匹配 / 归类'),75)
 assert.equal(count('判断订正'),78)
 assert.equal(count('填空题'),14)
 assert.deepEqual(data.topics.map(topic=>data.groups.filter(g=>g.topic===topic).flatMap(g=>g.stems).length),[67,18,21,42,19])
 for(const g of data.groups){
  assert.equal(g.page,g.pdfPage-7)
  assert.ok(data.lectures.some(l=>l.id===g.lectureIds[0]&&l.topic===g.topic))
  assert.ok(data.referenceImages[g.lectureEvidence.image].startsWith('data:image/webp;base64,'))
  for(const s of g.stems){
   assert.ok(s.text&&s.answer.length&&s.explanation)
   assert.ok(s.answerPdfPage>=1&&s.answerPdfPage<=9)
   assert.ok(!/微信|公众号|19316|。S|。5/.test(s.text+s.explanation))
   if(s.answerMode!=='填空')assert.ok(s.answer.every(a=>g.options.some(o=>o.key===a)))
  }
 }
})
test('matching keys and judgement decisions agree with the visually checked answer sheet',()=>{
 const keys={49:'CHAGIJDBEF',51:'IHJFBD AEGC'.replaceAll(' ',''),53:'EHJFADIBGC',58:'EIFGBCD JAH'.replaceAll(' ',''),61:'EFGHABCD',65:'FEHBAIDGC',68:'DFHIGBECA',70:'IHEF GBCDA'.replaceAll(' ','')}
 const judgements={48:'BABABABABB',50:'BABABBBBBB',52:'BBABBABBBB',57:'BBBABBBBAB',60:'BABABAAAB',64:'BAABBABABB',67:'BBBABBAAB',69:'BBAABBBABA'}
 for(const g of data.groups){
  if(g.kindLabel==='匹配 / 归类'&&keys[g.pdfPage])assert.equal(g.stems.map(s=>s.answer[0]).join(''),keys[g.pdfPage],g.id)
  if(judgements[g.pdfPage])assert.equal(g.stems.map(s=>s.answer[0]).join(''),judgements[g.pdfPage],g.id)
 }
 const politicalEconomy=data.groups.find(g=>g.pdfPage===54)
 assert.deepEqual(politicalEconomy.stems.map(s=>s.number),[2,3,4],'original no-answer drawing stays excluded')
 assert.deepEqual(data.groups.find(g=>g.pdfPage===69).stems.map(s=>s.answerPdfPage),[8,8,8,8,8,8,8,8,9,9])
})
test('all existing practice IDs are preserved without collisions',()=>{
 const old=[...read('politics-data').groups,...read('politics-selftest-data').groups]
 assert.equal(old.length,24)
 assert.equal(old.flatMap(g=>g.stems).length,166)
 assert.equal(new Set([...old,...data.groups].map(g=>g.id)).size,45)
})
