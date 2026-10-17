/** Says which data could not be loaded, instead of quietly showing zeros. */
export function LoadErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
      Some data could not be loaded: {errors.join('; ')}
    </p>
  )
}
