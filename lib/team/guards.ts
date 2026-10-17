import { redirect } from 'next/navigation'
import { getAccess } from '@/lib/team/access'

/**
 * For the layouts of both signed-in sites (user and admin).
 *
 * In team mode, someone whose picked member was removed or suspended still
 * carries the cookie, so middleware lets them through; this sends them back
 * to the picker instead of showing every page as "not with this role".
 */
export async function requirePickedMember() {
  const access = await getAccess()
  if (access.teamMode && !access.member) redirect('/who')
  return access
}
