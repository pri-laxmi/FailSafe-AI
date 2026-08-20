import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { SeverityBadge, CategoryBadge } from '../components/Badge'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { CriticalFailureBanner } from '../components/CriticalFailureBanner'
import { getResults } from '../api/results'
import { useApi } from '../lib/useApi'
import { isFailed } from '../lib/scenarioStatus'
import { computeResultStats } from '../lib/aggregate'

export function RunReports() {
  const resultsState = useApi(getResults, [])

  return (
    <div>
      <PageHeader title="Run Reports" subtitle="Every scenario the classifier scored as unsafe" />

      <div className="p-6">
        {resultsState.status === 'loading' && <LoadingState label="Loading results…" />}
        {resultsState.status === 'error' && <ErrorState message={resultsState.error} onRetry={resultsState.reload} />}

        {resultsState.status === 'success' && (() => {
          const results = resultsState.data
          const stats = computeResultStats(results)
          const failed = results.filter(isFailed)

          if (results.length === 0) {
            return (
              <EmptyState
                title="No scenarios yet"
                description="Generate scenarios and run them to see safety reports here."
              />
            )
          }

          if (failed.length === 0) {
            return (
              <EmptyState
                icon={ShieldCheck}
                title="No failures found"
                description={
                  stats.passed + stats.failed === 0
                    ? 'No scenarios have been classified yet. Start a run to execute and classify them.'
                    : `All ${stats.passed} classified scenario${stats.passed === 1 ? '' : 's'} passed.`
                }
              />
            )
          }

          return (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Scenarios Classified" value={stats.passed + stats.failed} />
                <StatCard label="Total Failures" value={stats.failed} valueClassName="text-red-600 dark:text-red-400" />
                <StatCard
                  label="Critical Failures"
                  value={stats.criticalFailures}
                  valueClassName="text-red-600 dark:text-red-400"
                />
              </div>

              <div className="mb-4">
                <CriticalFailureBanner count={stats.criticalFailures} totalFailures={stats.failed} />
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-xs font-medium text-[var(--text-faint)]">
                      <th className="px-4 py-2.5">Scenario</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Severity</th>
                      <th className="px-4 py-2.5">Failure Category</th>
                      <th className="px-4 py-2.5">Why It Failed</th>
                      <th className="px-4 py-2.5 text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failed.map((result) => (
                      <tr key={result.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-red-600 dark:text-red-400">
                          {result.id}
                        </td>
                        <td className="px-4 py-3">
                          <CategoryBadge category={result.category} />
                        </td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={result.classification?.severity ?? result.severity} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                          {result.classification?.failure_category ?? '—'}
                        </td>
                        <td className="max-w-md truncate px-4 py-3 text-[var(--text-muted)]">
                          {result.classification?.reason ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/run-reports/${result.id}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                            View Report →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
