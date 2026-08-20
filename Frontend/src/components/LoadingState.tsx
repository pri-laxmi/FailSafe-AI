import { Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-[var(--text-faint)]">
      <Loader2 size={22} className="animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
