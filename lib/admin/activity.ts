import { PLATFORMS, Platform } from '@/lib/platforms'
import { ROLE_LABELS, isRole } from '@/lib/team/roles'

/**
 * Turns a team_activity row into the sentence the dashboard shows after the
 * member's name: "added Sam as editor", "scheduled a post to 3 accounts".
 *
 * Pure, so every action's wording has a test. To log a new kind of action,
 * call logActivity (lib/team/access.ts) with a new name, then add its
 * sentence here. Unknown actions still render (as their raw name) so a newer
 * server never produces a blank row on an older page.
 */

export type ActivityRow = { action: string; detail: Record<string, unknown> | null }

const platformLabel = (p: unknown) => (typeof p === 'string' ? PLATFORMS[p as Platform]?.label ?? p : 'a platform')
const roleLabel = (r: unknown) => (isRole(r) ? ROLE_LABELS[r].toLowerCase() : 'member')
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const accounts = (n: unknown) => {
  const count = typeof n === 'number' ? n : 0
  return `${count} account${count === 1 ? '' : 's'}`
}

export function describeActivity({ action, detail }: ActivityRow): string {
  const d = detail ?? {}
  switch (action) {
    case 'workspace.created':
      return 'created the workspace'
    case 'member.signed_in':
      return 'started working'
    case 'member.added':
      return `added ${str(d.name)} as ${roleLabel(d.role)}`
    case 'member.role_changed':
      return `changed ${str(d.name)} from ${roleLabel(d.from)} to ${roleLabel(d.to)}`
    case 'member.suspended':
      return `suspended ${str(d.name)}`
    case 'member.reactivated':
      return `reactivated ${str(d.name)}`
    case 'member.removed':
      return `removed ${str(d.name)}`
    case 'member.updated':
      return `updated ${str(d.name)}’s details`
    case 'post.scheduled':
      return `scheduled a post to ${accounts(d.targets)}`
    case 'post.published':
      return `published a post to ${accounts(d.targets)}`
    case 'styles.updated':
      return `updated the ${platformLabel(d.platform)} caption style`
    case 'account.connected':
      return `connected ${platformLabel(d.platform)} account ${str(d.name)}`
    default:
      return action
  }
}
