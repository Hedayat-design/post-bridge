import { ReadLine } from '@/components/landing/sections/ReadLine'

/** The one-line statement between sections, lit word by word as you scroll. */
export function InterludeSection() {
  return (
    <section data-warp="1" className="flex min-h-[90svh] items-center px-6 py-24">
      <p className="font-display mx-auto max-w-5xl text-center text-4xl font-semibold leading-[1.12] text-ink sm:text-6xl lg:text-7xl">
        <ReadLine text="Most tools copy your post. Post Bridge translates it." gold={['translates', 'it.']} />
      </p>
    </section>
  )
}
