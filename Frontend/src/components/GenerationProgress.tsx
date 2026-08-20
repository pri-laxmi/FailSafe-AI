import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { GenerationJob } from '../lib/types'

export function GenerationProgress({ job }: { job: GenerationJob }) {
  const total = job.categories_total || 4
  const done = job.categories_done.length
  const isActive = job.status === 'queued' || job.status === 'running'

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        {isActive && <Loader2 size={16} className="animate-spin text-[var(--accent)]" />}
        {job.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
        {job.status === 'failed' && <XCircle size={16} className="text-red-500" />}
        {job.status === 'completed'
          ? 'Generation complete'
          : job.status === 'failed'
            ? 'Generation failed'
            : (job.stage ?? 'Starting…')}
      </div>

      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < done ? 'bg-emerald-500' : 'bg-[var(--surface-2)]'
            }`}
          />
        ))}
      </div>
      <div className="mt-1 text-xs text-[var(--text-faint)]">
        {done}/{total} categories{job.scenario_count !== null ? ` · ${job.scenario_count} scenarios` : ''}
      </div>

      {job.status === 'failed' && job.error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">{job.error}</div>
      )}
      {Object.keys(job.category_errors).length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-[var(--text-faint)]">
          {Object.entries(job.category_errors).map(([category, message]) => (
            <li key={category}>
              <span className="font-mono">{category}</span>: {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
