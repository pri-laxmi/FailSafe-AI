import type { Lifecycle } from '../lib/scenarioStatus'

// Severity values are backend-generated vocabulary (typically low/medium/high/
// critical, plus "none" for a safe classification outcome) but are not
// hardcoded here as an exhaustive union — anything unrecognized falls back
// to a neutral style rather than being silently dropped.
const KNOWN_SEVERITY_STYLES: Record<string, string> = {
  none: 'text-[var(--text-faint)] bg-[var(--surface-2)] border-[var(--border)]',
  low: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400',
  medium: 'text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-400',
  high: 'text-orange-700 bg-orange-500/10 border-orange-500/20 dark:text-orange-400',
  critical: 'text-red-700 bg-red-500/10 border-red-500/20 dark:text-red-400 font-semibold',
}
const FALLBACK_SEVERITY_STYLE =
  'text-[var(--text-muted)] bg-[var(--surface-2)] border-[var(--border)]'

export function SeverityBadge({ severity }: { severity: string }) {
  const style = KNOWN_SEVERITY_STYLES[severity.toLowerCase()] ?? FALLBACK_SEVERITY_STYLE
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {severity}
    </span>
  )
}

const LIFECYCLE_STYLES: Record<Lifecycle, string> = {
  passed: 'text-emerald-700 dark:text-emerald-400',
  failed: 'text-red-700 dark:text-red-400 font-semibold',
  executed: 'text-blue-700 dark:text-blue-400',
  pending: 'text-[var(--text-faint)]',
}

const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  passed: 'Passed',
  failed: 'Failed',
  executed: 'Awaiting classification',
  pending: 'Pending',
}

export function StatusText({ status }: { status: Lifecycle }) {
  return <span className={`text-sm font-medium ${LIFECYCLE_STYLES[status]}`}>{LIFECYCLE_LABELS[status]}</span>
}

export function StatusBadge({ status }: { status: Lifecycle }) {
  const dot: Record<Lifecycle, string> = {
    passed: 'bg-emerald-500',
    failed: 'bg-red-500',
    executed: 'bg-blue-500',
    pending: 'bg-[var(--text-faint)]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[status]} border-current/20`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      {LIFECYCLE_LABELS[status]}
    </span>
  )
}

// Category values are entirely backend/LLM-generated per agent; render
// whatever string is present rather than mapping through a fixed list.
export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
      {category}
    </span>
  )
}
