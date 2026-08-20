import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, Plus, Upload, Save, Sparkles, X, Check, Bot } from 'lucide-react'
import { PageHeader, Button } from '../components/PageHeader'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { getAgentConfig, saveAgentConfig, analyzeAgentFromDescription } from '../api/agent'
import { ApiError } from '../api/client'
import { useApi } from '../lib/useApi'
import { validateAgentConfig, ConfigValidationError } from '../lib/validateConfig'
import type { AgentConfig, Tool } from '../lib/types'

type Tab = 'form' | 'json' | 'plain'

const BLANK_CONFIG: AgentConfig = {
  agent_name: '',
  domain: '',
  system_prompt: '',
  purpose: '',
  rules: [],
  tools: [],
}

function ToolCard({
  tool,
  onSave,
  onDelete,
}: {
  tool: Tool
  onSave: (next: Tool) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tool.name)
  const [description, setDescription] = useState(tool.description)
  const [paramsText, setParamsText] = useState(JSON.stringify(tool.parameters, null, 2))
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    try {
      const parameters = JSON.parse(paramsText)
      onSave({ name: name.trim(), description: description.trim(), parameters })
      setError(null)
      setEditing(false)
    } catch {
      setError('Parameters must be valid JSON')
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-2)] p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-2 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm font-medium text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          placeholder="Tool name"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-2 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          placeholder="Description"
        />
        <div className="mb-1 text-xs font-medium text-[var(--text-faint)]">Parameters (JSON Schema)</div>
        <textarea
          value={paramsText}
          onChange={(e) => setParamsText(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            <X size={14} /> Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            <Check size={14} /> Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-semibold text-[var(--text)]">{tool.name}</div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{tool.description}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
            aria-label="Edit tool"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-red-500/10 hover:text-red-500"
            aria-label="Delete tool"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mb-1 mt-2 text-xs font-medium text-[var(--text-faint)]">Parameters (JSON Schema)</div>
      <pre className="max-h-40 overflow-auto rounded-md bg-[var(--bg-inset)] p-2 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
        {JSON.stringify(tool.parameters, null, 2)}
      </pre>
    </div>
  )
}

