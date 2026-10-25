export const MNEMONIC_SUBJECTS = { med: '内科', surgery: '外科', pathology: '病理', physiology: '生理', biochemistry: '生化' }

// NFKC also makes full-width letters, numbers and subscripts searchable.
export function normalizeMnemonicText(text = '') {
  return text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

export const blockText = (block) => block.parts.map(part => part.text).join('').trim()
export const queryWords = (query) => query.trim().split(/\s+/u).map(normalizeMnemonicText).filter(Boolean)

export function indexMnemonics(items) {
  return items.map(item => ({ ...item,
    searchTitle: normalizeMnemonicText([item.title, ...(item.aliases || [])].join(' ')),
    searchContext: normalizeMnemonicText([MNEMONIC_SUBJECTS[item.subject], item.chapter, item.section].join(' ')),
    searchBody: normalizeMnemonicText(item.blocks.map(blockText).join(' ')),
  }))
}

export function searchMnemonics(items, { query = '', subject = 'all', chapter = '', favoritesOnly = false, favorites = [] } = {}) {
  const words = queryWords(query)
  const favoriteIds = new Set(favorites)
  const matches = []
  for (const item of items) {
    if (subject !== 'all' && item.subject !== subject) continue
    if (chapter && `${item.subject}:${item.chapter}` !== chapter) continue
    if (favoritesOnly && !favoriteIds.has(item.id)) continue
    const combined = item.searchTitle + item.searchContext + item.searchBody
    if (!words.every(word => combined.includes(word))) continue
    const score = words.reduce((total, word) => total + (item.searchTitle === word ? 100 : item.searchTitle.includes(word) ? 40 : item.searchContext.includes(word) ? 10 : 1), 0)
    matches.push({ item, score })
  }
  if (words.length) matches.sort((a, b) => b.score - a.score)
  return matches.map(match => match.item)
}

export function previewBlocks(item, query) {
  const candidates = item.blocks.filter(block => block.kind !== 'note')
  const preferred = candidates.filter(block => block.kind === 'mapping')
  const preview = (preferred.length ? preferred : candidates).slice(0, 3)
  const namedContext = normalizeMnemonicText([item.title, item.chapter, item.section, ...(item.aliases || [])].join(' '))
  const words = queryWords(query).filter(word => !namedContext.includes(word))
  const match = words.length ? item.blocks.find(block => words.some(word => normalizeMnemonicText(blockText(block)).includes(word))) : null
  if (match && !preview.includes(match)) return [match, ...preview.slice(0, 2)]
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
