import { useLayoutEffect, useRef } from 'react'

export function compactStudyGroup(group) {
  return group.options.length > 0 && group.stems.length >= 6 && !group.judgement && !group.sharedStem &&
    !group.options.some(option => option.category) &&
    group.stems.every(stem => !stem.image && !/填空|排序|自评/.test(stem.answerMode || '') && String(stem.text || '').length <= 120)
}

export function compactTableGroup(group) {
  return compactStudyGroup(group) && group.options.length <= 16
}

// Fit the current content, rather than assigning a ratio to a question type.
export function AdaptiveStudyGrid({ group, children }) {
  const ref = useRef(null)
  const compact = compactStudyGroup(group)
  const compactTable = compactTableGroup(group)
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
        grid.style.removeProperty('--stem-columns')
        grid.style.removeProperty('--stem-rows')
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
      probe.querySelectorAll('.result-line, .question-study-notes, .answer-table-result-row').forEach(node => node.remove())
      // Measure a short reading run, not the full list of repeated questions.
      const rows = [...probe.querySelectorAll('.stem-row')]
      if (!compact) {
        const representatives = new Set([...rows].sort((a, b) => b.textContent.length - a.textContent.length).slice(0, 3))
        rows.forEach(row => { if (!representatives.has(row)) row.remove() })
      }
      if (!compact) probe.querySelectorAll('.answer-table tbody').forEach(body => {
        ;[...body.children].slice(2).forEach(row => row.remove())
      })
      grid.parentElement.append(probe)

      try {
        const bank = probe.querySelector('.option-bank')
        const card = probe.querySelector('.question-card')
        const available = width - parseFloat(getComputedStyle(grid).columnGap)
        const imageQuestion = !!grid.querySelector('.stem-figure')
        const table = !!grid.querySelector('.answer-table')
        const labelWidth = Math.max(...group.options.map(option => [...String(option.label || '')].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 13 : 7), 0)))
        const optionMinimum = compactTable ? Math.max(140, Math.min(240, labelWidth + 54)) : 240
        const minOptions = Math.min(optionMinimum, available * .42)
        const compactTableWidth = group.options.length * (window.matchMedia('(pointer: coarse)').matches ? 30 : 28) + 166
        const minQuestion = Math.min(available - minOptions, compactTable ? compactTableWidth : imageQuestion || table ? 560 : 360)
        const maxOptions = available - minQuestion
        let bestWidth = minOptions
        let bestColumns = 1
        let bestScore = Infinity
        const targetHeight = Math.max(320, window.innerHeight - (grid.getBoundingClientRect().top + window.scrollY) - 16)

        for (let step = 0; step <= 16; step++) {
          const optionWidth = Math.round(minOptions + (maxOptions - minOptions) * step / 16)
          probe.style.setProperty('--option-width', `${optionWidth}px`)
          probe.dataset.compactTableWrap = String(compactTable && available - optionWidth < compactTableWidth)
          const maxColumns = compact && !compactTable && available - optionWidth >= 640 ? 2 : 1
          for (let columns = 1; columns <= maxColumns; columns++) {
            probe.style.setProperty('--stem-columns', columns)
            probe.style.setProperty('--stem-rows', Math.ceil(group.stems.length / columns))
            const optionHeight = bank.getBoundingClientRect().height
            const questionHeight = (compact ? probe.querySelector('.question-side') : card).getBoundingClientRect().height
            const overflow = [...card.querySelectorAll('.answer-table-scroll')]
              .reduce((sum, node) => sum + Math.max(0, node.scrollWidth - node.clientWidth), 0)
            const height = Math.max(optionHeight, questionHeight)
            // Fit the complete group and navigation into the viewport first.
            // Prefer a single reading column when both arrangements already fit.
            const score = compact
              ? Math.max(0, height - targetHeight) * 10 + (columns - 1) * 60 + optionWidth * .02 + height * .001
              : height + .25 * (optionHeight + questionHeight) + overflow * 2
            if (score < bestScore - 1) {
              bestScore = score
              bestWidth = optionWidth
              bestColumns = columns
            }
          }
        }
        grid.style.setProperty('--option-width', `${bestWidth}px`)
        grid.dataset.compactTableWrap = String(compactTable && available - bestWidth < compactTableWidth)
        grid.style.setProperty('--stem-columns', bestColumns)
        grid.style.setProperty('--stem-rows', Math.ceil(group.stems.length / bestColumns))
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
  }, [group, hasOptions, compact, compactTable])

  return <div ref={ref} className={`study-grid ${hasOptions ? '' : 'no-options'} ${compact ? 'compact-questions' : ''}`}>{children}</div>
}

// Short labels can share more columns; long prose gets a wider reading measure.
export function optionColumnStyle(options) {
  const widths = options.map(option => [...String(option.label || '')]
    .reduce((width, char) => width + (/[^\x00-\xff]/.test(char) ? 13 : 7), 0)).sort((a, b) => a - b)
  const typical = widths[Math.floor(widths.length * .75)] || 130
  return { '--option-column-min': `${Math.max(140, Math.min(240, 32 + typical * .65))}px` }
}
