import { RoleGate } from '@/components/team/RoleGate'

/** Compose needs a role that can use it; see lib/team/roles.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleGate need="post">{children}</RoleGate>
}
