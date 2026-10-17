import { DAY_MS, relativeTime } from '@/lib/admin/stats'
import type { AdminData } from '@/lib/admin/data'
import type { Role } from '@/lib/team/roles'

/**
 * The Team page's roster: owners first, then admins, editors, viewers, each
 * alphabetical, with when they were last active and how many posts they
 * created in the last 30 days.
 */
export function buildRoster({ members, posts, now }: Pick<AdminData, 'members' | 'posts' | 'now'>) {
  const since = now.getTime() - 30 * DAY_MS
  const postsBy = new Map<string, number>()
  for (const p of posts) {
    if (p.created_by && Date.parse(p.created_at) >= since) {
      postsBy.set(p.created_by, (postsBy.get(p.created_by) ?? 0) + 1)
    }
  }

  const order: Record<Role, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 }
  return [...members]
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      title: m.title,
      role: m.role,
      status: m.status,
      lastActive: relativeTime(m.last_active_at, now),
      posts: postsBy.get(m.id) ?? 0,
    }))
}
