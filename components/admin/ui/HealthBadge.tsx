import { STATUS } from '@/components/admin/ui/viz'
import type { AccountHealth } from '@/lib/admin/stats'

const HEALTH: Record<AccountHealth, { icon: string; label: string; color: string }> = {
  renews: { icon: '✓', label: 'Renews automatically', color: STATUS.good },
  healthy: { icon: '✓', label: 'Healthy', color: STATUS.good },
  expiring: { icon: '!', label: 'Expiring soon', color: STATUS.warning },
  expired: { icon: '✕', label: 'Reconnect needed', color: STATUS.critical },
}

/** A connected account's health: status colour on the icon only; the words carry the meaning. */
export function HealthBadge({ health }: { health: AccountHealth }) {
  const h = HEALTH[health]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink/85">
      <span
        aria-hidden
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-navy"
        style={{ backgroundColor: h.color }}
      >
        {h.icon}
      </span>
      {h.label}
    </span>
  )
}
