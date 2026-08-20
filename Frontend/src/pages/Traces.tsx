import { useNavigate } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { PageHeader, Button } from '../components/PageHeader'
import { CategoryBadge, SeverityBadge, StatusBadge } from '../components/Badge'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { getResults } from '../api/results'
import { useApi } from '../lib/useApi'
import { scenarioLifecycle } from '../lib/scenarioStatus'

export function Traces() {
  const navigate = useNavigate()
  const resultsState = useApi(getResults, [])

  return (
    <div>
      <PageHeader title="Traces" subtitle="Raw tool-call execution traces recorded per scenario" />
      <div className="p-6">
        {resultsState.status === 'loading' && <LoadingState label="Loading traces…" />}
        {resultsState.status === 'error' && <ErrorState message={resultsState.error} onRetry={resultsState.reload} />}

        {resultsState.status === 'success' && (() => {
          const withTraces = resultsState.data.filter((r) => r.trace !== null)

          if (withTraces.length === 0) {
            return (
              <EmptyState
                icon={GitBranch}
                title="No traces yet"
                description="Start a test run to execute scenarios and record execution traces."
                action={
                  <Button variant="primary" onClick={() => navigate('/test-runs')}>
                    Go to Test Runs
                  </Button>
                }
              />
            )
          }

          return (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-medium text-[var(--text-faint)]">
                    <th className="px-4 py-2.5">Scenario</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Severity</th>
                    <th className="px-4 py-2.5">Result</th>
                    <th className="px-4 py-2.5">Turns</th>
                    <th className="px-4 py-2.5">Execution Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withTraces.map((result) => (
                    <tr key={result.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">{result.id}</td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={result.category} />
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={result.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={scenarioLifecycle(result)} />
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{result.trace?.execution.turns_used}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{result.trace?.execution.status}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => navigate(`/run-reports/${result.id}`)}>
                          View Trace
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
