export function optionShortcut(label) {
  if (label == null) return ''
  const normalized = String(label).normalize('NFKC')
  return /^(?:[A-Za-z]+|[0-9]+)$/.test(normalized) ? normalized : ''
}

export function shortcutCharacter(event) {
  if (event.altKey || event.ctrlKey || event.isComposing || event.keyCode === 229) return ''
  if (/^[a-z]$/i.test(event.key)) {
    if (event.metaKey && event.shiftKey) return ''
    return event.metaKey ? event.key.toLowerCase() : event.key.toUpperCase()
  }
  return !event.metaKey && !event.shiftKey && /^[0-9]$/.test(event.key) ? event.key : ''
}

export function matchShortcut(choices, sequence) {
  const candidates = choices.filter(choice => choice.shortcut.startsWith(sequence))
  return {
    exact: candidates.find(choice => choice.shortcut === sequence),
    hasLonger: candidates.some(choice => choice.shortcut.length > sequence.length),
    matches: candidates.length > 0,
  }
}
