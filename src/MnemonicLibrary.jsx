import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { highlightParts, indexMnemonics, MNEMONIC_SUBJECTS, previewBlocks, searchMnemonics } from './mnemonic-search.js'

const PAGE_SIZE = 40

function Highlight({ text, query }) {
  return highlightParts(text, query).map((part, index) => part.match ? <mark key={index}>{part.text}</mark> : part.text)
}

function KnowledgeBlock({ block, query }) {
  // Highlight across formatting boundaries while preserving the source's colors.
  const ranges = []
  let cursor = 0
  for (const part of highlightParts(block.parts.map(part => part.text).join(''), query)) {
    ranges.push({ ...part, start: cursor, end: cursor + part.text.length })
    cursor += part.text.length
  }
  cursor = 0
  return <p className={`mnemonic-line mnemonic-line-${block.kind}`}>{block.parts.map((part, index) => {
    const start = cursor
    cursor += part.text.length
    const end = cursor
    return <span key={index} className={[part.color ? `mnemonic-${part.color}` : '', part.bold ? 'mnemonic-bold' : ''].join(' ')}>{ranges.filter(range => range.start < end && range.end > start).map((range, offset) => {
      const text = part.text.slice(Math.max(0, range.start - start), Math.min(part.text.length, range.end - start))
      return range.match ? <mark key={offset}>{text}</mark> : text
    })}</span>
  })}</p>
}

const MnemonicCard = memo(function MnemonicCard({ item, query, favorite, onFavorite }) {
  const [expanded, setExpanded] = useState(false)
  const preview = previewBlocks(item, query)
  const remaining = item.blocks.filter(block => !preview.includes(block))
  return <article className="mnemonic-card" aria-labelledby={`mnemonic-${item.id}`}>
    <div className="mnemonic-card-heading">
      <div className="mnemonic-card-title">
        <div className="mnemonic-meta"><span className={`mnemonic-subject mnemonic-subject-${item.subject}`}>{MNEMONIC_SUBJECTS[item.subject]}</span><span>{item.chapter}{item.section ? ` · ${item.section}` : ''}</span><span className="mnemonic-number">{String(item.number).padStart(3, '0')}</span></div>
        <h2 id={`mnemonic-${item.id}`}><Highlight text={item.title} query={query} /></h2>
      </div>
      <button className={`mnemonic-save ${favorite ? 'is-saved' : ''}`} aria-label={`${favorite ? '取消收藏' : '收藏'}口诀：${item.title}`} aria-pressed={favorite} title={favorite ? '取消收藏' : '收藏口诀'} onClick={() => onFavorite(item.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" /></svg></button>
    </div>
    <div className="mnemonic-knowledge">{preview.map((block, index) => <KnowledgeBlock key={index} block={block} query={query} />)}</div>
    {remaining.length ? <>
      <button className="mnemonic-expand" aria-expanded={expanded} aria-controls={`mnemonic-detail-${item.id}`} onClick={() => setExpanded(value => !value)}>{expanded ? '收起完整内容' : '展开完整内容'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
      {expanded ? <div id={`mnemonic-detail-${item.id}`} className="mnemonic-detail">{remaining.map((block, index) => <KnowledgeBlock key={index} block={block} query={query} />)}</div> : null}
    </> : null}
  </article>
})

export default function MnemonicLibrary({ data, query, subject, chapter, favorites, onFavorite, onClear, error, onRetry }) {
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const deferredQuery = useDeferredValue(query)
  const indexed = useMemo(() => indexMnemonics(data?.items || []), [data])
  const results = useMemo(() => searchMnemonics(indexed, { query: deferredQuery, subject, chapter, favorites, favoritesOnly }), [indexed, deferredQuery, subject, chapter, favorites, favoritesOnly])
  const favoriteIds = useMemo(() => new Set(favorites), [favorites])
  useEffect(() => { setLimit(PAGE_SIZE) }, [deferredQuery, subject, chapter, favoritesOnly])

  return <main className="mnemonic-library" aria-label="五科口诀库">
    <div className="mnemonic-library-heading">
      <div><div className="mnemonic-eyebrow">随查随记</div><h1>口诀库</h1><p>{data ? `五科 · ${data.items.length.toLocaleString()} 条口诀` : '五科口诀'}<span>搜口诀，也搜知识点</span></p></div>
      <button className={`mnemonic-favorites-filter ${favoritesOnly ? 'active' : ''}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}>★ {favoritesOnly ? '已收藏' : '只看收藏'}<span>{favorites.length}</span></button>
    </div>
    {!data ? <div className="mnemonic-empty" role="status"><h2>{error ? '口诀暂时加载失败' : '正在加载五科口诀…'}</h2>{error ? <button className="ghost-button" onClick={onRetry}>重新加载</button> : <p>加载后可按口诀、疾病名和知识点查找。</p>}</div> : <>
      <div className="mnemonic-result-bar" role="status" aria-live="polite"><span>{deferredQuery.trim() ? <>“<strong>{deferredQuery.trim()}</strong>” · </> : null}{MNEMONIC_SUBJECTS[subject] || '全部科目'}{chapter ? ` · ${chapter.split(':').slice(1).join(':')}` : ''} · <strong>{results.length}</strong> 条{favoritesOnly ? '收藏' : ''}</span>{query || chapter || subject !== 'all' ? <button onClick={onClear}>清除筛选</button> : null}</div>
      <div className="mnemonic-results" aria-busy={query !== deferredQuery}>{results.slice(0, limit).map(item => <MnemonicCard key={item.id} item={item} query={deferredQuery} favorite={favoriteIds.has(item.id)} onFavorite={onFavorite} />)}</div>
      {!results.length ? <div className="mnemonic-empty"><h2>{favoritesOnly ? '没有符合条件的收藏' : '没有找到匹配口诀'}</h2><p>{favoritesOnly ? '点击口诀右侧的星标即可收藏。' : '试试口诀中的几个字，或疾病名、药物名。'}</p><button className="ghost-button" onClick={() => { setFavoritesOnly(false); onClear() }}>查看全部口诀</button></div> : null}
      {results.length > limit ? <div className="mnemonic-more"><button className="ghost-button" onClick={() => setLimit(value => value + PAGE_SIZE)}>显示更多<span>已显示 {Math.min(limit, results.length)} / {results.length}</span></button></div> : null}
    </>}
  </main>
}
