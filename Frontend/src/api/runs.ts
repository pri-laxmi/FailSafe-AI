import { api } from './client'
import type { RunState } from '../lib/types'

export const startRun = () => api.post<RunState>('/runs')

export const listRuns = () => api.get<RunState[]>('/runs')

export const getRun = (id: string) => api.get<RunState>(`/runs/${id}`)
