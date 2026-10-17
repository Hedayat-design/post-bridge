import Link from 'next/link'

/** Title, plan and account count, and "+ New post" for roles that can post. */
export function DashboardHeader({
  accountCount,
  plan,
  canPost,
}: {
  accountCount: number
  plan: string
  canPost: boolean
}) {
  return (
    <div className="mb-10 flex items-center justify-between">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-muted">
          {accountCount} accounts connected · {plan} plan
        </p>
      </div>
      {canPost && (
        <Link
          href="/compose"
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-fg shadow-card transition-colors hover:bg-primary-hover"
        >
          + New post
        </Link>
      )}
    </div>
  )
}
