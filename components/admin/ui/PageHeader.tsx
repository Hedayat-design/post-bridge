/** The eyebrow + serif title at the top of every admin page. */
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
        <h1 className="font-display mt-2 text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
      </div>
      {children}
    </header>
  )
}