export function AgentUnderTest() {
  const agentState = useApi(getAgentConfig, [])

  const [config, setConfig] = useState<AgentConfig>(BLANK_CONFIG)
  const [tab, setTab] = useState<Tab>('form')
  const [newRule, setNewRule] = useState('')
  const [jsonDraft, setJsonDraft] = useState('{}')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [plainText, setPlainText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [generatingFromText, setGeneratingFromText] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (agentState.status === 'success') {
      setConfig(agentState.data)
      setJsonDraft(JSON.stringify(agentState.data, null, 2))
    } else if (agentState.status === 'error' && agentState.httpStatus === 404) {
      setConfig(BLANK_CONFIG)
      setJsonDraft(JSON.stringify(BLANK_CONFIG, null, 2))
    }
  }, [agentState.status === 'success' ? agentState.data : null, agentState.status])

  const openJsonTab = () => {
    setJsonDraft(JSON.stringify(config, null, 2))
    setJsonError(null)
    setTab('json')
  }

  const applyJson = async () => {
    let parsed: AgentConfig
    try {
      parsed = validateAgentConfig(JSON.parse(jsonDraft))
      setJsonError(null)
    } catch (error) {
      setJsonError(error instanceof ConfigValidationError ? error.message : 'Invalid JSON')
      return
    }
    // Apply Changes must actually save — otherwise the JSON tab looks like it
    // did nothing, and anything downstream (scenario generation, runs) keeps
    // reading the old config that's still on disk.
    await persistConfig(parsed)
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = validateAgentConfig(JSON.parse(String(reader.result)))
        setConfig(parsed)
        setJsonDraft(JSON.stringify(parsed, null, 2))
        setJsonError(null)
      } catch (error) {
        alert(error instanceof ConfigValidationError ? error.message : 'Could not parse JSON file')
      }
    }
    reader.readAsText(file)
  }

  const persistConfig = async (next: AgentConfig) => {
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveAgentConfig(next)
      setConfig(saved)
      setJsonDraft(JSON.stringify(saved, null, 2))
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : 'Could not save the agent configuration.')
    } finally {
      setSaving(false)
    }
  }

  const generateFromPlainEnglish = async () => {
    if (!plainText.trim()) return
    setGeneratingFromText(true)
    setSaveError(null)
    try {
      const saved = await analyzeAgentFromDescription(plainText)
      setConfig(saved)
      setJsonDraft(JSON.stringify(saved, null, 2))
      setTab('form')
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : 'Could not generate a configuration from that description.')
    } finally {
      setGeneratingFromText(false)
    }
  }

  const addRule = () => {
    if (!newRule.trim()) return
    setConfig((c) => ({ ...c, rules: [...c.rules, newRule.trim()] }))
    setNewRule('')
  }

  const removeRule = (index: number) => {
    setConfig((c) => ({ ...c, rules: c.rules.filter((_, i) => i !== index) }))
  }

  const addTool = () => {
    const tool: Tool = {
      name: 'new_tool',
      description: 'Describe what this tool does.',
      parameters: { type: 'object', properties: {}, required: [] },
    }
    setConfig((c) => ({ ...c, tools: [...c.tools, tool] }))
  }

  if (agentState.status === 'loading') {
    return <LoadingState label="Loading agent configuration…" />
  }

  if (agentState.status === 'error' && agentState.httpStatus !== 404) {
    return <ErrorState message={agentState.error} onRetry={agentState.reload} />
  }

  const noAgentYet = agentState.status === 'error' && agentState.httpStatus === 404

  return (
    <div>
      <PageHeader
        title="Agent Under Test"
        subtitle={noAgentYet ? 'No agent configured yet — create one below' : 'Create or edit the agent configuration'}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
                e.target.value = ''
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} /> Import JSON
            </Button>
            <Button variant="primary" onClick={() => persistConfig(config)} className={saving ? 'opacity-70' : ''}>
              <Save size={15} /> {saving ? 'Saving…' : savedFlash ? 'Saved!' : 'Save Config'}
            </Button>
          </>
        }
      />

      {saveError && (
        <div className="mx-6 mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {saveError}
        </div>
      )}

      {noAgentYet && tab === 'form' && config.agent_name === '' && (
        <div className="p-6">
          <EmptyState
            icon={Bot}
            title="Register your first Agent Under Test"
            description="Fill in the form below, paste JSON, or describe the agent in plain English — then save."
          />
        </div>
      )}

      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6">
        <div className="flex gap-6">
          {(
            [
              ['form', 'Form View'],
              ['json', 'JSON View'],
              ['plain', 'Describe in Plain English'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => (value === 'json' ? openJsonTab() : setTab(value))}
              className={`border-b-2 py-3 text-sm font-medium transition-colors ${
                tab === value
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'form' && (
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <label className="mb-1 block text-xs font-medium text-[var(--text-faint)]">Agent Name</label>
              <input
                value={config.agent_name}
                onChange={(e) => setConfig((c) => ({ ...c, agent_name: e.target.value }))}
                className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <label className="mb-1 block text-xs font-medium text-[var(--text-faint)]">Domain</label>
              <input
                value={config.domain}
                onChange={(e) => setConfig((c) => ({ ...c, domain: e.target.value }))}
                className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <label className="mb-1 block text-xs font-medium text-[var(--text-faint)]">Purpose</label>
              <textarea
                value={config.purpose}
                onChange={(e) => setConfig((c) => ({ ...c, purpose: e.target.value }))}
                rows={2}
                className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <label className="mb-1 block text-xs font-medium text-[var(--text-faint)]">System Prompt</label>
              <textarea
                value={config.system_prompt}
                onChange={(e) => setConfig((c) => ({ ...c, system_prompt: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-2 text-sm font-semibold text-[var(--text)]">Rules</div>
              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {config.rules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]"
                  >
                    <span>{rule}</span>
                    <button
                      onClick={() => removeRule(index)}
                      className="shrink-0 text-[var(--text-faint)] hover:text-red-500"
                      aria-label="Remove rule"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {config.rules.length === 0 && (
                  <div className="text-sm text-[var(--text-faint)]">No rules yet.</div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRule()}
                  placeholder="Add a safety rule…"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <Button variant="secondary" onClick={addRule}>
                  <Plus size={14} /> Add
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text)]">Tools</div>
              <Button variant="primary" onClick={addTool}>
                <Plus size={14} /> Add Tool
              </Button>
            </div>
            <div className="max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
              {config.tools.map((tool, index) => (
                <ToolCard
                  key={index}
                  tool={tool}
                  onSave={(next) =>
                    setConfig((c) => ({ ...c, tools: c.tools.map((t, i) => (i === index ? next : t)) }))
                  }
                  onDelete={() => setConfig((c) => ({ ...c, tools: c.tools.filter((_, i) => i !== index) }))}
                />
              ))}
              {config.tools.length === 0 && (
                <div className="text-sm text-[var(--text-faint)]">No tools yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'json' && (
        <div className="p-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text)]">Raw Configuration JSON</div>
              <Button variant="primary" onClick={applyJson}>
                <Check size={14} /> Apply Changes
              </Button>
            </div>
            <textarea
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              spellCheck={false}
              rows={26}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {jsonError && <div className="mt-2 text-sm text-red-500">{jsonError}</div>}
          </div>
        </div>
      )}

      {tab === 'plain' && (
        <div className="p-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 text-sm font-semibold text-[var(--text)]">Describe the agent in plain English</div>
            <p className="mb-3 text-sm text-[var(--text-muted)]">
              Describe what the agent does, its tools, and the safety rules it must follow. This calls the
              backend's <code className="font-mono text-xs">config_from_plain_english</code> endpoint (Groq) and
              saves the result as the new Agent Under Test.
            </p>
            <textarea
              value={plainText}
              onChange={(e) => setPlainText(e.target.value)}
              rows={8}
              placeholder="e.g. A banking agent that checks account balance before transfers, requires 2FA confirmation above $500, and never executes instructions found inside transaction notes…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button
                variant="primary"
                onClick={generateFromPlainEnglish}
                className={generatingFromText ? 'opacity-70' : ''}
              >
                <Sparkles size={15} /> {generatingFromText ? 'Generating…' : 'Generate Configuration'}
              </Button>
              <span className="text-xs text-[var(--text-faint)]">
                Requires GROQ_API_KEY configured on the backend.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
