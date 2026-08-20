import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { SeverityBadge, CategoryBadge, StatusBadge } from '../components/Badge'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { getRun } from '../api/runs'
import { getResults } from '../api/results'
import { ApiError } from '../api/client'
import { scenarioLifecycle } from '../lib/scenarioStatus'
import { computeResultStats } from '../lib/aggregate'
import type { RunState, ScenarioResult } from '../lib/types'

const ACTIVE_STATUSES = new Set(['queued', 'executing', 'classifying'])

export function TestRunDetail() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()

  const [run, setRun] = useState<RunState | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [results, setResults] = useState<ScenarioResult[] | null>(null)
  const [resultsError, setResultsError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!runId) return
    let cancelled = false

    const tick = async () => {
      try {
        const nextRun = await getRun(runId)
        if (cancelled) return
        setRun(nextRun)
        setRunError(null)

        try {
          const nextResults = await getResults()
          if (!cancelled) setResults(nextResults)
        } catch (error) {
          if (!cancelled) setResultsError(error instanceof ApiError ? error.message : 'Could not load results.')
        }

        if (!ACTIVE_STATUSES.has(nextRun.status) && intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } catch (error) {
        if (!cancelled) setRunError(error instanceof ApiError ? error.message : 'Could not load this run.')
      }
    }

    tick()
    intervalRef.current = setInterval(tick, 2000)

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [runId])

  if (runError) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--text-muted)]">
          {runError}{' '}
          <Link to="/test-runs" className="text-[var(--accent)] hover:underline">
            Back to Test Runs
          </Link>
        </p>
      </div>
    )
  }

  if (!run) {
    return <LoadingState label="Loading run…" />
  }

  const stats = results ? computeResultStats(results) : null
  const isActive = ACTIVE_STATUSES.has(run.status)

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Test Run #{run.id}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                run.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : run.status === 'failed'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}
            >
              {isActive && <Loader2 size={11} className="animate-spin" />}
              {run.status}
            </span>
          </span>
        }
        subtitle={
          <>
            Started {new Date(run.started_at).toLocaleString()}
            {run.finished_at && <> &middot; Finished {new Date(run.finished_at).toLocaleString()}</>}
          </>
        }
      />

      <div className="p-6">
        {run.error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {run.error}
          </div>
        )}
        {run.errors.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            {run.errors.length} scenario{run.errors.length === 1 ? '' : 's'} had an error during this run: {run.errors[0]}
            {run.errors.length > 1 ? ` (+${run.errors.length - 1} more)` : ''}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total Scenarios" value={run.total || '—'} />
          <StatCard label="Executed" value={`${run.executed}/${run.total || '—'}`} />
          <StatCard label="Classified" value={`${run.classified}/${run.total || '—'}`} />
          {stats && (
            <StatCard
              label="Pass Rate"
              value={stats.passRate === null ? '—' : `${stats.passRate}%`}
              extra={
                stats.passRate !== null && (
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.passRate}%` }} />
                  </div>
                )
              }
            />
          )}
        </div>

        {resultsError && <ErrorState message={resultsError} />}

        {results && results.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-medium text-[var(--text-faint)]">
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Severity</th>
                    <th className="px-4 py-2.5">Result</th>
                    <th className="px-4 py-2.5">User Input (preview)</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => {
                    const lifecycle = scenarioLifecycle(result)
                    return (
                      <tr
                        key={result.id}
                        className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] ${
                          lifecycle === 'failed' ? 'bg-red-500/[0.03]' : ''
                        }`}
                      >
                        <td className={`px-4 py-3 font-mono text-xs ${lifecycle === 'failed' ? 'font-semibold text-red-600 dark:text-red-400' : 'text-[var(--text)]'}`}>
                          {result.id}
                        </td>
                        <td className="px-4 py-3">
                          <CategoryBadge category={result.category} />
                        </td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={result.severity} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lifecycle} />
                        </td>
                        <td className="max-w-sm truncate px-4 py-3 text-[var(--text-muted)]">{result.user_input}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/run-reports/${result.id}`)}
                            className="text-sm font-medium text-[var(--accent)] hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
