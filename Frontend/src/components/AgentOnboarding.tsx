import { useRef, useState } from 'react'
import { Sparkles, Upload, ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from './PageHeader'
import { analyzeAgentFromDescription, saveAgentConfig } from '../api/agent'
import { ApiError } from '../api/client'
import { validateAgentConfig, ConfigValidationError } from '../lib/validateConfig'
import type { AgentConfig } from '../lib/types'

type Mode = 'plain' | 'json'

export function AgentOnboarding({
  onAgentSaved,
  onCancel,
}: {
  onAgentSaved: (config: AgentConfig) => void
  onCancel?: () => void
}) {
  const [mode, setMode] = useState<Mode>('plain')

  const [description, setDescription] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const [jsonText, setJsonText] = useState('')
  const [saving, setSaving] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const analyze = async () => {
    if (!description.trim()) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const config = await analyzeAgentFromDescription(description)
      onAgentSaved(config)
    } catch (error) {
      setAnalyzeError(error instanceof ApiError ? error.message : 'Could not analyze that description.')
    } finally {
      setAnalyzing(false)
    }
  }

  const saveJson = async () => {
    setJsonError(null)
    let parsed: AgentConfig
    try {
      parsed = validateAgentConfig(JSON.parse(jsonText))
    } catch (error) {
      setJsonError(
        error instanceof ConfigValidationError
          ? error.message
          : error instanceof SyntaxError
            ? 'That is not valid JSON.'
            : 'Could not parse the configuration.',
      )
      return
    }
    setSaving(true)
    try {
      const saved = await saveAgentConfig(parsed)
      onAgentSaved(saved)
    } catch (error) {
      setJsonError(error instanceof ApiError ? error.message : 'Could not save the agent configuration.')
    } finally {
      setSaving(false)
    }
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setJsonText(String(reader.result))
      setJsonError(null)
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {onCancel && (
          <button
            onClick={onCancel}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <ArrowLeft size={14} /> Cancel
          </button>
        )}

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Which agent do you want to test?</h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Test any AI agent by describing it or providing its configuration.
          </p>
        </div>

        <div className="mb-4 flex justify-center gap-2">
          <button
            onClick={() => setMode('plain')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'plain'
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            Describe in Plain English
          </button>
          <button
            onClick={() => setMode('json')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'json'
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            Import JSON
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          {mode === 'plain' ? (
            <>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                placeholder="I have a banking agent that can check account balances, transfer money between accounts, and freeze accounts."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {analyzeError && <div className="mt-2 text-sm text-red-500">{analyzeError}</div>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--text-faint)]">Requires GROQ_API_KEY on the backend.</span>
                <Button variant="primary" onClick={analyze} className={analyzing ? 'opacity-70' : ''}>
                  <Sparkles size={15} /> {analyzing ? 'Analyzing…' : 'Analyze Agent'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                  e.target.value = ''
                }}
              />
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
                rows={7}
                placeholder={'{\n  "agent_name": "...",\n  "domain": "...",\n  "system_prompt": "...",\n  "purpose": "...",\n  "rules": [],\n  "tools": []\n}'}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {jsonError && <div className="mt-2 text-sm text-red-500">{jsonError}</div>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} /> Upload File
                </Button>
                <Button variant="primary" onClick={saveJson} className={saving ? 'opacity-70' : ''}>
                  {saving ? 'Saving…' : 'Save Agent'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
