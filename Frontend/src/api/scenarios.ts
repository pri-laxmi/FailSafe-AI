import { api } from './client'
import type { GenerationJob, Scenario, ScenariosStatus } from '../lib/types'

export const getScenarios = () => api.get<Scenario[]>('/scenarios')

export const getScenariosStatus = () => api.get<ScenariosStatus>('/scenarios/status')

/** Starts a scenario-generation job (4 category batches) and returns immediately. */
export const startScenarioGeneration = () => api.post<GenerationJob>('/scenarios/generate')

export const getGenerationJob = (jobId: string) => api.get<GenerationJob>(`/scenarios/generate/${jobId}`)
