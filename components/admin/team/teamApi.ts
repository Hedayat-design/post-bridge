/**
 * The browser side of app/api/team/members. Each call resolves to null on
 * success or the server's error sentence, ready to show as-is.
 */

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.ok) return null
  const json = await res.json().catch(() => ({}))
  return (json.error as string) ?? `Request failed (${res.status})`
}

export const addMember = (fields: { name: string; email: string; title: string; role: string }) =>
  send('/api/team/members', 'POST', fields)

export const updateMember = (id: string, fields: { role?: string; status?: 'active' | 'suspended' }) =>
  send(`/api/team/members/${id}`, 'PATCH', fields)

export const removeMember = (id: string) => send(`/api/team/members/${id}`, 'DELETE')
