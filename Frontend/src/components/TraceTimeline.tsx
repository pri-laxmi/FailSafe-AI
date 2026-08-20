import { Bot, Wrench } from 'lucide-react'
import type { Trace, TraceEvent } from '../lib/types'

function isFunctionCall(event: TraceEvent): event is Extract<TraceEvent, { action: 'function_call' }> {
  return event.action === 'function_call'
}

function isTextResponse(event: TraceEvent): event is Extract<TraceEvent, { action: 'text_response' }> {
  return event.action === 'text_response'
}

export function TraceTimeline({ trace }: { trace: Trace }) {
  const events = trace.execution?.trace ?? []

  if (events.length === 0) {
    return <div className="text-sm text-[var(--text-faint)]">No trace events recorded for this scenario.</div>
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        if (isFunctionCall(event)) {
          const ok = event.tool_output?.status === 'success'
          return (
            <div key={index} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${
                    ok ? 'bg-[var(--accent)]' : 'bg-red-500'
                  }`}
                >
                  <Wrench size={12} />
                </span>
                {index < events.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--text)]">{event.name}</span>
                  <span className="shrink-0 text-xs text-[var(--text-faint)]">turn {event.turn}</span>
                </div>
                <div className="mb-2 overflow-x-auto rounded-md bg-[var(--bg-inset)] p-2 font-mono text-xs text-[var(--text-muted)]">
                  {JSON.stringify(event.args)}
                </div>
                <div
                  className={`flex items-center gap-2 rounded-md p-2 font-mono text-xs ${
                    ok
                      ? 'bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-500/5 text-red-700 dark:text-red-400'
                  }`}
                >
                  <span className="shrink-0 font-sans font-medium uppercase tracking-wide">
                    {event.tool_output?.status ?? 'unknown'}
                  </span>
                  <span className="truncate">{JSON.stringify(event.tool_output?.result ?? {})}</span>
                </div>
              </div>
            </div>
          )
        }

        if (isTextResponse(event)) {
          return (
            <div key={index} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text)]">
                  <Bot size={12} />
                </span>
                {index < events.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text)]">Agent Response</span>
                  <span className="shrink-0 text-xs text-[var(--text-faint)]">turn {event.turn}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{event.content}</p>
              </div>
            </div>
          )
        }

        return (
          <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 font-mono text-xs text-[var(--text-muted)]">
            {JSON.stringify(event)}
          </div>
        )
      })}
    </div>
  )
}
