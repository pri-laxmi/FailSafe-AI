import { api } from './client'
import type { ScenarioResult } from '../lib/types'

/** Scenario library joined with each scenario's trace and classification. */
export const getResults = () => api.get<ScenarioResult[]>('/results')
