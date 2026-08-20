import { NavLink } from 'react-router-dom'
import {
  ShieldCheck,
  LayoutGrid,
  Bot,
  FlaskConical,
  PlayCircle,
  FileBarChart,
  GitBranch,
  Settings as SettingsIcon,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../lib/theme'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/agent-under-test', label: 'Agent Under Test', icon: Bot },
  { to: '/scenarios', label: 'Scenarios', icon: FlaskConical },
  { to: '/test-runs', label: 'Test Runs', icon: PlayCircle },
  { to: '/run-reports', label: 'Run Reports', icon: FileBarChart },
  { to: '/traces', label: 'Traces', icon: GitBranch },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function Sidebar() {
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
          <ShieldCheck size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight text-[var(--text)]">FailSafe-AI</div>
          <div className="text-xs leading-tight text-[var(--text-faint)]">AI Agent Safety Testing</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`
            }
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className="relative mb-2">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
            <ChevronDown size={15} className="text-[var(--text-faint)]" />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
              {(['dark', 'light'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setTheme(option)
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm capitalize text-[var(--text)] hover:bg-[var(--surface-2)]"
                >
                  {option === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-semibold text-[var(--text)]">
            A
          </div>
          <div>
            <div className="text-sm font-medium leading-tight text-[var(--text)]">Analyst</div>
            <div className="text-xs leading-tight text-[var(--text-faint)]">admin@failsafe.ai</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
