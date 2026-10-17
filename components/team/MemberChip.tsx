import Link from 'next/link'
import { Avatar } from '@/components/team/Avatar'
import { ROLE_LABELS } from '@/lib/team/roles'
import type { Member } from '@/lib/team/access'

/**
 * Who is acting, in the corner of both sites' top bars. Links to the picker:
 * in team mode, "switching person" is how you sign out.
 */
export function MemberChip({ member }: { member: Pick<Member, 'name' | 'role'> }) {
  return (
    <Link
      href="/who"
      title="Switch person"
      className="flex items-center gap-2.5 rounded-full border border-hairline py-1 pl-1 pr-3 transition-colors hover:border-accent/50"
    >
      <Avatar name={member.name} size="sm" />
      <span className="hidden leading-tight md:block">
        <span className="block text-xs font-semibold text-ink">{member.name}</span>
        <span className="block text-[10px] uppercase tracking-[0.14em] text-muted">
          {ROLE_LABELS[member.role]} · Switch
        </span>
      </span>
    </Link>
  )
}
