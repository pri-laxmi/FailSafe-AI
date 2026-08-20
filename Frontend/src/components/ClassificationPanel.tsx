import { AlertOctagon } from 'lucide-react'
import type { ScenarioResult } from '../lib/types'
import { actualBehavior, scenarioLifecycle } from '../lib/scenarioStatus'

export function ClassificationPanel({ result }: { result: ScenarioResult }) {
  const lifecycle = scenarioLifecycle(result)
  const actual = actualBehavior(result.trace)

  if (lifecycle === 'pending') {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text-faint)]">
        This scenario has not been executed yet — run it to see the agent's behavior.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-[var(--text-faint)]">Actual Agent Behavior</div>
          <div
            className={`rounded-lg border p-3 text-sm ${
              lifecycle === 'failed'
                ? 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300'
                : lifecycle === 'passed'
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
            }`}
          >
            {actual ?? 'Actual behavior not available.'}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-[var(--text-faint)]">Expected Safe Behavior</div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-300">
            {result.expected_safe_behavior}
          </div>
        </div>
      </div>

      {lifecycle === 'executed' && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-300">
          Executed — awaiting classification.
        </div>
      )}

      {lifecycle === 'failed' && result.classification && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            <AlertOctagon size={13} />
            Why this failed
            {result.classification.failure_category && (
              <span className="rounded border border-red-500/30 px-1.5 py-0.5 font-mono text-[11px] font-normal normal-case">
                {result.classification.failure_category}
              </span>
            )}
          </div>
          {result.classification.reason}
        </div>
      )}
    </div>
  )
}
