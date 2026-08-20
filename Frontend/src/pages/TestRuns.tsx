import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayCircle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { PageHeader, Button } from '../components/PageHeader'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { listRuns, startRun } from '../api/runs'
import { ApiError } from '../api/client'
import { useApi } from '../lib/useApi'
import type { RunStatus } from '../lib/types'

const STATUS_META: Record<RunStatus, { label: string; className: string; icon: typeof Loader2 }> = {
  queued: { label: 'Queued', className: 'text-[var(--text-faint)]', icon: Clock },
  executing: { label: 'Executing', className: 'text-blue-600 dark:text-blue-400', icon: Loader2 },
  classifying: { label: 'Classifying', className: 'text-blue-600 dark:text-blue-400', icon: Loader2 },
  completed: { label: 'Completed', className: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'text-red-600 dark:text-red-400', icon: XCircle },
}

export function TestRuns() {
  const navigate = useNavigate()
  const runsState = useApi(listRuns, [])
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const handleStart = async () => {
    setStarting(true)
    setStartError(null)
    try {
      const run = await startRun()
      navigate(`/test-runs/${run.id}`)
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : 'Could not start a run.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Test Runs"
        subtitle="Execute pending scenarios in the sandbox, then classify the results"
        actions={
          <Button variant="primary" onClick={handleStart} className={starting ? 'opacity-70' : ''}>
            <PlayCircle size={15} /> {starting ? 'Starting…' : 'Start New Run'}
          </Button>
        }
      />

      <div className="p-6">
        {startError && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {startError}
          </div>
        )}

        {runsState.status === 'loading' && <LoadingState label="Loading run history…" />}
        {runsState.status === 'error' && <ErrorState message={runsState.error} onRetry={runsState.reload} />}

        {runsState.status === 'success' && runsState.data.length === 0 && (
          <EmptyState
            icon={PlayCircle}
            title="No runs yet"
            description="Start a run to execute every scenario that hasn't been run against the current agent, then classify the results."
            action={
              <Button variant="primary" onClick={handleStart} className={starting ? 'opacity-70' : ''}>
                <PlayCircle size={15} /> {starting ? 'Starting…' : 'Start New Run'}
              </Button>
            }
          />
        )}

        {runsState.status === 'success' && runsState.data.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs font-medium text-[var(--text-faint)]">
                  <th className="px-4 py-2.5">Run ID</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Executed</th>
                  <th className="px-4 py-2.5">Classified</th>
                  <th className="px-4 py-2.5">Started</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runsState.data.map((run) => {
                  const meta = STATUS_META[run.status]
                  const Icon = meta.icon
                  return (
                    <tr key={run.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">{run.id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${meta.className}`}>
                          <Icon size={13} className={run.status === 'executing' || run.status === 'classifying' ? 'animate-spin' : ''} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {run.executed}/{run.total || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {run.classified}/{run.total || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="secondary" onClick={() => navigate(`/test-runs/${run.id}`)}>
                          Open
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
