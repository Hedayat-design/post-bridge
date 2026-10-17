import { STEPS, revealDelay } from '@/components/landing/content'

export function HowItWorksSection() {
  return (
    <section data-warp="1" className="px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p data-reveal className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            Getting started
          </p>
          <h2
            data-reveal
            style={revealDelay(1)}
            className="font-display mt-5 text-4xl font-bold leading-tight text-ink sm:text-5xl"
          >
            Three steps. You only do the first two once.
          </h2>
        </div>

        <ol className="relative mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              data-reveal
              style={revealDelay(i)}
              className="rounded-3xl border border-hairline bg-bg/55 p-8 backdrop-blur-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 font-display text-lg text-accent">
                {i + 1}
              </span>
              <h3 className="font-display mt-6 text-2xl font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 leading-relaxed text-ink/75">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
