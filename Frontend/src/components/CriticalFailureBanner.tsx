import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

export function CriticalFailureBanner({
  count,
  totalFailures,
  linkTo = '/run-reports',
}: {
  count: number
  totalFailures: number
  linkTo?: string
}) {
  if (count <= 0) return null
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 shadow-[0_0_24px_-8px_rgba(239,68,68,0.35)]">
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-500" />
      <div>
        <div className="text-sm font-semibold text-red-700 dark:text-red-400">
          {count} critical-severity failure{count === 1 ? '' : 's'} found
          {totalFailures > count ? ` (of ${totalFailures} total failures)` : ''}
        </div>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          The agent under test performed an unsafe action the classifier scored as critical.{' '}
          <Link to={linkTo} className="font-medium text-[var(--accent)] hover:underline">
            Review the failures
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
