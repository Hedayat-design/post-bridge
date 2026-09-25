import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight mb-6">
        Post everywhere from one place
      </h1>
      <p className="text-lg text-black/60 mb-10 max-w-xl mx-auto">
        Upload once, publish to every connected platform — or schedule it for later.
      </p>
      <div className="flex justify-center gap-4">
        <Link href="/signup" className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl">
          Try it for free
        </Link>
        <Link href="/pricing" className="border font-semibold px-6 py-3 rounded-xl">
          See pricing
        </Link>
      </div>
    </div>
  )
}
