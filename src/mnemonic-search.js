export const MNEMONIC_SUBJECTS = { med: '内科', surgery: '外科', pathology: '病理', physiology: '生理', biochemistry: '生化' }

// NFKC also makes full-width letters, numbers and subscripts searchable.
export function normalizeMnemonicText(text = '') {
  return text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

export const blockText = (block) => block.parts.map(part => part.text).join('').trim()
const mathText = text => text.normalize('NFKC').toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '')
const mathTerms = query => [...query.normalize('NFKC').matchAll(/\d+(?:\.\d+)?(?:\s*[+×*÷/=]\s*\d+(?:\.\d+)?)+/g)].map(match => mathText(match[0]))
const hasMathTerm = (text, term) => {
  let at = text.indexOf(term)
  while (at >= 0) {
    if (!/[\d.]/.test(text[at - 1] || '') && !/[\d.]/.test(text[at + term.length] || '')) return true
    at = text.indexOf(term, at + 1)
  }
  return false
}

export const queryWords = (query) => query.trim().split(/\s+/u).map(normalizeMnemonicText).filter(Boolean)

export function indexMnemonics(items) {
  return items.map(item => ({ ...item,
    mathTitle: mathText([item.title, ...(item.aliases || [])].join('；')),
    mathBody: mathText([item.scope || '', ...item.blocks.map(blockText)].join('；')),
    searchTitle: normalizeMnemonicText([item.title, ...(item.aliases || [])].join(' ')),
    searchContext: normalizeMnemonicText((item.locations || [item]).flatMap(location => [MNEMONIC_SUBJECTS[location.subject], location.chapter, location.section]).join(' ')),
    searchBody: normalizeMnemonicText([item.scope || '', ...item.blocks.map(blockText)].join(' ')),
  }))
}

export function searchMnemonics(items, { query = '', subject = 'all', chapter = '', favoritesOnly = false, favorites = [], matchMode = 'auto' } = {}) {
  const words = queryWords(query)
  const formulas = mathTerms(query)
  const favoriteIds = new Set(favorites)
  const matches = []
  for (const item of items) {
    const locations = (item.locations || [item]).filter(location => (subject === 'all' || location.subject === subject) && (!chapter || `${location.subject}:${location.chapter}` === chapter))
    if (!locations.length) continue
    if (favoritesOnly && !favoriteIds.has(item.id) && !(item.alternateIds || []).some(id => favoriteIds.has(id))) continue
    const combined = matchMode === 'title' ? item.searchTitle : matchMode === 'knowledge' ? item.searchContext + item.searchBody : item.searchTitle + item.searchContext + item.searchBody
    if (!words.every(word => combined.includes(word))) continue
    if (formulas.length) {
      const math = matchMode === 'title' ? item.mathTitle : matchMode === 'knowledge' ? item.mathBody : item.mathTitle + ' ' + item.mathBody
      if (!formulas.every(term => hasMathTerm(math, term))) continue
    }
    const score = words.reduce((total, word) => total + (item.searchTitle === word ? 100 : item.searchTitle.includes(word) ? 40 : item.searchContext.includes(word) ? 10 : 1), 0)
    const located = (subject !== 'all' || chapter) ? { ...item, ...locations[0] } : item
    matches.push({ item: located, score, titleMatch: words.length > 0 && words.every(word => item.searchTitle.includes(word)) })
  }
  if (matchMode === 'auto' && matches.some(match => match.titleMatch)) return matches.filter(match => match.titleMatch).sort((a, b) => b.score - a.score).map(match => match.item)
  if (words.length) matches.sort((a, b) => b.score - a.score)
  return matches.map(match => match.item)
}

export function previewBlocks(item, query) {
  const preview = item.blocks.slice(0, 6)
  const words = queryWords(query)
  const match = words.length ? item.blocks.find(block => words.some(word => normalizeMnemonicText(blockText(block)).includes(word))) : null
  if (match && !preview.includes(match)) return [...preview.slice(0, 5), match]
  return preview
}

export function highlightParts(text, query) {
  const targets = queryWords(query)
  if (!targets.length) return [{ text, match: false }]
  const characters = Array.from(text)
  let normalized = ''
  const positions = []
  characters.forEach((character, index) => {
    const part = normalizeMnemonicText(character)
    normalized += part
    for (let offset = 0; offset < part.length; offset++) positions.push(index)
  })
  const marked = new Set()
  for (const target of targets) {
    let from = 0
    while (from < normalized.length) {
      const at = normalized.indexOf(target, from)
      if (at < 0) break
      for (let i = positions[at]; i <= positions[at + target.length - 1]; i++) marked.add(i)
      from = at + target.length
    }
  }
  const parts = []
  characters.forEach((character, index) => {
    const match = marked.has(index)
    if (parts.length && parts.at(-1).match === match) parts.at(-1).text += character
    else parts.push({ text: character, match })
  })
  return parts
}


export function mnemonicDirectory(items) {
  return Object.entries(MNEMONIC_SUBJECTS).map(([subject, label]) => {
    const chapters = new Map()
    const subjectIds = new Set()
    for (const item of items) {
      const locations = (item.locations || [item]).filter(location => location.subject === subject)
      if (!locations.length) continue
      subjectIds.add(item.id)
      for (const location of locations) {
        const chapter = chapters.get(location.chapter) || { name: location.chapter, ids: new Set(), sections: new Set() }
        chapter.ids.add(item.id)
        if (location.section) chapter.sections.add(location.section)
        chapters.set(location.chapter, chapter)
      }
    }
    return { subject, label, count: subjectIds.size, chapters: [...chapters.values()].map(({ name, ids, sections }) => ({ name, count: ids.size, sections })) }
  })
}
