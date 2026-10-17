import { RoleGate } from '@/components/team/RoleGate'

/** Caption styles needs a role that can use it; see lib/team/roles.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleGate need="edit_styles">{children}</RoleGate>
}
