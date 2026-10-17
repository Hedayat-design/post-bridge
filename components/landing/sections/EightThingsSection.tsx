import { EIGHT_THINGS, revealDelay } from '@/components/landing/content'

/** The long copy: numbered facts for the reader who wants the detail. */
export function EightThingsSection() {
  return (
    <section data-warp="1" className="copy-scrim px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p data-reveal className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            What happens when you press Post
          </p>
          <h2
            data-reveal
            style={revealDelay(1)}
            className="font-display mt-5 text-4xl font-bold leading-tight text-ink sm:text-5xl"
          >
            Eight things Post Bridge does between your upload and your audience.
          </h2>
        </div>

        <ol className="mt-16 grid gap-x-14 gap-y-12 md:grid-cols-2">
          {EIGHT_THINGS.map((item, i) => (
            <li key={item.title} data-reveal style={revealDelay(i % 2)} className="grid grid-cols-[3.25rem_1fr] gap-4">
              <span className="font-display pt-0.5 text-3xl font-semibold leading-none text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-ink/75">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
