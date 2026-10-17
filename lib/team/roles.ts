/**
 * Who may do what in team mode.
 *
 * Pure and dependency-free so the same rules run in pages, API routes and
 * tests. Roles are ranked; each action names the lowest role allowed to take
 * it. Without passwords this keeps honest people in their lane — it is not
 * security, and real login has to come before launch.
 */

export const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const MEMBER_STATUSES = ['active', 'suspended'] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Everything, including managing other owners.',
  admin: 'Manages the team and connected accounts. Cannot change owners.',
  editor: 'Writes, schedules and publishes posts; edits caption styles.',
  viewer: 'Sees the dashboard and what is scheduled. Cannot post.',
}

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 }

export type Action =
  | 'view'
  | 'post'
  | 'edit_styles'
  | 'manage_accounts'
  | 'view_admin'
  | 'manage_team'

const LOWEST_ROLE: Record<Action, Role> = {
  view: 'viewer',
  post: 'editor',
  edit_styles: 'editor',
  manage_accounts: 'admin',
  view_admin: 'admin',
  manage_team: 'admin',
}

/** How a refusal reads: "Viewers can't publish or schedule posts." */
export const ACTION_LABELS: Record<Action, string> = {
  view: 'see this page',
  post: 'publish or schedule posts',
  edit_styles: 'edit caption styles',
  manage_accounts: 'connect or disconnect accounts',
  view_admin: 'open the admin dashboard',
  manage_team: 'manage the team',
}

/** The lowest role that may take `action`, for "ask an Admin" messages. */
export function roleNeededFor(action: Action): Role {
  return LOWEST_ROLE[action]
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function can(role: Role, action: Action): boolean {
  return RANK[role] >= RANK[LOWEST_ROLE[action]]
}

/**
 * Whether `actor` may change a member who currently has `target`, to `next`.
 * `next` omitted means a change that keeps the role: suspend, reactivate,
 * edit details or remove.
 *
 * Owners may do anything. Admins manage everyone below owner and may grant
 * up to admin — never owner, so an admin cannot promote their way past the
 * people who appointed them.
 */
export function canManage(actor: Role, target: Role, next?: Role): boolean {
  if (!can(actor, 'manage_team')) return false
  if (actor === 'owner') return true
  if (target === 'owner') return false
  return next === undefined || next !== 'owner'
}

/** The roles `actor` may hand out, for the role picker. */
export function assignableRoles(actor: Role): Role[] {
  return ROLES.filter((role) => canManage(actor, 'viewer', role))
}

export type MemberChange =
  | { kind: 'role'; role: Role }
  | { kind: 'status'; status: MemberStatus }
  | { kind: 'remove' }

/**
 * Refuses a change that would leave the workspace with no active owner.
 *
 * Without one nobody could ever manage owners again, and in team mode there is
 * no password reset to dig the workspace out.
 */
export function lastOwnerProblem(
  members: { id: string; role: Role; status: MemberStatus }[],
  targetId: string,
  change: MemberChange
): string | null {
  const target = members.find((m) => m.id === targetId)
  if (!target || target.role !== 'owner' || target.status !== 'active') return null

  const losesOwner =
    change.kind === 'remove' ||
    (change.kind === 'role' && change.role !== 'owner') ||
    (change.kind === 'status' && change.status !== 'active')
  if (!losesOwner) return null

  const otherOwners = members.filter(
    (m) => m.id !== targetId && m.role === 'owner' && m.status === 'active'
  )
  return otherOwners.length === 0
    ? 'This is the last active owner. Make someone else an owner first.'
    : null
}

/**
 * Where someone lands after picking their name: the admin site for those who
 * run it, the user site for everyone else. An explicit ?next= wins over this.
 */
export function homeFor(role: Role): '/admin' | '/dashboard' {
  return can(role, 'view_admin') ? '/admin' : '/dashboard'
}

/** Two-letter initials for an avatar: "Ada Lovelace" → "AL", "cher" → "CH". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
