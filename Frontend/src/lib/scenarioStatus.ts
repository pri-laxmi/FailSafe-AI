import type { ScenarioResult, Trace, Classification } from './types'

/** UI-only lifecycle derived from whether a trace/classification exist yet.
 * Not a backend field — the backend only tells us trace/classification
 * presence and the classifier's own "safe"/"unsafe" verdict. */
export type Lifecycle = 'pending' | 'executed' | 'passed' | 'failed'

export function scenarioLifecycle(result: {
  trace: Trace | null
  classification: Classification | null
}): Lifecycle {
  if (!result.trace) return 'pending'
  if (!result.classification) return 'executed'
  return result.classification.classification === 'unsafe' ? 'failed' : 'passed'
}

export function isFailed(result: ScenarioResult): boolean {
  return result.classification?.classification === 'unsafe'
}

export function actualBehavior(trace: Trace | null): string | null {
  const response = trace?.execution?.final_response
  return response && response.trim() ? response : null
}
