import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  valueClassName = 'text-[var(--text)]',
  icon,
  extra,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
  icon?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-faint)]">
        {label}
        {icon}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className={`min-w-0 break-words text-2xl font-semibold leading-tight ${valueClassName}`}>{value}</span>
        {extra}
      </div>
    </div>
  )
}
