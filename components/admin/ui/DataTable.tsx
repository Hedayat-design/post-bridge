/**
 * The frame every admin table sits in: scrolls sideways on a phone instead
 * of widening the page. `relative` matters — without it an absolutely
 * positioned child (a screen-reader-only header) escapes the scroll box and
 * stretches the whole page.
 */
export function DataTable({
  minWidth,
  head,
  children,
  className = '',
}: {
  minWidth: number
  head: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative overflow-x-auto rounded-2xl border border-hairline ${className}`}>
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="bg-sunken/60 text-xs text-muted">{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
