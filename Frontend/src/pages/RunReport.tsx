import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileDown, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader, Button } from '../components/PageHeader'
import { SeverityBadge, CategoryBadge } from '../components/Badge'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { ClassificationPanel } from '../components/ClassificationPanel'
import { TraceTimeline } from '../components/TraceTimeline'
import { getResults } from '../api/results'
import { useApi } from '../lib/useApi'
import { scenarioLifecycle } from '../lib/scenarioStatus'
import { exportElementToPdf } from '../lib/pdf'

export function RunReport() {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()
  const reportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const resultsState = useApi(getResults, [])

  if (resultsState.status === 'loading') return <LoadingState label="Loading report…" />
  if (resultsState.status === 'error') return <ErrorState message={resultsState.error} onRetry={resultsState.reload} />

  const result = resultsState.data.find((r) => r.id === scenarioId)

  if (!result) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--text-muted)]">
          No scenario found with id <span className="font-mono">{scenarioId}</span>.{' '}
          <Link to="/scenarios" className="text-[var(--accent)] hover:underline">
            Back to Scenarios
          </Link>
        </p>
      </div>
    )
  }

  const lifecycle = scenarioLifecycle(result)
  const isFailed = lifecycle === 'failed'
  const isPending = lifecycle === 'pending'

  const downloadTrace = () => {
    const blob = new Blob([JSON.stringify(result.trace, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${result.id}_trace.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadPdf = async () => {
    if (!reportRef.current) return
    setExporting(true)
    try {
      await exportElementToPdf(reportRef.current, `${result.id}_report.pdf`)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('Could not generate the PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Run Report"
        subtitle={<span className="font-mono text-xs">Scenario {result.id}</span>}
        actions={
          <Button variant="secondary" onClick={() => navigate('/scenarios')}>
            <ArrowLeft size={15} /> Back to Scenarios
          </Button>
        }
      />

      <div className="p-6">
        <div ref={reportRef} className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {isPending || lifecycle === 'executed' ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-sm font-semibold text-[var(--text-faint)]">
                  {lifecycle === 'executed' ? 'AWAITING CLASSIFICATION' : 'PENDING'}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    isFailed
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {isFailed ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                  {isFailed ? 'FAIL' : 'PASS'}
                </span>
              )}
              <CategoryBadge category={result.category} />
              <SeverityBadge severity={result.severity} />
            </div>

            <div className="flex flex-wrap gap-6 text-right text-xs">
              <div>
                <div className="text-[var(--text-faint)]">Turns Used</div>
                <div className="font-mono font-medium text-[var(--text)]">{result.trace?.execution?.turns_used ?? '—'}</div>
              </div>
              <div>
                <div className="text-[var(--text-faint)]">Execution Status</div>
                <div className="font-mono font-medium text-[var(--text)]">{result.trace?.execution?.status ?? '—'}</div>
              </div>
              <div>
                <div className="text-[var(--text-faint)]">Scenario ID</div>
                <div className="font-mono font-medium text-[var(--text)]">{result.id}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-[var(--text-faint)]">User Input</div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">
              {result.user_input}
            </div>
          </div>

          <ClassificationPanel result={result} />

          {result.trace && (
            <div>
              <div className="mb-2 text-sm font-semibold text-[var(--text)]">Tool Call Trace</div>
              <TraceTimeline trace={result.trace} />
            </div>
          )}
        </div>

        {result.trace && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={downloadTrace}>
              <Download size={15} /> Download Trace
            </Button>
            <Button variant="primary" onClick={downloadPdf}>
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              {exporting ? 'Generating PDF…' : 'Download Report as PDF'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
