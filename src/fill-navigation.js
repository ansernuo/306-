export function fillNavigationTarget(rows, rowIndex, currentInput, key) {
  const row = rows[rowIndex]
  if (!row?.length || !['a', 'd', 'w', 'e'].includes(key)) return null
  const column = row.indexOf(currentInput)
  const direction = key === 'd' || key === 'e' ? 1 : -1
  if (key === 'w' || key === 'e') {
    const next = rows[Math.min(Math.max(rowIndex + direction, 0), rows.length - 1)]
    return next[Math.min(Math.max(column, 0), next.length - 1)] ?? null
  }
  if (column < 0) return direction > 0 ? row[0] : row.at(-1)
  const inputs = rows.flat()
  const index = inputs.indexOf(currentInput)
  return inputs[Math.min(Math.max(index + direction, 0), inputs.length - 1)]
}
