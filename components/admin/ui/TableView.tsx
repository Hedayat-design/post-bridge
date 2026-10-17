/**
 * The same numbers as a chart, as a table — so no value lives only in a
 * chart or behind a hover. Collapsed by default.
 */
export function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="group mt-4">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted transition-colors hover:text-ink">
        <span className="group-open:hidden">View as table</span>
        <span className="hidden group-open:inline">Hide table</span>
      </summary>
      <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-hairline">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface text-muted">
            <tr>
              {head.map((h, i) => (
                <th key={h} className={`px-3 py-2 font-medium ${i > 0 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums text-ink/85">
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-hairline">
                {row.map((cell, c) => (
                  <td key={c} className={`px-3 py-1.5 ${c > 0 ? 'text-right' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
