import test from 'node:test'
import assert from 'node:assert/strict'
import { advancePractice, completePracticeGroup, groupHasResponses, HALF_HOUR, IDLE_LIMIT, newPractice, NOTICE_COOLDOWN, restorePractice, takePracticeNotice } from '../src/study-milestones.js'

test('only ten distinct completed groups earn the first group notice; redo does not inflate progress', () => {
  let state = newPractice(1000, () => 0)
  for (let n = 0; n < 9; n++) state = completePracticeGroup(state, `med:${n}`, 2000 + n)
  state = completePracticeGroup(state, 'med:0', 3000)
  assert.equal(takePracticeNotice(state, 3000), null)
  state = completePracticeGroup(state, 'surgery:0', 4000)
  const result = takePracticeNotice(state, 4000)
  assert.equal(result.notice.kind, 'groups')
  assert.equal(result.notice.groups, 10)
  assert.equal(takePracticeNotice(result.state, 5000), null)
})

test('half an hour is active time, with background, rest, and long inactivity excluded', () => {
  const initial = newPractice(1000, () => 0)
  assert.equal(advancePractice(initial, 1000, HALF_HOUR + 1000, true).activeMs, IDLE_LIMIT)
  assert.equal(advancePractice(initial, 1000, 10000, false).activeMs, 0)
  assert.equal(advancePractice({ ...initial, paused: true }, 1000, 10000, true).activeMs, 0)
  let state = initial
  for (let minute = 0; minute < 30; minute++) {
    const from = 1000 + minute * 60000
    state = advancePractice({ ...state, lastInteractionAt: from }, from, from + 60000, true)
  }
  assert.equal(takePracticeNotice(state, HALF_HOUR + 1000).notice.kind, 'time')
})

test('simultaneous milestones merge, and closely spaced notices wait instead of interrupting twice', () => {
  const state = { ...newPractice(1000, () => 0), groups: Array.from({ length: 10 }, (_, n) => String(n)), activeMs: HALF_HOUR }
  const both = takePracticeNotice(state, HALF_HOUR + 1000, () => 0)
  assert.equal(both.notice.kind, 'both')
  assert.equal(takePracticeNotice(both.state, HALF_HOUR + 2000), null)
  const later = { ...both.state, groups: Array.from({ length: 20 }, (_, n) => String(n)) }
  assert.equal(takePracticeNotice(later, HALF_HOUR + 2000), null)
  assert.equal(takePracticeNotice(later, HALF_HOUR + 1000 + NOTICE_COOLDOWN).notice.kind, 'groups')
})

test('reload preserves the session and shown milestones; a long break starts a new practice session', () => {
  const state = { ...newPractice(1000), groups: ['med:1'], activeMs: 5000 }
  assert.deepEqual(restorePractice(JSON.stringify(state), 2000), state)
  assert.deepEqual(restorePractice(JSON.stringify(state), HALF_HOUR + 1000, () => 0), newPractice(HALF_HOUR + 1000, () => 0))
  assert.deepEqual(restorePractice('invalid', 2000, () => 0), newPractice(2000, () => 0))
  assert.deepEqual(completePracticeGroup(state, 'med:2', HALF_HOUR + 1000).groups, ['med:2'])
})

test('surprise thresholds vary per session, survive reload, and reschedule only the due milestone', () => {
  const early = newPractice(1000, () => 0)
  const late = newPractice(1000, () => 0.999)
  assert.equal(early.nextGroups, 10)
  assert.equal(late.nextGroups, 12)
  assert.equal(early.nextActiveMs, HALF_HOUR)
  assert.equal(late.nextActiveMs, 35 * 60000)
  assert.deepEqual(restorePractice(JSON.stringify(late), 2000), late)
  const groups = Array.from({ length: 12 }, (_, i) => String(i))
  assert.equal(takePracticeNotice({ ...late, groups: groups.slice(0, 11) }, 2000), null)
  const notice = takePracticeNotice({ ...late, groups }, 2000, () => 0.999)
  assert.equal(notice.notice.kind, 'groups')
  assert.equal(notice.state.nextGroups, 24)
  assert.equal(notice.state.nextActiveMs, late.nextActiveMs)
  const timed = takePracticeNotice({ ...notice.state, activeMs: 35 * 60000 }, 2000 + NOTICE_COOLDOWN, () => 0)
  assert.equal(timed.notice.kind, 'time')
  assert.equal(timed.state.nextActiveMs, 65 * 60000)
  assert.equal(timed.state.nextGroups, 24)
})

test('existing practice sessions acquire a random schedule without losing completed work', () => {
  const old = { version: 1, groups: ['a'], activeMs: 1000, groupMilestone: 1, timeMilestone: 1, lastNoticeAt: 1000, lastInteractionAt: 1000, paused: false }
  const restored = restorePractice(JSON.stringify(old), 2000, () => 0.999)
  assert.deepEqual(restored.groups, old.groups)
  assert.equal(restored.activeMs, 1000)
  assert.equal(restored.nextGroups, 22)
  assert.equal(restored.nextActiveMs, 65 * 60000)
})

test('empty submissions do not count; fill blanks, sorting, and drafts must be completed', () => {
  assert.equal(groupHasResponses({ stems: [{ answerMode: '多选', answer: ['A'] }] }, {}), false)
  assert.equal(groupHasResponses({ stems: [{ answerMode: '多选', answer: ['A'] }] }, { 0: ['B'] }), true)
  assert.equal(groupHasResponses({ stems: [{ answerMode: '填空', answer: ['1', '45'] }] }, { 0: ['1', ''] }), false)
  assert.equal(groupHasResponses({ stems: [{ answerMode: '填空', answer: ['1', '45'] }] }, { 0: ['0', '45'] }), true)
  assert.equal(groupHasResponses({ stems: [{ answerMode: '排序', answer: ['A', 'B'] }] }, { 0: ['A'] }), false)
  assert.equal(groupHasResponses({ stems: [{ answerMode: '自评' }] }, { 0: ['  '] }), false)
})
