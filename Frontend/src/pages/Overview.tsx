import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, FlaskConical, ShieldAlert, XCircle, UserCog, PlayCircle, Sparkles, FileBarChart, ArrowRight } from 'lucide-react'
import { PageHeader, Button } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { CriticalFailureBanner } from '../components/CriticalFailureBanner'
import { StaleScenariosBanner } from '../components/StaleScenariosBanner'
import { GenerationProgress } from '../components/GenerationProgress'
import { AgentOnboarding } from '../components/AgentOnboarding'
import { getAgentConfig } from '../api/agent'
import { getResults } from '../api/results'
import { getScenariosStatus } from '../api/scenarios'
import { startRun } from '../api/runs'
import { ApiError } from '../api/client'
import { useApi } from '../lib/useApi'
import { useScenarioGeneration } from '../lib/useScenarioGeneration'
import { computeResultStats } from '../lib/aggregate'

export function Overview() {
  const navigate = useNavigate()
  const agentState = useApi(getAgentConfig, [])
  const resultsState = useApi(getResults, [])
  const statusState = useApi(getScenariosStatus, [])
  const [changingAgent, setChangingAgent] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const generation = useScenarioGeneration(() => {
    resultsState.reload()
    statusState.reload()
  })

  const handleStartRun = async () => {
    setStarting(true)
    setStartError(null)
    try {
      const run = await startRun()
      navigate(`/test-runs/${run.id}`)
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : 'Could not start a run.')
    } finally {
      setStarting(false)
    }
  }

  if (agentState.status === 'loading') {
    return <LoadingState label="Loading agent posture…" />
  }

  const noAgentConfigured = agentState.status === 'error' && agentState.httpStatus === 404

  // No agent saved yet, or the user explicitly asked to change it: show only
  // the onboarding flow — never a dashboard with stale or fabricated data.
  if (noAgentConfigured || changingAgent) {
    return (
      <AgentOnboarding
        onAgentSaved={() => {
          setChangingAgent(false)
          agentState.reload()
          resultsState.reload()
          statusState.reload()
        }}
        onCancel={noAgentConfigured ? undefined : () => setChangingAgent(false)}
      />
    )
  }

  if (agentState.status === 'error') {
    return <ErrorState message={agentState.error} onRetry={agentState.reload} />
  }

  if (resultsState.status === 'loading') {
    return <LoadingState label="Loading agent posture…" />
  }

  if (resultsState.status === 'error') {
    return <ErrorState message={resultsState.error} onRetry={resultsState.reload} />
  }

  const agentConfig = agentState.data
  const results = resultsState.data
  const stats = computeResultStats(results)

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Safety posture of the current Agent Under Test"
        actions={
          <Button variant="primary" onClick={() => setChangingAgent(true)}>
            <UserCog size={15} /> Change Agent
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        {startError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {startError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Agent Under Test" value={agentConfig.agent_name} icon={<Bot size={13} />} />
          <StatCard label="Scenario Library" value={stats.total} icon={<FlaskConical size={13} />} />
          <StatCard
            label="Failures"
            value={stats.failed}
            valueClassName={stats.failed > 0 ? 'text-red-600 dark:text-red-400' : undefined}
            icon={<XCircle size={13} />}
          />
          <StatCard
            label="Critical Failures"
            value={stats.criticalFailures}
            valueClassName={stats.criticalFailures > 0 ? 'text-red-600 dark:text-red-400' : undefined}
            icon={<ShieldAlert size={13} />}
          />
        </div>

        {generation.job && (generation.isRunning || generation.job.status === 'failed') && (
          <GenerationProgress job={generation.job} />
        )}

        {statusState.status === 'success' && (
          <StaleScenariosBanner status={statusState.data} onRegenerate={generation.start} regenerating={generation.isRunning} />
        )}

        <CriticalFailureBanner count={stats.criticalFailures} totalFailures={stats.failed} />

        {stats.total === 0 && (
          <EmptyState
            icon={FlaskConical}
            title="No scenarios generated yet"
            description="Generate adversarial scenarios for this agent to start testing it."
            action={
              <Link to="/scenarios">
                <Button variant="primary">Go to Scenarios</Button>
              </Link>
            }
          />
        )}

        {stats.total > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text)]">Agent Under Test</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{agentConfig.purpose}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--text-faint)]">Domain</dt>
                  <dd className="text-[var(--text)]">{agentConfig.domain}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-faint)]">Rules</dt>
                  <dd className="text-[var(--text)]">{agentConfig.rules.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-faint)]">Tools</dt>
                  <dd className="text-[var(--text)]">{agentConfig.tools.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-faint)]">Pass rate</dt>
                  <dd className="text-[var(--text)]">{stats.passRate === null ? 'Not yet classified' : `${stats.passRate}%`}</dd>
                </div>
              </dl>
              <Link
                to="/agent-under-test"
                className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
              >
                Edit configuration →
              </Link>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text)]">Scenario Coverage</h2>
              <div className="mt-3 space-y-2">
                {stats.byCategory.map(({ category, count }) => {
                  const pct = Math.round((count / stats.total) * 100)
                  return (
                    <div key={category}>
                      <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span className="font-mono">{category}</span>
                        <span>{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <Link to="/scenarios" className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline">
                Browse scenarios →
              </Link>
            </div>
          </div>
        )}

        {stats.total > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <button
                onClick={handleStartRun}
                disabled={starting}
                className="group flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)] disabled:opacity-70"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <PlayCircle size={18} />
                </span>
                <span className="text-sm font-semibold text-[var(--text)]">
                  {starting ? 'Starting…' : 'Start New Run'}
                </span>
                <span className="text-xs text-[var(--text-faint)]">Execute pending scenarios, then classify results.</span>
                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                  Go <ArrowRight size={12} />
                </span>
              </button>

              <Link
                to="/scenarios"
                className="group flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Sparkles size={18} />
                </span>
                <span className="text-sm font-semibold text-[var(--text)]">Regenerate Scenarios</span>
                <span className="text-xs text-[var(--text-faint)]">Have Groq write fresh adversarial scenarios.</span>
                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                  Go <ArrowRight size={12} />
                </span>
              </Link>

              <Link
                to="/run-reports"
                className="group flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <FileBarChart size={18} />
                </span>
                <span className="text-sm font-semibold text-[var(--text)]">View Run Reports</span>
                <span className="text-xs text-[var(--text-faint)]">Inspect every scenario classified as unsafe.</span>
                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                  Go <ArrowRight size={12} />
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
