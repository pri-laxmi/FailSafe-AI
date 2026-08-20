import { api } from './client'
import type { Classification } from '../lib/types'

export const getClassifications = () => api.get<Classification[]>('/classifications')
