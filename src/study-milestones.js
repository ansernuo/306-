export const HALF_HOUR = 30 * 60 * 1000
export const IDLE_LIMIT = 5 * 60 * 1000
export const NOTICE_COOLDOWN = 5 * 60 * 1000

const groupInterval = random => 10 + Math.floor(random() * 3)
const timeInterval = random => (30 + Math.floor(random() * 6)) * 60000

export function newPractice(now, random = Math.random) {
  return { version: 1, groups: [], activeMs: 0, groupMilestone: 0, timeMilestone: 0, nextGroups: groupInterval(random), nextActiveMs: timeInterval(random), lastNoticeAt: 0, lastInteractionAt: now, paused: false }
}

export function restorePractice(raw, now, random = Math.random) {
  try {
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !Array.isArray(value.groups) || !value.groups.every(id => typeof id === 'string')
      || !['activeMs', 'groupMilestone', 'timeMilestone', 'lastNoticeAt', 'lastInteractionAt'].every(key => Number.isFinite(value[key]) && value[key] >= 0)
      || now - value.lastInteractionAt >= HALF_HOUR || value.lastInteractionAt > now) return newPractice(now, random)
    return { ...value, groups: [...new Set(value.groups)], paused: Boolean(value.paused),
      nextGroups: Number.isSafeInteger(value.nextGroups) && value.nextGroups > 0 ? value.nextGroups : value.groupMilestone * 10 + groupInterval(random),
      nextActiveMs: Number.isSafeInteger(value.nextActiveMs) && value.nextActiveMs > 0 ? value.nextActiveMs : value.timeMilestone * HALF_HOUR + timeInterval(random) }
  } catch { return newPractice(now, random) }
}

export function completePracticeGroup(state, id, now) {
  const current = now - state.lastInteractionAt >= HALF_HOUR ? newPractice(now) : state
  return { ...current, groups: current.groups.includes(id) ? current.groups : [...current.groups, id], lastInteractionAt: now }
}

export function advancePractice(state, from, now, active) {
  if (!active || state.paused) return state
  const until = Math.min(now, state.lastInteractionAt + IDLE_LIMIT)
  return { ...state, activeMs: state.activeMs + Math.max(0, until - from) }
}

export function takePracticeNotice(state, now, random = Math.random) {
  const groupMilestone = Math.floor(state.groups.length / 10)
  const timeMilestone = Math.floor(state.activeMs / HALF_HOUR)
  const groupsDue = state.groups.length >= state.nextGroups
  const timeDue = state.activeMs >= state.nextActiveMs
  if ((!groupsDue && !timeDue) || (state.lastNoticeAt && now - state.lastNoticeAt < NOTICE_COOLDOWN)) return null
  return {
    state: { ...state, groupMilestone, timeMilestone, lastNoticeAt: now,
      nextGroups: groupsDue ? state.groups.length + groupInterval(random) : state.nextGroups,
      nextActiveMs: timeDue ? state.activeMs + timeInterval(random) : state.nextActiveMs },
    notice: { kind: groupsDue && timeDue ? 'both' : groupsDue ? 'groups' : 'time', groups: state.groups.length, minutes: Math.floor(state.activeMs / 60000) },
  }
}

export function groupHasResponses(group, selections) {
  return group.stems.length > 0 && group.stems.every((stem, index) => {
    const values = selections[index] || []
    if (stem.answerMode === '填空') return stem.answer?.length > 0 && values.length >= stem.answer.length && stem.answer.every((_, blank) => String(values[blank] ?? '').trim())
    if (stem.answerMode === '自评') return Boolean(String(values[0] ?? '').trim())
    if (stem.answerMode === '排序') return values.length > 0 && values.length >= (stem.answer?.length || 0)
    return values.length > 0
  })
}
