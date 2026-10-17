import { RoleGate } from '@/components/team/RoleGate'

/** Connected accounts needs a role that can use it; see lib/team/roles.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleGate need="manage_accounts">{children}</RoleGate>
}
