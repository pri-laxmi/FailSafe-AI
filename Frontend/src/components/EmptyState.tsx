import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <Icon size={22} className="mb-1 text-[var(--text-faint)]" />
      <div className="text-sm font-medium text-[var(--text)]">{title}</div>
      {description && <div className="max-w-sm text-sm text-[var(--text-faint)]">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
