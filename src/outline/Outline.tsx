import type { OutlineItem } from './outlineModel'

export function Outline({
  hideTitle = false,
  outline,
  mobile = false,
  onSelect,
}: {
  hideTitle?: boolean
  outline: OutlineItem[]
  mobile?: boolean
  onSelect: (item: OutlineItem) => void
}) {
  return (
    <section className={mobile ? 'outline-panel mobile' : 'sidebar-section outline-panel'}>
      {hideTitle ? null : <h2>Outline</h2>}
      {outline.length ? (
        <div className="outline-list">
          {outline.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`outline-row outline-level-${item.level}`}
              onClick={() => onSelect(item)}
            >
              <span>{item.text}</span>
              <small>H{item.level}</small>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-text">No headings yet.</p>
      )}
    </section>
  )
}
