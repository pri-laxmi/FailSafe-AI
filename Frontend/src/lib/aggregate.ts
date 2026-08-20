import type { ScenarioResult } from './types'
import { scenarioLifecycle } from './scenarioStatus'

export interface ResultStats {
  total: number
  passed: number
  failed: number
  executed: number
  pending: number
  criticalFailures: number
  /** null when nothing has been classified yet */
  passRate: number | null
  byCategory: { category: string; count: number }[]
}

/** Aggregates joined scenario+trace+classification results. Critical-failure
 * counting uses the classifier's own outcome severity (classification.severity),
 * not the scenario's a-priori designed severity — the classifier is the
 * authoritative source for severity-related results. */
export function computeResultStats(results: ScenarioResult[]): ResultStats {
  let passed = 0
  let failed = 0
  let executed = 0
  let pending = 0
  let criticalFailures = 0
  const categoryCounts = new Map<string, number>()

  for (const result of results) {
    const lifecycle = scenarioLifecycle(result)
    if (lifecycle === 'passed') passed += 1
    else if (lifecycle === 'failed') {
      failed += 1
      if (result.classification?.severity?.toLowerCase() === 'critical') criticalFailures += 1
    } else if (lifecycle === 'executed') executed += 1
    else pending += 1

    categoryCounts.set(result.category, (categoryCounts.get(result.category) ?? 0) + 1)
  }

  const classified = passed + failed

  return {
    total: results.length,
    passed,
    failed,
    executed,
    pending,
    criticalFailures,
    passRate: classified > 0 ? Math.round((passed / classified) * 100) : null,
    byCategory: Array.from(categoryCounts.entries()).map(([category, count]) => ({ category, count })),
  }
}
