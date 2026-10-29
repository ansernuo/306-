import { useCallback, useEffect, useRef, useState } from 'react'
import { advancePractice, completePracticeGroup, HALF_HOUR, newPractice, restorePractice, takePracticeNotice } from './study-milestones.js'
import { drawEncouragement } from './encouragements.js'

const SESSION_KEY = 'study-practice-session-v1'
const MESSAGE_KEY = 'study-encouragement-deck-v3'

export function usePracticeEncouragement(enabled, blocked) {
  const session = useRef(null)
  const [notice, setNotice] = useState(null)
  const noticeRef = useRef(null)
  const initialized = useRef(false)
  const messageDeck = useRef(null)
  const save = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session.current)) } catch { /* Practice still works without storage. */ }
  }, [])
  useEffect(() => {
    if (!initialized.current) {
      try { session.current = restorePractice(sessionStorage.getItem(SESSION_KEY), Date.now()) } catch { session.current = newPractice(Date.now()) }
      initialized.current = true
    }
    if (!enabled) return undefined
    let previousTick = Date.now()
    let wasVisible = document.visibilityState === 'visible' && document.hasFocus()
    function interact(event) {
      if (noticeRef.current || event.target?.closest?.('.encouragement-dialog')) return
      const now = Date.now()
      if (now - session.current.lastInteractionAt >= HALF_HOUR) session.current = newPractice(now)
      session.current.lastInteractionAt = now
      session.current.paused = false
    }
    function tick() {
      const now = Date.now()
      const visible = document.visibilityState === 'visible' && document.hasFocus()
      session.current = advancePractice(session.current, previousTick, now, wasVisible && !noticeRef.current)
      previousTick = now
      wasVisible = visible
      if (visible && !blocked && !noticeRef.current && !session.current.paused
        && !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) {
        const next = takePracticeNotice(session.current, now)
        if (next) {
          session.current = next.state
          let storedDeck = messageDeck.current
          try { storedDeck = localStorage.getItem(MESSAGE_KEY) || storedDeck } catch { /* Keep a deck in memory. */ }
          const drawn = drawEncouragement(storedDeck)
          messageDeck.current = JSON.stringify(drawn.state)
          try { localStorage.setItem(MESSAGE_KEY, messageDeck.current) } catch { /* Practice still works without storage. */ }
          noticeRef.current = { ...next.notice, message: drawn.message, quote: drawn.quote }
          setNotice(noticeRef.current)
        }
      }
      save()
    }
    // Visibility/focus events settle the preceding interval before a hidden tab can accrue time.
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('pointerdown', interact, true)
    window.addEventListener('keydown', interact, true)
    window.addEventListener('wheel', interact, { passive: true })
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('blur', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pointerdown', interact, true)
      window.removeEventListener('keydown', interact, true)
      window.removeEventListener('wheel', interact)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('blur', tick)
      window.removeEventListener('focus', tick)
      save()
    }
  }, [enabled, blocked, save])
  const recordCompletion = useCallback(id => {
    if (!session.current) return
    session.current = completePracticeGroup(session.current, id, Date.now())
    save()
  }, [save])
  const dismiss = useCallback((pause = false) => {
    session.current.paused = pause
    session.current.lastInteractionAt = Date.now()
    noticeRef.current = null
    setNotice(null)
    save()
  }, [save])
  return { notice, recordCompletion, dismiss }
}

export function EncouragementDialog({ notice, onDismiss }) {
  const dialog = useRef(null)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss
  useEffect(() => {
    const previous = document.activeElement
    dialog.current.querySelector('.primary-button').focus({ preventScroll: true })
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissRef.current(false) }
      if (event.key === 'Tab') {
        const buttons = [...dialog.current.querySelectorAll('button, a[href]')]
        const first = buttons[0], last = buttons.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', keydown, true)
    return () => { window.removeEventListener('keydown', keydown, true); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  const title = notice.kind === 'groups' ? `这一轮，已完成 ${notice.groups} 组。`
    : notice.kind === 'time' ? `已经练习 ${notice.minutes} 分钟了。` : `${notice.groups} 组，${notice.minutes} 分钟。`
  return <div className="modal-backdrop encouragement-backdrop" onClick={() => onDismiss(false)}>
    <section ref={dialog} className="encouragement-dialog" role="dialog" aria-modal="true" aria-labelledby="encouragement-title" aria-describedby="encouragement-message encouragement-attribution" onClick={event => event.stopPropagation()}>
      <button className="encouragement-close" aria-label="关闭鼓励" onClick={() => onDismiss(false)}>×</button>
      <span className="encouragement-eyebrow"><span aria-hidden="true">✨</span> 送你一句话</span>
      <h2 id="encouragement-title">{title}</h2>
      <blockquote className="encouragement-quote">
        <p id="encouragement-message">{notice.message}</p>
        <footer id="encouragement-attribution" className="encouragement-attribution">
          <div>— {notice.quote.author} <cite>《{notice.quote.work}》</cite></div>
          <a className="encouragement-source" href={notice.quote.url} target="_blank" rel="noopener noreferrer">{notice.quote.original ? '查看原文 · 中文为本站译文' : '查看出处'} <span aria-hidden="true">↗</span></a>
        </footer>
      </blockquote>
      <div className="encouragement-actions"><button className="ghost-button" onClick={() => onDismiss(true)}>休息一下</button><button className="primary-button" onClick={() => onDismiss(false)}>继续练习 <span aria-hidden="true">→</span></button></div>
    </section>
  </div>
}

export function VisitorCount() {
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    let active = true
    let visitorId
    try {
      visitorId = localStorage.getItem('study-visitor-id')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId || '')) { visitorId = crypto.randomUUID(); localStorage.setItem('study-visitor-id', visitorId) }
    } catch { visitorId = crypto.randomUUID() }
    const api = location.hostname.endsWith('.github.io') ? 'https://neike-306-tiku.phamkhanhs87501.chatgpt.site/api/visits' : '/api/visits'
    fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId }) })
      .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json() })
      .then(value => { if (active && Number.isInteger(value.todayVisitors) && Number.isInteger(value.totalVisitors)) setCounts(value) })
      .catch(() => { if (active) setCounts(false) })
    return () => { active = false }
  }, [])
  return <footer className="visitor-count" title="从统计功能上线起记录；按浏览器标识去重，不同设备分别计数。">
    {counts ? <><span>今日访客 <strong>{counts.todayVisitors.toLocaleString()}</strong></span><i aria-hidden="true">·</i><span>累计访客 <strong>{counts.totalVisitors.toLocaleString()}</strong></span></>
      : <span>{counts === false ? '访客统计暂不可用' : '访客统计加载中…'}</span>}
  </footer>
}
