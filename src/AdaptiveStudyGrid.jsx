import { useLayoutEffect, useRef } from 'react'

// Fit the current content, rather than assigning a ratio to a question type.
export function AdaptiveStudyGrid({ group, children }) {
  const ref = useRef(null)
  const hasOptions = group.options.length > 0 && !group.judgement

  useLayoutEffect(() => {
    const grid = ref.current
    if (!hasOptions) return
    let frame = 0
    let disposed = false
    let previousWidth = 0

    function fit() {
      if (disposed) return
      const width = grid.clientWidth
      previousWidth = width
      // Small desktop windows and iPad split view still use two columns.
      const iPad = /iPad/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      const phone = !iPad && window.innerWidth <= 720 && Math.min(screen.width, screen.height) <= 600 &&
        window.matchMedia('(pointer: coarse)').matches
      grid.dataset.phoneLayout = String(phone)
      if (phone) {
        grid.style.removeProperty('--option-width')
        return
      }

      // A temporary, inert copy measures wrapping without moving the real cards,
      // changing focus/scroll, or running React and event handlers again.
      const probe = grid.cloneNode(true)
      probe.classList.add('study-layout-probe')
      probe.setAttribute('aria-hidden', 'true')
      probe.inert = true
      probe.style.width = `${width}px`
      probe.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
      probe.querySelectorAll('.bottom-nav, .result-line, .question-study-notes, .answer-table-result-row').forEach(node => node.remove())
      // Measure a short reading run, not the full list of repeated questions.
      const rows = [...probe.querySelectorAll('.stem-row')]
      const representatives = new Set([...rows].sort((a, b) => b.textContent.length - a.textContent.length).slice(0, 3))
      rows.forEach(row => { if (!representatives.has(row)) row.remove() })
      probe.querySelectorAll('.answer-table tbody').forEach(body => {
        ;[...body.children].slice(2).forEach(row => row.remove())
      })
      grid.parentElement.append(probe)

      try {
        const bank = probe.querySelector('.option-bank')
        const card = probe.querySelector('.question-card')
        const available = width - parseFloat(getComputedStyle(grid).columnGap)
        const imageQuestion = !!grid.querySelector('.stem-figure')
        const table = !!grid.querySelector('.answer-table')
        const minOptions = Math.min(240, available * .42)
        const minQuestion = Math.min(available - minOptions, imageQuestion || table ? 560 : 360)
        const maxOptions = available - minQuestion
        let bestWidth = minOptions
        let bestScore = Infinity

        for (let step = 0; step <= 16; step++) {
          const optionWidth = Math.round(minOptions + (maxOptions - minOptions) * step / 16)
          probe.style.setProperty('--option-width', `${optionWidth}px`)
          const optionHeight = bank.getBoundingClientRect().height
          const questionHeight = card.getBoundingClientRect().height
          const overflow = [...card.querySelectorAll('.answer-table-scroll')]
            .reduce((sum, node) => sum + Math.max(0, node.scrollWidth - node.clientWidth), 0)
          // Minimize reading/scrolling on both sides; unused width is not a goal.
          const score = Math.max(optionHeight, questionHeight) + .25 * (optionHeight + questionHeight) + overflow * 2
          if (score < bestScore - 1) {
            bestScore = score
            bestWidth = optionWidth
          }
        }
        grid.style.setProperty('--option-width', `${bestWidth}px`)
      } finally {
        probe.remove()
      }
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }
    fit()
    const observer = new ResizeObserver(() => {
      if (Math.abs(grid.clientWidth - previousWidth) > 1) schedule()
    })
    observer.observe(grid)
    window.addEventListener('resize', schedule)
    grid.addEventListener('load', schedule, true)
    document.fonts.ready.then(() => { if (!disposed) schedule() })
    return () => {
      disposed = true
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      grid.removeEventListener('load', schedule, true)
    }
  }, [group, hasOptions])

  return <div ref={ref} className={`study-grid ${hasOptions ? '' : 'no-options'}`}>{children}</div>
}

// Short labels can share more columns; long prose gets a wider reading measure.
export function optionColumnStyle(options) {
  const widths = options.map(option => [...String(option.label || '')]
    .reduce((width, char) => width + (/[^\x00-\xff]/.test(char) ? 13 : 7), 0)).sort((a, b) => a - b)
  const typical = widths[Math.floor(widths.length * .75)] || 130
  return { '--option-column-min': `${Math.max(140, Math.min(240, 32 + typical * .65))}px` }
}
