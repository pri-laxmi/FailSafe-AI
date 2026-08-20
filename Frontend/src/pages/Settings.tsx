import { Moon, Sun } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useTheme } from '../lib/theme'

export function Settings() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences for this workspace" />
      <div className="p-6">
        <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-sm font-semibold text-[var(--text)]">Appearance</div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Choose how FailSafe-AI looks on this device.</p>
          <div className="mt-3 flex gap-2">
            {(['dark', 'light'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setTheme(option)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  theme === option
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {option === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
