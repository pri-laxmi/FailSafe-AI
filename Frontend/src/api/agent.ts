import { api } from './client'
import type { AgentConfig } from '../lib/types'

export const getAgentConfig = () => api.get<AgentConfig>('/agent-config')

/** Saves an already-structured config (e.g. imported JSON). No LLM call. */
export const saveAgentConfig = (config: AgentConfig) => api.post<AgentConfig>('/agent-config', { config })

/** Turns a plain-English description into a structured config via Groq and saves it. */
export const analyzeAgentFromDescription = (description: string) =>
  api.post<AgentConfig>('/agent-config/from-description', { description })
