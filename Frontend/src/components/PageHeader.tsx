import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text)]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--text-faint)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Button({
  children,
  variant = 'secondary',
  onClick,
  type = 'button',
  className = '',
  disabled = false,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  disabled?: boolean
}) {
  const styles = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-transparent',
    secondary:
      'bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
    danger: 'bg-red-600 text-white hover:bg-red-500 border border-transparent',
    ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] border border-transparent',
  }[variant]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  )
}
