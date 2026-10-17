/** What a panel shows when there is nothing to show — said plainly. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  )
}
