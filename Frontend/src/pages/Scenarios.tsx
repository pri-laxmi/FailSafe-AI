import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Copy, Sparkles, X, FlaskConical, Info, PlayCircle } from 'lucide-react'
import { PageHeader, Button } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { SeverityBadge, CategoryBadge, StatusBadge } from '../components/Badge'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { StaleScenariosBanner } from '../components/StaleScenariosBanner'
import { GenerationProgress } from '../components/GenerationProgress'
import { getResults } from '../api/results'
import { getScenariosStatus } from '../api/scenarios'
import { useApi } from '../lib/useApi'
import { useScenarioGeneration } from '../lib/useScenarioGeneration'
import { scenarioLifecycle, type Lifecycle } from '../lib/scenarioStatus'
import type { ScenarioResult } from '../lib/types'

const PAGE_SIZE = 7

export function Scenarios() {
  const resultsState = useApi(getResults, [])
  const statusState = useApi(getScenariosStatus, [])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | Lifecycle>('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<ScenarioResult | null>(null)

  const generation = useScenarioGeneration(() => {
    resultsState.reload()
    statusState.reload()
    clearFilters()
  })

  const results = resultsState.status === 'success' ? resultsState.data : []

  const categories = useMemo(() => Array.from(new Set(results.map((r) => r.category))).sort(), [results])
  const severities = useMemo(() => Array.from(new Set(results.map((r) => r.severity))).sort(), [results])

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (category !== 'all' && r.category !== category) return false
      if (severity !== 'all' && r.severity !== severity) return false
      if (lifecycleFilter !== 'all' && scenarioLifecycle(r) !== lifecycleFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!r.id.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [results, category, severity, lifecycleFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const severityCounts = severities.map((s) => ({
    severity: s,
    count: results.filter((r) => r.severity === s).length,
  }))

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setSeverity('all')
    setLifecycleFilter('all')
    setPage(1)
  }

  const handleGenerate = () => {
    if (results.length > 0) {
      const confirmed = window.confirm(
        'This replaces all current scenarios with a fresh set for the current agent, and clears any traces/classifications tied to the old ones. Continue?',
      )
      if (!confirmed) return
    }
    generation.start()
  }

  return (
    <div>
      <PageHeader
        title="Scenarios"
        subtitle="Browse and manage adversarial test scenarios"
        actions={
          <Button variant="primary" onClick={handleGenerate} className={generation.isRunning ? 'opacity-70' : ''} disabled={generation.isRunning}>
            <Sparkles size={15} /> {generation.isRunning ? 'Regenerating…' : 'Regenerate Scenarios'}
          </Button>
        }
      />

      <div className="p-6">
        {generation.startError && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {generation.startError}
          </div>
        )}

        {generation.job && (generation.isRunning || generation.job.status === 'failed') && (
          <div className="mb-4">
            <GenerationProgress job={generation.job} />
          </div>
        )}

        {statusState.status === 'success' && (
          <div className="mb-4">
            <StaleScenariosBanner status={statusState.data} onRegenerate={handleGenerate} regenerating={generation.isRunning} />
          </div>
        )}

        {resultsState.status === 'loading' && <LoadingState label="Loading scenarios…" />}
        {resultsState.status === 'error' && <ErrorState message={resultsState.error} onRetry={resultsState.reload} />}

        {resultsState.status === 'success' && results.length === 0 && (
          <EmptyState
            icon={FlaskConical}
            title="No scenarios yet"
            description="Generate adversarial scenarios for the current Agent Under Test to start building the test library."
            action={
              <Button variant="primary" onClick={handleGenerate}>
                <Sparkles size={15} /> Generate Scenarios
              </Button>
            }
          />
        )}

        {resultsState.status === 'success' && results.length > 0 && (
          <>
            {results.every((r) => scenarioLifecycle(r) === 'pending') && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                <Info size={15} className="shrink-0" />
                These scenarios haven't been executed yet — every result shows "Pending" until you start a run.
                <Link to="/test-runs" className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium hover:underline">
                  <PlayCircle size={14} /> Start a Run
                </Link>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search scenarios…"
                className="min-w-[220px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  setPage(1)
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value)
                  setPage(1)
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="all">All Severities</option>
                {severities.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={lifecycleFilter}
                onChange={(e) => {
                  setLifecycleFilter(e.target.value as typeof lifecycleFilter)
                  setPage(1)
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="all">All Results</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="executed">Awaiting classification</option>
                <option value="pending">Pending</option>
              </select>
              {(search || category !== 'all' || severity !== 'all' || lifecycleFilter !== 'all') && (
                <button onClick={clearFilters} className="text-sm font-medium text-[var(--accent)] hover:underline">
                  Clear Filters
                </button>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <StatCard label="Total Scenarios" value={results.length} />
              {severityCounts.map(({ severity: s, count }) => (
                <StatCard key={s} label={s} value={count} />
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-xs font-medium text-[var(--text-faint)]">
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Severity</th>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5">Result</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((result) => {
                      const lifecycle = scenarioLifecycle(result)
                      return (
                        <tr
                          key={result.id}
                          className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] ${
                            lifecycle === 'failed' ? 'bg-red-500/[0.03]' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">{result.id}</td>
                          <td className="px-4 py-3">
                            <CategoryBadge category={result.category} />
                          </td>
                          <td className="px-4 py-3">
                            <SeverityBadge severity={result.severity} />
                          </td>
                          <td className="max-w-md px-4 py-3 text-[var(--text-muted)]">{result.description}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={lifecycle} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setDetail(result)}
                                className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                                aria-label="View scenario"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                                className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                                aria-label="Copy scenario JSON"
                              >
                                <Copy size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-sm text-[var(--text-faint)]">
                <span>
                  Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} scenarios
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md px-2 py-1 hover:bg-[var(--surface-2)] disabled:opacity-40"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(0, 5)
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-7 w-7 rounded-md text-xs font-medium ${
                          p === page ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  {totalPages > 5 && <span className="px-1">…</span>}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md px-2 py-1 hover:bg-[var(--surface-2)] disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-[var(--text)]">{detail.id}</span>
                <SeverityBadge severity={detail.severity} />
                <CategoryBadge category={detail.category} />
                <StatusBadge status={scenarioLifecycle(detail)} />
              </div>
              <button onClick={() => setDetail(null)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-[var(--text-muted)]">{detail.description}</p>
            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold text-[var(--text-faint)]">User Input</div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 font-mono text-xs leading-relaxed text-[var(--text)]">
                {detail.user_input}
              </div>
            </div>
            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold text-[var(--text-faint)]">Expected Safe Behavior</div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-[var(--text)]">
                {detail.expected_safe_behavior}
              </div>
            </div>
            {detail.trace && (
              <Link
                to={`/run-reports/${detail.id}`}
                className="text-sm font-medium text-[var(--accent)] hover:underline"
                onClick={() => setDetail(null)}
              >
                View full report →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
