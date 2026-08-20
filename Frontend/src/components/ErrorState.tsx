import { AlertTriangle, RotateCw } from 'lucide-react'

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  const isConnectionIssue = message.toLowerCase().includes('could not reach')
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <AlertTriangle size={22} className="text-red-500" />
      <div className="max-w-md text-sm text-[var(--text-muted)]">
        {isConnectionIssue ? (
          <>
            <div className="font-medium text-[var(--text)]">Backend unavailable</div>
            <div className="mt-1">{message}</div>
          </>
        ) : (
          message
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          <RotateCw size={14} /> Retry
        </button>
      )}
    </div>
  )
}
