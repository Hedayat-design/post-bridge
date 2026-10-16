import Link from 'next/link'

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* A single soft sapphire wash behind the hero. Kept as one large, very
          low-opacity shape rather than a gradient across the text, which is
          where "premium" usually tips into garish. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18rem] h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative max-w-3xl mx-auto px-6 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3.5 py-1.5 text-xs font-medium tracking-wide text-accent">
          <span className="h-1 w-1 rounded-full bg-accent-bright" />
          One upload, every platform
        </span>

        <h1 className="mt-7 text-5xl font-extrabold tracking-tight text-ink">
          Post everywhere from one place
        </h1>

        {/* The gold rule is the whole accent budget for this page. */}
        <span className="mx-auto mt-6 block h-px w-24 bg-gradient-to-r from-transparent via-accent-bright to-transparent" />

        <p className="mt-6 text-lg text-muted max-w-xl mx-auto">
          Upload once, publish to every connected platform — or schedule it for later.
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/signup"
            className="bg-primary text-primary-fg font-semibold px-6 py-3 rounded-xl shadow-card transition-colors hover:bg-primary-hover"
          >
            Try it for free
          </Link>
          <Link
            href="/pricing"
            className="border border-hairline-strong bg-surface text-ink font-semibold px-6 py-3 rounded-xl transition-colors hover:border-primary hover:text-primary"
          >
            See pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
