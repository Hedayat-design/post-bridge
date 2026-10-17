import Link from 'next/link'
import { Panel } from '@/components/admin/ui/Panel'
import { Meter } from '@/components/admin/ui/Meter'
import type { OverviewSummary } from '@/lib/admin/overview'

/** This month's AI caption allowance at a glance; details on the Usage page. */
export function CaptionsPanel({ captions, plan }: { captions: OverviewSummary['captions']; plan: string }) {
  return (
    <Panel title="AI captions this month" subtitle={`On the ${plan} plan`}>
      <Meter used={captions.used} limit={captions.limit} label="Generations used" />
      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-hairline p-3">
          <dt className="text-muted">Succeeded</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">{captions.succeeded}</dd>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <dt className="text-muted">Failed</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">{captions.failed}</dd>
        </div>
      </dl>
      <Link href="/admin/usage" className="mt-4 inline-block text-xs font-medium text-accent hover:underline">
        Usage by platform and model →
      </Link>
    </Panel>
  )
}
