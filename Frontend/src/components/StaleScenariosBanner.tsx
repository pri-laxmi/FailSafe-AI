import { AlertTriangle, Sparkles } from 'lucide-react'
import { Button } from './PageHeader'
import type { ScenariosStatus } from '../lib/types'

export function StaleScenariosBanner({
  status,
  onRegenerate,
  regenerating,
}: {
  status: ScenariosStatus
  onRegenerate: () => void
  regenerating?: boolean
}) {
  if (!status.stale) return null

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center">
      <AlertTriangle size={18} className="shrink-0 text-amber-500" />
      <div className="flex-1">
        <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          These scenarios don't match the current agent
        </div>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          {status.scenario_count} scenario{status.scenario_count === 1 ? '' : 's'} generated for{' '}
          <span className="font-medium text-[var(--text)]">
            {status.generated_for_agent_name ?? 'a previous agent'}
          </span>
          , but the current agent is{' '}
          <span className="font-medium text-[var(--text)]">{status.current_agent_name ?? 'unknown'}</span>. Results
          shown below may not apply.
        </p>
      </div>
      <Button
        variant="primary"
        onClick={onRegenerate}
        disabled={regenerating}
        className={regenerating ? 'opacity-70' : 'shrink-0'}
      >
        <Sparkles size={14} /> {regenerating ? 'Regenerating…' : 'Regenerate Now'}
      </Button>
    </div>
  )
}
