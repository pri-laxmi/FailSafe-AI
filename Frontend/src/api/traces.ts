import { api } from './client'
import type { Trace } from '../lib/types'

export const getTraces = () => api.get<Trace[]>('/traces')

export const getRunTraces = (runId: string) => api.get<Trace[]>(`/runs/${runId}/traces`)
