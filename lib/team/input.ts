import { MemberStatus, MEMBER_STATUSES, Role, isRole } from '@/lib/team/roles'

/**
 * Validation for member fields arriving in a request body. Pure, so the API
 * routes and tests share one definition of a well-formed member.
 */

export type MemberFields = {
  name?: string
  email?: string | null
  title?: string | null
  role?: Role
  status?: MemberStatus
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function optionalText(value: unknown, max: number, label: string): string | null | Error {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return new Error(`${label} must be text`)
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) return new Error(`${label} is longer than ${max} characters`)
  return trimmed
}

/**
 * Returns the cleaned fields, or a message naming the first problem.
 * `requireName` is for creation; updates may omit any field.
 */
export function parseMemberFields(
  body: unknown,
  { requireName }: { requireName: boolean }
): { fields: MemberFields } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Expected a JSON object' }
  const input = body as Record<string, unknown>
  const fields: MemberFields = {}

  if ('name' in input || requireName) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) return { error: 'Name is required' }
    if (name.length > 80) return { error: 'Name is longer than 80 characters' }
    fields.name = name
  }

  if ('email' in input) {
    const email = optionalText(input.email, 254, 'Email')
    if (email instanceof Error) return { error: email.message }
    if (email && !EMAIL.test(email)) return { error: 'That email address does not look right' }
    fields.email = email ? email.toLowerCase() : null
  }

  if ('title' in input) {
    const title = optionalText(input.title, 80, 'Title')
    if (title instanceof Error) return { error: title.message }
    fields.title = title
  }

  if ('role' in input) {
    if (!isRole(input.role)) return { error: 'Unknown role' }
    fields.role = input.role
  }

  if ('status' in input) {
    if (!(MEMBER_STATUSES as readonly unknown[]).includes(input.status)) return { error: 'Unknown status' }
    fields.status = input.status as MemberStatus
  }

  return { fields }
}
